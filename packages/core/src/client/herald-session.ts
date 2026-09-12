import type { SetupResult } from "@bibliothecadao/dojo";
import type { GameChain } from "@realms-world/chain";

import type {
  GameSyncEntity,
  GameSyncHead,
  GameSyncRuntimeMetrics,
  GameSyncSessionStart,
  GameSyncSnapshotProgress,
} from "../sync/game-sync-types";
import { HeraldGameSyncTransport, type HeraldSocket } from "../sync/herald-game-sync-transport";
import type { GameSyncScheduler } from "../sync/scheduler";
import type { StoryEventScope } from "../sync/story-event-identity";
import { createRecsGameSyncStore } from "./recs-game-sync-store";

export type GameSyncSnapshotPhase = GameSyncSnapshotProgress["phase"];

/**
 * What a client wants to know about its boot and Herald session beyond the rows landing in RECS. The web client
 * feeds its stores, progress bar, and entry timeline from these; a headless client may log them or ignore them.
 * Every field is optional.
 */
export interface GameClientObserver {
  /** setup() finished: components and the provider exist, the Herald session has not started. */
  onSetupCompleted?: (setup: SetupResult) => void;
  /** The Herald subscription is active; the snapshot follows. */
  onSubscriptionActive?: () => void;
  /** A live delivery arrived: liveness, not content. */
  onLiveUpdate?: (kind: "entity" | "event") => void;
  /** A live entity batch failed to apply; the stream is no longer trustworthy. */
  onLiveApplyFailed?: (error: Error) => void;
  /** Herald reported a head: a confirmed block, or the pre-confirmed sequencer clock. */
  onHead?: (head: GameSyncHead) => void;
  /** A story event row arrived on the live stream, scoped to the chain, world and game it belongs to. */
  onStoryEvent?: (event: GameSyncEntity, scope: StoryEventScope) => void;
  /** A new session starts; story events from the previous one are stale. */
  onStoryEventsReset?: () => void;
  /** The diff for a submitted transaction reached the client. */
  onDiffReceived?: (transactionHash: string) => void;
  /** The diff for a submitted transaction is in RECS. */
  onRecsApplied?: (transactionHash: string) => void;
  onMetrics?: (metrics: GameSyncRuntimeMetrics) => void;
  onSnapshotProgress?: (progress: GameSyncSnapshotProgress) => void;
  onSnapshotPhaseStarted?: (phase: GameSyncSnapshotPhase) => void;
  onSnapshotPhaseCompleted?: (phase: GameSyncSnapshotPhase, durationMs: number) => void;
}

export interface CreateHeraldGameSyncSessionInput {
  baseUrl: string;
  chain: GameChain;
  entityModels: readonly string[];
  eventModels: readonly string[];
  gameId: number;
  worldAddress: string;
  observer?: GameClientObserver;
  scheduler: GameSyncScheduler;
  setup: SetupResult;
  socketFactory?: (url: string) => HeraldSocket;
}

const createSnapshotProgressObserver = (
  observer: GameClientObserver,
): ((progress: GameSyncSnapshotProgress) => void) => {
  const startedAt = new Map<GameSyncSnapshotPhase, number>();
  const completed = new Set<GameSyncSnapshotPhase>();

  return (progress) => {
    if (!startedAt.has(progress.phase)) {
      startedAt.set(progress.phase, performance.now());
      observer.onSnapshotPhaseStarted?.(progress.phase);
    }
    const phaseDone = !progress.streaming && progress.total > 0 && progress.completed >= progress.total;
    if (phaseDone && !completed.has(progress.phase)) {
      completed.add(progress.phase);
      observer.onSnapshotPhaseCompleted?.(progress.phase, performance.now() - startedAt.get(progress.phase)!);
    }
    observer.onSnapshotProgress?.(progress);
  };
};

export function createHeraldGameSyncSession(input: CreateHeraldGameSyncSessionInput): GameSyncSessionStart {
  const observer = input.observer ?? {};
  const scope: StoryEventScope = { chain: input.chain, worldAddress: input.worldAddress, gameId: input.gameId };
  observer.onStoryEventsReset?.();
  const syncModels = [...input.entityModels, ...input.eventModels];
  return {
    onLiveUpdate: observer.onLiveUpdate,
    onError: (error) => {
      observer.onLiveApplyFailed?.(error);
      console.error(`[GameSync] live entity apply failed: ${error.message}`);
    },
    onEvent: (event) => observer.onStoryEvent?.(event, scope),
    onMetrics: observer.onMetrics,
    onSnapshotProgress: createSnapshotProgressObserver(observer),
    onTransactionEntitiesApplied: observer.onRecsApplied,
    onTransactionEntitiesReceived: observer.onDiffReceived,
    onSubscriptionActive: observer.onSubscriptionActive,
    onHead: observer.onHead,
    scheduler: input.scheduler,
    snapshotModels: input.entityModels,
    store: createRecsGameSyncStore(input.setup, syncModels),
    transport: new HeraldGameSyncTransport({
      socketFactory: input.socketFactory,
      url: buildHeraldGameStreamUrl(input.baseUrl, input.chain, input.gameId),
    }),
  };
}

export function buildHeraldGameStreamUrl(baseUrl: string, chain: GameChain, gameId: number): string {
  if (!Number.isSafeInteger(gameId) || gameId <= 0) {
    throw new Error(`Herald requires a positive game id; received ${gameId}`);
  }

  const url = new URL(baseUrl);
  if (url.protocol === "http:") url.protocol = "ws:";
  else if (url.protocol === "https:") url.protocol = "wss:";
  else if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error(`Herald requires an HTTP or WebSocket URL; received ${url.protocol}`);
  }

  const prefix = url.pathname.replace(/\/+$/, "");
  url.pathname = `${prefix}/${chain}/games/${gameId}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}
