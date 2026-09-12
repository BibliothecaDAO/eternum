import { getPlayerName } from "@/hooks/use-player-profile";
import { fetchHeraldGameHistory } from "@/runtime/world/herald-http";
import { getDefaultWorld, getWorldById } from "@/runtime/world/world-directory";
import { getActiveWorld } from "@/runtime/world";
import { buildStoryEventPresentation, configManager } from "@bibliothecadao/eternum";
import type { GameSyncEntity, HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import { storyEventIdentity, storyEventScopeKey, type StoryEventScope } from "@bibliothecadao/eternum/game-sync";
import { useDojo } from "@bibliothecadao/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { useConnectionStore } from "./use-connection-store";

interface StoryEventData {
  scopeKey: string;
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
    set((state) => ({
      streamed: [event, ...state.streamed.filter((existing) => existing.event_id !== event.event_id)].slice(
        0,
        STREAM_EVENT_LIMIT,
      ),
    })),
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
  return { type: entry[0], payload: asRecord(entry[1]) ?? {} };
};

const legacyHeadlineFields = (type: string, payload: Record<string, unknown>): Record<string, unknown> => {
  if (type === "BattleStory") {
    return Object.fromEntries(Object.entries(payload).map(([key, value]) => [`battle_${key}`, value]));
  }
  if (type === "ExplorerCreateStory") {
    return Object.fromEntries(Object.entries(payload).map(([key, value]) => [`explorer_create_${key}`, value]));
  }
  return {};
};

// The leaderboard carries registered points; the log does not repeat them as a story.
const STORIES_OUTSIDE_THE_LOG = new Set(["PointsRegisteredStory"]);

const storyEventFromValue = (value: Record<string, unknown>, scope: StoryEventScope): StreamStoryEvent | null => {
  const variant = storyVariant(value.story);
  if (!variant || STORIES_OUTSIDE_THE_LOG.has(variant.type)) return null;
  return {
    scopeKey: storyEventScopeKey(scope),
    owner: value.owner === null || value.owner === undefined ? null : String(value.owner),
    entity_id: toOptionalNumber(value.entity_id),
    id: value.id === undefined ? null : String(value.id),
    tx_hash: String(value.tx_hash),
    story: variant.type,
    timestamp: String(value.timestamp ?? "0x0"),
    event_id: storyEventIdentity(scope, value),
    storyPayload: variant.payload,
    rawStory: value.story,
    ...legacyHeadlineFields(variant.type, variant.payload),
  };
};

export const toStreamStoryEvent = (event: GameSyncEntity, scope: StoryEventScope): StreamStoryEvent | null => {
  const modelEntry = Object.entries(event.models).find(
    ([model]) => model === "StoryEvent" || model.endsWith("-StoryEvent"),
  );
  const value = modelEntry ? asRecord(modelEntry[1]) : null;
  return value ? storyEventFromValue(value, scope) : null;
};

const historyStoryEvent = (event: HeraldHistoryEvent, scope: StoryEventScope): StreamStoryEvent | null =>
  storyEventFromValue(event.value, scope);

export const acceptGameSyncStoryEvent = (event: GameSyncEntity, scope: StoryEventScope): void => {
  const storyEvent = toStreamStoryEvent(event, scope);
  if (storyEvent) useStoryEventsStore.getState().accept(storyEvent);
};

export const resetGameSyncStoryEvents = (): void => useStoryEventsStore.getState().reset();

const processStoryEvent = (
  event: StoryEventData | StreamStoryEvent,
  components: Parameters<typeof buildStoryEventPresentation>[1],
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
    components,
    getPlayerName,
  );
  return { ...event, id: event.event_id, timestampMs, presentation };
};

export const useStoryEvents = (limit: number = 100, story?: string) => {
  const {
    setup: { components },
  } = useDojo();
  const streamed = useStoryEventsStore((state) => state.streamed);
  const profile = getActiveWorld();
  const world = getWorldById(profile?.worldId ?? "blitz") ?? getDefaultWorld();
  const gameId = configManager.getActiveGameId();
  const scope = { chain: world.chain, worldAddress: world.worldAddress, gameId };
  const scopeKey = storyEventScopeKey(scope);

  const confirmedBlock = useConnectionStore((state) => (story ? state.lastConfirmedBlock : null));
  const handshake = useConnectionStore((state) => (story ? state.lastGlobalHandshake : null));

  const query = useQuery({
    queryKey: ["heraldStoryEvents", world.heraldBaseUrl, scopeKey, limit, story],
    queryFn: async (): Promise<StoryEventData[]> => {
      const page = await fetchHeraldGameHistory(world, gameId, { limit, model: "StoryEvent", story });
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
    const identities = new Set<string>();
    return [...streamed, ...(query.data ?? [])]
      .filter((event) => event.scopeKey === scopeKey)
      .filter((event) => !story || event.story === story)
      .filter((event) => {
        const identity = event.event_id;
        if (identities.has(identity)) return false;
        identities.add(identity);
        return true;
      })
      .sort((left, right) => Number(BigInt(right.timestamp) - BigInt(left.timestamp)))
      .slice(0, limit)
      .map((event) => processStoryEvent(event, components));
  }, [components, limit, query.data, streamed, story, scopeKey]);

  return { ...query, data };
};
