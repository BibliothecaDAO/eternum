import { getPlayerName } from "@/hooks/use-player-profile";
import { fetchHeraldGameHistory, requireShard, storyParticipants } from "@bibliothecadao/eternum/game-client";
import { storyPayloadId } from "@/utils/native-id";
import { getActiveGame } from "@/runtime/world";
import { buildStoryEventPresentation, configManager, hasStoryPresentation } from "@bibliothecadao/eternum";
import * as Sentry from "@sentry/react";
import type { GameSyncEvent, HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import {
  eventConfirmationRank,
  storyEventIdentity,
  storyEventScopeKey,
  type GameSyncEventConfirmation,
  type StoryEventScope,
} from "@bibliothecadao/eternum/game-sync";
import { useGame } from "@/hooks/context/game-context";
import { type UseQueryResult, useQueries, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { useAccountAddress } from "./use-account-store";
import { useConnectionStore } from "./use-connection-store";

/** Where a story's event sits on the chain; a pre-confirmed one has no block yet. */
interface ChainPosition {
  block: number | null;
  transactionIndex: number;
  eventIndex: number;
}

interface StoryEventData {
  scopeKey: string;
  confirmation: GameSyncEventConfirmation | null;
  position: ChainPosition;
  entity_id: number | null;
  event_id: string;
  owner: string | null;
  /** Every player the story names (`storyParticipants`), the set Herald's history filters a player's read by. */
  participants: string[];
  /** Every entity the story names (`storyParticipants`), the set Herald's history filters an entity's read by. */
  entities: string[];
  /**
   * The stream generation (the connection's last handshake) a streamed story arrived in; null when read from history.
   * A reconnect or a replacement snapshot starts a new generation, so what an older stream delivered proves nothing
   * about the facts the new one brings.
   */
  streamGeneration: number | null;
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

/** A story's entity id, exact or loud: a malformed one is a broken story, never a silently missing entity. */
const storyEntityId = (value: unknown): number | null =>
  value === null || value === undefined ? null : storyPayloadId(value);

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
  const eventId = storyEventIdentity(scope, value);
  // An event names its transaction and its place on the chain by its position, and carries the chain's timestamp.
  // Missing any of them is a malformed event, never "undefined", the epoch or the first place.
  const position = asRecord(value.event_position);
  const transactionHash = position?.transaction_hash ?? value.tx_hash;
  const chainPosition = position ? chainPositionOf(position) : null;
  if (
    typeof transactionHash !== "string" ||
    !chainPosition ||
    value.timestamp === undefined ||
    value.timestamp === null
  ) {
    throw new Error(`${model} arrived without its transaction, chain position or timestamp`);
  }
  const owner = value.owner ?? value.player ?? asRecord(value.attacker)?.player;
  const named = storyParticipants(value);
  return {
    scopeKey: storyEventScopeKey(scope),
    confirmation: confirmation ?? null,
    position: chainPosition,
    owner: owner === null || owner === undefined ? null : String(owner),
    participants: named.owners,
    entities: named.entities,
    streamGeneration: null,
    entity_id: storyEntityId(value.entity_id ?? value.explorer_id ?? value.attacker_id),
    tx_hash: transactionHash,
    story: variant.type,
    timestamp: String(value.timestamp),
    event_id: eventId,
    storyPayload: variant.payload,
    rawStory: value.story,
  };
};

export const toStreamStoryEvent = (
  event: GameSyncEvent,
  scope: StoryEventScope,
  confirmation?: GameSyncEventConfirmation,
): StreamStoryEvent | null => {
  const story = EVENT_MODELS.has(event.model)
    ? storyEventFromValue(event.model, event.value, scope, confirmation)
    : null;
  return story && { ...story, streamGeneration: useConnectionStore.getState().lastGlobalHandshake };
};

const chainPositionOf = (position: Record<string, unknown>): ChainPosition | null => {
  const { block_number: block, transaction_index: transactionIndex, event_index: eventIndex } = position;
  const isIndex = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
  if ((block !== null && !isIndex(block)) || !isIndex(transactionIndex) || !isIndex(eventIndex)) return null;
  return { block, transactionIndex, eventIndex };
};

const historyStoryEvent = (event: HeraldHistoryEvent, scope: StoryEventScope): StreamStoryEvent | null =>
  storyEventFromValue(
    event.model,
    {
      ...event.value,
      event_position: {
        block_number: event.block_number,
        transaction_hash: event.transaction_hash,
        transaction_index: event.transaction_index,
        event_index: event.event_index,
      },
    },
    scope,
    { block: event.block_number, preconfirmed: false },
  );

export const acceptGameSyncStoryEvent = (
  event: GameSyncEvent,
  scope: StoryEventScope,
  confirmation?: GameSyncEventConfirmation,
): void => {
  const storyEvent = toStreamStoryEvent(event, scope, confirmation);
  if (storyEvent) useStoryEventsStore.getState().accept(storyEvent);
};

export const resetGameSyncStoryEvents = (): void => useStoryEventsStore.getState().reset();

/** The streamed stories of one transaction: an action's own record, read once its outcome is known. */
export const streamedStoriesOf = (transactionHash: string): StreamStoryEvent[] => {
  const transaction = BigInt(transactionHash);
  return useStoryEventsStore.getState().streamed.filter((event) => BigInt(event.tx_hash) === transaction);
};

/**
 * A story the current enum has no line for, such as a variant retired since an older pinned schema wrote it into
 * history, never renders raw. Outside production it is an error; in production that one row is dropped and reported,
 * so immutable history cannot take the log down.
 */
export const isPresentableStory = (event: Pick<StoryEventData, "story">): boolean => {
  if (hasStoryPresentation(event.story)) return true;
  const error = new Error(`No presentation for story ${event.story}`);
  if (!import.meta.env.PROD) throw error;
  console.error(`[story events] dropped a ${event.story} row: it has no presentation`);
  Sentry.captureException(error, { tags: { story: event.story } });
  return false;
};

/** A story as the viewer reads it: its words name the viewer "you" where it names them. */
const processStoryEvent = (
  event: StoryEventData | StreamStoryEvent,
  store: Parameters<typeof buildStoryEventPresentation>[1],
  viewerAddress: string | null,
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
      viewerAddress,
    },
    store,
    getPlayerName,
  );
  return { ...event, id: event.event_id, timestampMs, presentation };
};

/**
 * One read of the game's stories, as Herald's history filters it: the newest `limit`, optionally of one story, naming
 * one player, or about one entity.
 */
export interface StoryRead {
  limit: number;
  story?: string;
  owner?: string;
  entityId?: number;
}

/**
 * Whether a story belongs to a read, by the same rule Herald's history applies: a player read keeps every story naming
 * them, an entity read every story naming it.
 */
const matchesRead = (event: StoryEventData, scopeKey: string, read: StoryRead): boolean =>
  event.scopeKey === scopeKey &&
  (!read.story || event.story === read.story) &&
  (!read.owner || namesPlayer(event, BigInt(read.owner))) &&
  (read.entityId === undefined || event.entities.includes(String(read.entityId)));

const namesPlayer = (event: StoryEventData, player: bigint): boolean =>
  [event.owner, ...event.participants].some((address) => address !== null && BigInt(address) === player);

/**
 * Newest first by place on the chain: a pre-confirmed story (no block yet) above every block, then block, transaction
 * and event, the order the contract wrote them in. Never by time: one block holds many stories at one timestamp.
 */
const newestOnChainFirst = (left: StoryEventData, right: StoryEventData): number =>
  blockRank(right.position) - blockRank(left.position) ||
  right.position.transactionIndex - left.position.transactionIndex ||
  right.position.eventIndex - left.position.eventIndex;

const blockRank = (position: ChainPosition): number => position.block ?? Number.MAX_SAFE_INTEGER;

/** The latest `limit` stories, each once at its most confirmed copy, newest on the chain first. */
const latestStories = (events: StoryEventData[], limit: number): StoryEventData[] => {
  const latest = new Map<string, StoryEventData>();
  for (const event of events) {
    const previous = latest.get(event.event_id);
    if (!previous || eventConfirmationRank(event.confirmation) > eventConfirmationRank(previous.confirmation))
      latest.set(event.event_id, event);
  }
  return [...latest.values()].toSorted(newestOnChainFirst).slice(0, limit);
};

/** A read's stories, and the block Herald's history held every story through when it answered (null: not known). */
interface StoryReadPage {
  stories: StoryEventData[];
  completeThroughBlock: number | null;
}

/** A read's page of Herald's history, as stories. */
const fetchStoryRead = async (
  shard: ReturnType<typeof requireShard>,
  scope: StoryEventScope,
  { limit, story, owner, entityId }: StoryRead,
): Promise<StoryReadPage> => {
  const page = await fetchHeraldGameHistory(shard, scope.gameId, {
    limit,
    ...(story ? (EVENT_MODELS.has(story) ? { model: story } : { model: "StoryEvent", story }) : {}),
    owner,
    entityId,
  });
  const stories = page.items.flatMap((event) => {
    const story = historyStoryEvent(event, scope);
    return story ? [story] : [];
  });
  return { stories, completeThroughBlock: page.complete_through_block };
};

/** Each read's query as it stands: React Query keeps the list the same object until one of them changes. */
const sameResults = (results: UseQueryResult<StoryReadPage>[]) => results;

/**
 * Stories as the stream delivers them, recovered from Herald's history: each read fetches history at each handshake
 * (the first connect and every reconnect), never on a block, and keeps what the stream delivers for it, so a story
 * outlives the stream's mixed ring. Each read keeps its own newest `limit`, so what one leaves out never takes another's
 * room; the reads' stories come back together, each once, newest on the chain first.
 */
export const useStoryReads = (reads: StoryRead[]) => {
  const {
    setup: { store },
  } = useGame();
  const streamed = useStoryEventsStore((state) => state.streamed);
  const viewer = useAccountAddress();
  const viewerAddress = viewer === null ? null : `0x${viewer.toString(16)}`;
  const shard = requireShard(getActiveGame()?.chainId);
  const scope = { chainId: shard.chainId, worldAddress: shard.worldAddress, gameId: configManager.getActiveGameId() };
  const scopeKey = storyEventScopeKey(scope);
  const handshake = useConnectionStore((state) => state.lastGlobalHandshake);
  const queryClient = useQueryClient();
  const queryKeys = reads.map(({ limit, story, owner, entityId }) => [
    "heraldStoryEvents",
    shard.url,
    scopeKey,
    limit,
    story,
    owner,
    entityId,
  ]);
  const readsKey = JSON.stringify(queryKeys);

  const queries = useQueries({
    queries: reads.map((read, index) => ({
      queryKey: queryKeys[index],
      queryFn: () => fetchStoryRead(shard, scope, read),
      staleTime: Number.POSITIVE_INFINITY,
      ...(read.story
        ? { retry: false, retryOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false }
        : {}),
    })),
    combine: sameResults,
  });

  useEffect(() => {
    for (const query of queries) if (!query.isError) void query.refetch({ cancelRefetch: false });
  }, [handshake, readsKey]);

  const delivered = useMemo(
    () => reads.map((read) => streamed.filter((event) => matchesRead(event, scopeKey, read))),
    [streamed, scopeKey, readsKey],
  );
  // Each read's key follows the same filter, so a new delivery is the one thing that changes what it keeps.
  useEffect(() => {
    reads.forEach((read, index) => {
      if (delivered[index].length === 0) return;
      queryClient.setQueryData<StoryReadPage>(
        queryKeys[index],
        (held) => held && { ...held, stories: latestStories([...delivered[index], ...held.stories], read.limit) },
      );
    });
  }, [delivered]);

  const data = useMemo(
    () =>
      latestStories(
        reads.flatMap((read, index) =>
          latestStories([...delivered[index], ...(queries[index].data?.stories ?? [])], read.limit),
        ),
        Number.POSITIVE_INFINITY,
      )
        .filter(isPresentableStory)
        .map((event) => processStoryEvent(event, store, viewerAddress)),
    [store, queries, delivered, viewerAddress],
  );

  return { data, queries };
};

/** One story read: its stories, its query's status, and the block its history was complete through. */
export const useStoryEvents = (limit: number = 100, story?: string, owner?: string) => {
  const {
    data,
    queries: [query],
  } = useStoryReads([{ limit, story, owner }]);
  return { ...query, data, completeThroughBlock: query.data?.completeThroughBlock ?? null };
};

/** The season's winner once its SeasonEnded story is in history; null until then. */
export const useSeasonWinner = (): bigint | null => {
  const { data: ended } = useStoryEvents(1, "SeasonEnded");
  const winner = ended[0]?.owner;
  return winner ? BigInt(winner) : null;
};
