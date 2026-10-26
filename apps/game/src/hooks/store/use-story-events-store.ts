import { type PlayerNames, usePlayerNames } from "@/hooks/use-player-profile";
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
import { useLatest } from "@/hooks/use-latest";
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

/** One event of Herald's history as the story the stream would have delivered. */
export const historyStoryEvent = (event: HeraldHistoryEvent, scope: StoryEventScope): StreamStoryEvent | null =>
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
export const processStoryEvent = (
  event: StoryEventData | StreamStoryEvent,
  store: Parameters<typeof buildStoryEventPresentation>[1],
  viewerAddress: string | null,
  playerName: PlayerNames["text"],
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
    playerName,
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
  /**
   * The read must hold every story through the block the store's facts were last read at (the connection store's
   * snapshotBlock). An answer behind that block is read again once a newer snapshot or confirmed head than the one it
   * was asked under arrives, so recovery belongs to the snapshot applied now, whatever order the two arrive in.
   */
  coverSnapshot?: boolean;
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

/** A read's stories, the block Herald's history held every story through when it answered (null: not known), and
 * the recovery signals that stood when it was asked. */
interface StoryReadPage {
  stories: StoryEventData[];
  completeThroughBlock: number | null;
  askedUnder: RecoverySignals;
}

/** What can let history behind the snapshot catch up: a newer snapshot to cover, or a newer confirmed head Herald
 * folded into its history. */
interface RecoverySignals {
  snapshotBlock: number | null;
  confirmedHead: number | null;
}

const recoverySignalsOf = ({
  snapshotBlock,
  lastConfirmedBlock,
}: Pick<ReturnType<typeof useConnectionStore.getState>, "snapshotBlock" | "lastConfirmedBlock">): RecoverySignals => ({
  snapshotBlock,
  confirmedHead: lastConfirmedBlock,
});

const currentRecoverySignals = (): RecoverySignals => recoverySignalsOf(useConnectionStore.getState());

/** A read that failed, and the handshake it was asked under: the next handshake asks it again, once. */
class StoryReadFailed extends Error {
  constructor(
    readonly askedAtHandshake: number,
    cause: unknown,
  ) {
    super("Herald's history did not answer a story read", { cause });
  }
}

/**
 * Whether a read owes the handshake one attempt: it settled on a failure asked under an older handshake, whether it
 * failed before the handshake came or was still pending when it came and failed after.
 */
const owesAttempt = (query: UseQueryResult<StoryReadPage>, handshake: number): boolean =>
  !query.isFetching && query.error instanceof StoryReadFailed && query.error.askedAtHandshake < handshake;

/** A read's page of Herald's history, as stories. */
const fetchStoryRead = async (
  shard: ReturnType<typeof requireShard>,
  scope: StoryEventScope,
  { limit, story, owner, entityId }: StoryRead,
): Promise<StoryReadPage> => {
  const askedUnder = currentRecoverySignals();
  const askedAtHandshake = useConnectionStore.getState().lastGlobalHandshake;
  const page = await fetchHeraldGameHistory(shard, scope.gameId, {
    limit,
    ...(story ? (EVENT_MODELS.has(story) ? { model: story } : { model: "StoryEvent", story }) : {}),
    owner,
    entityId,
  }).catch((cause: unknown) => {
    throw new StoryReadFailed(askedAtHandshake, cause);
  });
  const stories = page.items.flatMap((event) => {
    const story = historyStoryEvent(event, scope);
    return story ? [story] : [];
  });
  return { stories, completeThroughBlock: page.complete_through_block, askedUnder };
};

/**
 * A history answer as it replaces what its read holds: it decides every story up to the block its history was complete
 * through, and none after. A confirmed story the read already holds beyond that block (the stream delivered it, maybe
 * since gone from the stream's ring) stays; all of them stay when Herald does not know its coverage. A pre-confirmed one
 * does not: only the stream can confirm it or let it go.
 */
const answerOverHeld = (answer: StoryReadPage, held: StoryReadPage | undefined, limit: number): StoryReadPage => {
  const through = answer.completeThroughBlock;
  const beyond = (held?.stories ?? []).filter(
    ({ position: { block } }) => block !== null && (through === null || block > through),
  );
  return { ...answer, stories: latestStories([...beyond, ...answer.stories], limit) };
};

/** An answer that holds history through a block before the snapshot applied now: it cannot vouch for those facts. */
const isBehindSnapshot = (page: StoryReadPage, snapshotBlock: number | null): boolean =>
  snapshotBlock !== null && page.completeThroughBlock !== null && page.completeThroughBlock < snapshotBlock;

const signalsMovedSince = (page: StoryReadPage, now: RecoverySignals): boolean =>
  page.askedUnder.snapshotBlock !== now.snapshotBlock || page.askedUnder.confirmedHead !== now.confirmedHead;

/**
 * A settled answer behind the snapshot is worth reading again only under a signal it was not asked under: the same
 * history asked again answers the same. A failed read waits for the next handshake; one whose coverage Herald does not
 * know stays as it is, and the read stays incomplete.
 */
const shouldCatchUp = (query: UseQueryResult<StoryReadPage>, now: RecoverySignals): boolean =>
  query.data !== undefined &&
  !query.isFetching &&
  !query.isError &&
  isBehindSnapshot(query.data, now.snapshotBlock) &&
  signalsMovedSince(query.data, now);

const owesCatchUp = (read: StoryRead, query: UseQueryResult<StoryReadPage>, now: RecoverySignals): boolean =>
  Boolean(read.coverSnapshot) && shouldCatchUp(query, now);

/** Which reads owe a catch-up now, each by the answer it would replace: the same key renders nothing. */
const catchUpKeyOf = (reads: StoryRead[], queries: UseQueryResult<StoryReadPage>[], now: RecoverySignals): string =>
  queries.map((query, index) => (owesCatchUp(reads[index], query, now) ? query.dataUpdatedAt : "-")).join();

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
  // A story's words name its players by the one rule, so they are written again whenever a name may have changed.
  const names = usePlayerNames();
  const viewer = useAccountAddress();
  const viewerAddress = viewer === null ? null : `0x${viewer.toString(16)}`;
  const shard = requireShard(getActiveGame()?.chainId);
  const scope = { chainId: shard.chainId, worldAddress: shard.worldAddress, gameId: configManager.getActiveGameId() };
  const scopeKey = storyEventScopeKey(scope);
  const handshake = useConnectionStore((state) => state.lastGlobalHandshake);
  const queryClient = useQueryClient();
  // The reads by value: a caller writes a new list on every render.
  const readsByValue = JSON.stringify(reads);
  const stableReads = useMemo((): StoryRead[] => JSON.parse(readsByValue), [readsByValue]);
  const queryKeys = useMemo(
    () =>
      stableReads.map(({ limit, story, owner, entityId }) => [
        "heraldStoryEvents",
        shard.url,
        scopeKey,
        limit,
        story,
        owner,
        entityId,
      ]),
    [stableReads, shard.url, scopeKey],
  );

  const queries = useQueries({
    queries: stableReads.map((read, index) => ({
      queryKey: queryKeys[index],
      queryFn: async () =>
        answerOverHeld(
          await fetchStoryRead(shard, scope, read),
          queryClient.getQueryData<StoryReadPage>(queryKeys[index]),
          read.limit,
        ),
      staleTime: Number.POSITIVE_INFINITY,
      ...(read.story
        ? { retry: false, retryOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false }
        : {}),
    })),
    combine: sameResults,
  });

  // The effects below run on their own signals and act on the reads as they stand then.
  const current = useLatest({ queries, handshake });
  // Each handshake asks every read that holds an answer again.
  useEffect(() => {
    for (const query of current.current.queries) if (!query.isError) void query.refetch({ cancelRefetch: false });
  }, [handshake, queryKeys, current]);
  // A failed read is asked once per handshake, as soon as it owes one: when the handshake comes, or when a request
  // older than it fails after. One asked under this handshake owes nothing, so a remount, a render or a head asks it
  // nothing, and a read that settles never makes its healthy peers ask again.
  const owedKey = queries.map((query) => owesAttempt(query, handshake)).join();
  useEffect(() => {
    const { queries, handshake } = current.current;
    for (const query of queries) if (owesAttempt(query, handshake)) void query.refetch({ cancelRefetch: false });
  }, [owedKey, queryKeys, current]);

  // A handshake that meets an older read in flight shares it, so a covering read's answer can land behind a snapshot
  // that overtook it; it then catches up once per signal it was not asked under, and never on its own answer. The store
  // is read through the catch-up it decides, not its blocks: a confirmed head comes about once a second, and one that
  // lets no read catch up renders nothing (a re-render here redraws every story the caller shows).
  const catchUpKey = useConnectionStore((state) => catchUpKeyOf(stableReads, queries, recoverySignalsOf(state)));
  useEffect(() => {
    const now = currentRecoverySignals();
    current.current.queries.forEach((query, index) => {
      if (owesCatchUp(stableReads[index], query, now)) void query.refetch({ cancelRefetch: false });
    });
  }, [catchUpKey, current, stableReads]);

  const delivered = useMemo(
    () => stableReads.map((read) => streamed.filter((event) => matchesRead(event, scopeKey, read))),
    [streamed, scopeKey, stableReads],
  );
  // Each read's key follows the same filter, so a new delivery is the one thing that changes what it keeps.
  useEffect(() => {
    stableReads.forEach((read, index) => {
      if (delivered[index].length === 0) return;
      queryClient.setQueryData<StoryReadPage>(
        queryKeys[index],
        (held) => held && { ...held, stories: latestStories([...delivered[index], ...held.stories], read.limit) },
      );
    });
  }, [delivered, stableReads, queryClient, queryKeys]);

  const data = useMemo(
    () =>
      latestStories(
        stableReads.flatMap((read, index) =>
          latestStories([...delivered[index], ...(queries[index].data?.stories ?? [])], read.limit),
        ),
        Number.POSITIVE_INFINITY,
      )
        .filter(isPresentableStory)
        .map((event) => processStoryEvent(event, store, viewerAddress, names.text)),
    [store, stableReads, queries, delivered, viewerAddress, names],
  );

  return { data, queries };
};

/**
 * One story read: its stories, its query's status, the block its history was complete through, and the time it holds
 * every story since (holdsSince).
 */
export const useStoryEvents = (limit: number = 100, story?: string, owner?: string, coverSnapshot = false) => {
  const {
    data,
    queries: [query],
  } = useStoryReads([{ limit, story, owner, coverSnapshot }]);
  return {
    ...query,
    data,
    completeThroughBlock: query.data?.completeThroughBlock ?? null,
    holdsSince: query.data && holdsSince(query.data.stories, limit),
  };
};

/**
 * The unix second from which a read holds every story it asked for: a read keeps only its newest `limit`, so a full one
 * reaches back no further than just after its oldest story (more may share that second); one with room holds them all.
 */
const holdsSince = (stories: readonly StoryEventData[], limit: number): number => {
  if (stories.length < limit) return 0;
  return Math.min(...stories.map((story) => Number(BigInt(story.timestamp)))) + 1;
};

/** The season's winner once its SeasonEnded story is in history; null until then. */
export const useSeasonWinner = (): bigint | null => {
  const { data: ended } = useStoryEvents(1, "SeasonEnded");
  const winner = ended[0]?.owner;
  return winner ? BigInt(winner) : null;
};
