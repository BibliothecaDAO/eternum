import { getPlayerName } from "@/hooks/use-player-profile";
import { fetchHeraldGameHistory, requireShard } from "@bibliothecadao/eternum/game-client";
import { getActiveGame } from "@/runtime/world";
import { buildStoryEventPresentation, configManager } from "@bibliothecadao/eternum";
import type { GameSyncEntity, HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import {
  eventConfirmationRank,
  storyEventIdentity,
  storyEventScopeKey,
  type GameSyncEventConfirmation,
  type StoryEventScope,
} from "@bibliothecadao/eternum/game-sync";
import { useGame } from "@bibliothecadao/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { useConnectionStore } from "./use-connection-store";

interface StoryEventData {
  scopeKey: string;
  confirmation: GameSyncEventConfirmation | null;
  entity_id: number | null;
  event_id: string;
  id: string | null;
  owner: string | null;
  story: string;
  storyPayload: Record<string, unknown>;
  timestamp: string;
  tx_hash: string;
  rawStory: unknown;
  [field: string]: unknown;
}

export interface ProcessedStoryEvent extends StoryEventData {
  id: string;
  timestampMs: number;
  presentation: ReturnType<typeof buildStoryEventPresentation>;
}

type StreamStoryEvent = StoryEventData;

interface StoryEventsState {
  streamed: StreamStoryEvent[];
  accept: (event: StreamStoryEvent) => void;
  reset: () => void;
}

const STREAM_EVENT_LIMIT = 512;

const useStoryEventsStore = create<StoryEventsState>((set) => ({
  streamed: [],
  accept: (event) =>
    set((state) => {
      const previous = state.streamed.find((existing) => existing.event_id === event.event_id);
      if (previous && eventConfirmationRank(previous.confirmation) > eventConfirmationRank(event.confirmation))
        return state;
      return {
        streamed: [event, ...state.streamed.filter((existing) => existing.event_id !== event.event_id)].slice(
          0,
          STREAM_EVENT_LIMIT,
        ),
      };
    }),
  reset: () => set({ streamed: [] }),
}));

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const toOptionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  try {
    const number = Number(BigInt(String(value)));
    return Number.isSafeInteger(number) ? number : null;
  } catch {
    return null;
  }
};

const storyVariant = (story: unknown): { payload: Record<string, unknown>; type: string } | null => {
  if (typeof story === "string") return { payload: {}, type: story };
  const record = asRecord(story);
  const entry = record ? Object.entries(record)[0] : undefined;
  if (!entry) return null;
  return { type: entry[0], payload: asRecord(entry[1]) ?? { value: entry[1] } };
};

const EVENT_MODELS = new Set(["StoryEvent", "BattleEvent", "RaidEvent"]);

const storyEventFromValue = (
  model: string,
  value: Record<string, unknown>,
  scope: StoryEventScope,
  confirmation?: GameSyncEventConfirmation,
): StreamStoryEvent | null => {
  const variant = model === "StoryEvent" ? storyVariant(value.story) : { type: model, payload: value };
  if (!variant || !EVENT_MODELS.has(model)) return null;
  const position = asRecord(value.event_position);
  const transactionHash = String(position?.transaction_hash ?? value.tx_hash);
  const eventId =
    model === "StoryEvent"
      ? storyEventIdentity(scope, value)
      : nativeEventIdentity(scope, value, transactionHash, position?.event_index);
  const owner = value.owner ?? value.player ?? asRecord(value.attacker)?.player;
  return {
    scopeKey: storyEventScopeKey(scope),
    confirmation: confirmation ?? null,
    owner: owner === null || owner === undefined ? null : String(owner),
    entity_id: toOptionalNumber(value.entity_id ?? value.explorer_id ?? value.attacker_id),
    id: value.id === undefined ? null : String(value.id),
    tx_hash: transactionHash,
    story: variant.type,
    timestamp: String(value.timestamp ?? "0x0"),
    event_id: eventId,
    storyPayload: variant.payload,
    rawStory: value.story,
  };
};

function nativeEventIdentity(
  scope: StoryEventScope,
  value: Record<string, unknown>,
  transactionHash: string,
  index: unknown,
): string {
  if (BigInt(String(value.game_id)) !== BigInt(scope.gameId)) throw new Error("Native event game mismatch");
  if (!/^0x[0-9a-f]+$/i.test(transactionHash) || BigInt(transactionHash) === 0n)
    throw new Error("Native event requires a transaction hash");
  const eventIndex = toOptionalNumber(index);
  if (eventIndex === null || eventIndex < 0) throw new Error("Native event requires a receipt index");
  return `${storyEventScopeKey(scope)}:receipt:0x${BigInt(transactionHash).toString(16)}:${eventIndex}`;
}

export const toStreamStoryEvent = (
  event: GameSyncEntity,
  scope: StoryEventScope,
  confirmation?: GameSyncEventConfirmation,
): StreamStoryEvent | null => {
  const modelEntry = Object.entries(event.models).find(([model]) => EVENT_MODELS.has(model));
  const value = modelEntry ? asRecord(modelEntry[1]) : null;
  return value ? storyEventFromValue(modelEntry![0], value, scope, confirmation) : null;
};

const historyStoryEvent = (event: HeraldHistoryEvent, scope: StoryEventScope): StreamStoryEvent | null =>
  storyEventFromValue(
    event.model,
    { ...event.value, event_position: { transaction_hash: event.transaction_hash, event_index: event.event_index } },
    scope,
    { block: event.block_number, preconfirmed: false },
  );

export const acceptGameSyncStoryEvent = (
  event: GameSyncEntity,
  scope: StoryEventScope,
  confirmation?: GameSyncEventConfirmation,
): void => {
  const storyEvent = toStreamStoryEvent(event, scope, confirmation);
  if (storyEvent) useStoryEventsStore.getState().accept(storyEvent);
};

export const resetGameSyncStoryEvents = (): void => useStoryEventsStore.getState().reset();

const processStoryEvent = (
  event: StoryEventData | StreamStoryEvent,
  store: Parameters<typeof buildStoryEventPresentation>[1],
): ProcessedStoryEvent => {
  const timestampMs = Number(BigInt(event.timestamp)) * 1_000;
  const presentation = buildStoryEventPresentation(
    {
      ownerAddress: event.owner,
      ownerName: null,
      entityId: event.entity_id,
      txHash: event.tx_hash,
      timestamp: timestampMs,
      storyType: event.story,
      storyPayload: event.storyPayload,
      rawStory: event.rawStory,
    },
    store,
    getPlayerName,
  );
  return { ...event, id: event.event_id, timestampMs, presentation };
};

export const useStoryEvents = (limit: number = 100, story?: string, owner?: string) => {
  const {
    setup: { store },
  } = useGame();
  const streamed = useStoryEventsStore((state) => state.streamed);
  const shard = requireShard(getActiveGame()?.chainId);
  const gameId = configManager.getActiveGameId();
  const scope = { chainId: shard.chainId, worldAddress: shard.worldAddress, gameId };
  const scopeKey = storyEventScopeKey(scope);

  const confirmedBlock = useConnectionStore((state) => (story ? state.lastConfirmedBlock : null));
  const handshake = useConnectionStore((state) => (story ? state.lastGlobalHandshake : null));

  const query = useQuery({
    queryKey: ["heraldStoryEvents", shard.url, scopeKey, limit, story, owner],
    queryFn: async (): Promise<StoryEventData[]> => {
      const page = await fetchHeraldGameHistory(shard, gameId, {
        limit,
        ...(story ? (EVENT_MODELS.has(story) ? { model: story } : { model: "StoryEvent", story }) : {}),
        owner,
      });
      return page.items.flatMap((event) => {
        const story = historyStoryEvent(event, scope);
        return story ? [story] : [];
      });
    },
    staleTime: Number.POSITIVE_INFINITY,
    ...(story ? { retry: false, retryOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false } : {}),
  });

  const { refetch, isError } = query;
  useEffect(() => {
    // Filtered history must recover battles after they leave the mixed stream ring.
    if (story && !isError) void refetch({ cancelRefetch: false });
  }, [confirmedBlock, handshake, story, refetch, isError]);

  const data = useMemo(() => {
    const events = new Map<string, StoryEventData>();
    for (const event of [...streamed, ...(query.data ?? [])]) {
      if (event.scopeKey !== scopeKey || (story && event.story !== story)) continue;
      if (owner && (event.owner === null || BigInt(event.owner) !== BigInt(owner))) continue;
      const previous = events.get(event.event_id);
      if (!previous || eventConfirmationRank(event.confirmation) > eventConfirmationRank(previous.confirmation))
        events.set(event.event_id, event);
    }
    return [...events.values()]
      .sort((left, right) => Number(BigInt(right.timestamp) - BigInt(left.timestamp)))
      .slice(0, limit)
      .map((event) => processStoryEvent(event, store));
  }, [store, limit, query.data, streamed, story, scopeKey, owner]);

  return { ...query, data };
};
