import { fetchHeraldGameHistory } from "@/runtime/world/herald-http";
import { getDefaultWorld, getWorldById } from "@/runtime/world/world-directory";
import { getActiveWorld } from "@/runtime/world";
import { buildStoryEventPresentation, configManager } from "@bibliothecadao/eternum";
import type { GameSyncEntity, HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import { useDojo } from "@bibliothecadao/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { create } from "zustand";

interface StoryEventData {
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
  revision: number;
  streamed: StreamStoryEvent[];
  accept: (event: StreamStoryEvent) => void;
  reset: () => void;
}

const STREAM_EVENT_LIMIT = 512;

const useStoryEventsStore = create<StoryEventsState>((set) => ({
  revision: 0,
  streamed: [],
  accept: (event) =>
    set((state) => ({
      streamed: [event, ...state.streamed.filter((existing) => existing.event_id !== event.event_id)].slice(
        0,
        STREAM_EVENT_LIMIT,
      ),
      revision: state.revision + 1,
    })),
  reset: () => set({ revision: 0, streamed: [] }),
}));

export const useStoryEventRevision = (): number => useStoryEventsStore((state) => state.revision);

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

const storyEventFromValue = (
  value: Record<string, unknown>,
  eventId: string,
  fallbackTransactionHash: string,
): StreamStoryEvent | null => {
  const variant = storyVariant(value.story);
  if (!variant) return null;
  const transactionHash = String(value.tx_hash ?? fallbackTransactionHash);
  return {
    owner: value.owner === null || value.owner === undefined ? null : String(value.owner),
    entity_id: toOptionalNumber(value.entity_id),
    id: value.id === undefined ? null : String(value.id),
    tx_hash: transactionHash,
    story: variant.type,
    timestamp: String(value.timestamp ?? "0x0"),
    event_id: eventId,
    storyPayload: variant.payload,
    rawStory: value.story,
    ...legacyHeadlineFields(variant.type, variant.payload),
  };
};

export const toStreamStoryEvent = (event: GameSyncEntity): StreamStoryEvent | null => {
  const modelEntry = Object.entries(event.models).find(
    ([model]) => model === "StoryEvent" || model.endsWith("-StoryEvent"),
  );
  const value = modelEntry ? asRecord(modelEntry[1]) : null;
  return value ? storyEventFromValue(value, `${event.hashed_keys}:${String(value.tx_hash ?? "0x0")}`, "0x0") : null;
};

const historyStoryEvent = (event: HeraldHistoryEvent): StreamStoryEvent | null =>
  storyEventFromValue(event.value, `${event.transaction_hash}:${event.event_index}`, event.transaction_hash);

export const acceptGameSyncStoryEvent = (event: GameSyncEntity): void => {
  const storyEvent = toStreamStoryEvent(event);
  if (storyEvent) useStoryEventsStore.getState().accept(storyEvent);
};

export const resetGameSyncStoryEvents = (): void => useStoryEventsStore.getState().reset();

const processStoryEvent = (
  event: StoryEventData | StreamStoryEvent,
  index: number,
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
  );
  const id = event.event_id ?? `${event.tx_hash}-${event.timestamp}-${event.entity_id ?? "unknown"}-${index}`;
  return { ...event, id, timestampMs, presentation };
};

export const useStoryEvents = (limit: number = 100) => {
  const {
    setup: { components },
  } = useDojo();
  const streamed = useStoryEventsStore((state) => state.streamed);
  const profile = getActiveWorld();
  const world = getWorldById(profile?.worldId ?? "blitz") ?? getDefaultWorld();
  const gameId = configManager.getActiveGameId();

  const query = useQuery({
    queryKey: ["heraldStoryEvents", world.id, gameId, limit],
    queryFn: async (): Promise<StoryEventData[]> => {
      const page = await fetchHeraldGameHistory(world, gameId, { limit, model: "StoryEvent" });
      return page.items.flatMap((event) => {
        const story = historyStoryEvent(event);
        return story ? [story] : [];
      });
    },
    staleTime: Number.POSITIVE_INFINITY,
  });

  const data = useMemo(() => {
    const identities = new Set<string>();
    return [...streamed, ...(query.data ?? [])]
      .filter((event) => {
        const identity = event.event_id ?? `${event.tx_hash}:${event.timestamp}`;
        if (identities.has(identity)) return false;
        identities.add(identity);
        return true;
      })
      .slice(0, limit)
      .map((event, index) => processStoryEvent(event, index, components));
  }, [components, limit, query.data, streamed]);

  return { ...query, data };
};
