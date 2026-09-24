import type { GameSyncModelDefinition } from "../sync/model-manifest";
import type { GameClientSetup } from "./game-client";

import type {
  GameSyncEvent,
  GameSyncEventConfirmation,
  GameSyncHead,
  GameSyncRuntimeMetrics,
  GameSyncSessionStart,
  GameSyncStore,
  GameSyncSnapshotProgress,
  GameSyncTransaction,
} from "../sync/game-sync-types";
import { HeraldGameSyncTransport, type HeraldSocket } from "../sync/herald-game-sync-transport";
import type { GameSyncScheduler } from "../sync/scheduler";
import type { StoryEventScope } from "../sync/story-event-identity";

export type GameSyncSnapshotPhase = GameSyncSnapshotProgress["phase"];

/**
 * What a client wants to know about its boot and Herald session beyond the rows landing in the store. The web client
 * feeds its stores, progress bar, and entry timeline from these; a headless client may log them or ignore them.
 * Every field is optional.
 */
export interface GameClientObserver {
  /** setup() finished: components and the provider exist, the Herald session has not started. */
  onSetupCompleted?: (setup: GameClientSetup) => void;
  /** The Herald subscription is active; the snapshot follows. */
  onSubscriptionActive?: () => void;
  /** A live delivery arrived: liveness, not content. */
  onLiveUpdate?: (kind: "entity" | "event") => void;
  /** A live entity batch failed to apply; the stream is no longer trustworthy. */
  onLiveApplyFailed?: (error: Error) => void;
  /** Herald reported a head: a confirmed block, or the pre-confirmed sequencer clock. */
  onHead?: (head: GameSyncHead) => void;
  /** Herald reported a transaction's status, pre-confirmed first and then confirmed with its block. */
  onTransaction?: (transaction: GameSyncTransaction) => void;
  /** A story event row arrived on the live stream, scoped to the chain, world and game it belongs to. */
  onStoryEvent?: (event: GameSyncEvent, scope: StoryEventScope, confirmation: GameSyncEventConfirmation) => void;
  /** A new session starts; story events from the previous one are stale. */
  onStoryEventsReset?: () => void;
  /** The diff for a submitted transaction reached the client. */
  onDiffReceived?: (transactionHash: string) => void;
  /** The diff for a submitted transaction is in the store. */
  onEntitiesApplied?: (transactionHash: string) => void;
  onMetrics?: (metrics: GameSyncRuntimeMetrics) => void;
  onSnapshotProgress?: (progress: GameSyncSnapshotProgress) => void;
  onSnapshotPhaseStarted?: (phase: GameSyncSnapshotPhase) => void;
  onSnapshotPhaseCompleted?: (phase: GameSyncSnapshotPhase, durationMs: number) => void;
  /** The first snapshot is in the store: its size, its transfer time and the time from its first frame to coherence. */
  onSnapshotCoherent?: (transfer: { bytes: number; transferMs: number; coherentMs: number }) => void;
}

export interface CreateHeraldGameSyncSessionInput {
  actor?: string;
  modelDefinition: (name: string) => GameSyncModelDefinition;
  baseUrl: string;
  chainId: string;
  entityModels: readonly string[];
  eventModels: readonly string[];
  gameId: number;
  worldAddress: string;
  observer?: GameClientObserver;
  scheduler: GameSyncScheduler;
  store: GameSyncStore;
  socketFactory?: (url: string) => HeraldSocket;
}

const createSnapshotProgressObserver = (
  observer: GameClientObserver,
): ((progress: GameSyncSnapshotProgress) => void) => {
  const startedAt = new Map<GameSyncSnapshotPhase, number>();
  const durations = new Map<GameSyncSnapshotPhase, number>();
  let bytes = 0;

  return (progress) => {
    if (!startedAt.has(progress.phase)) {
      startedAt.set(progress.phase, performance.now());
      observer.onSnapshotPhaseStarted?.(progress.phase);
    }
    bytes = progress.bytesReceived ?? bytes;
    const phaseDone = !progress.streaming && progress.total > 0 && progress.completed >= progress.total;
    if (phaseDone && !durations.has(progress.phase)) {
      const now = performance.now();
      durations.set(progress.phase, now - startedAt.get(progress.phase)!);
      observer.onSnapshotPhaseCompleted?.(progress.phase, durations.get(progress.phase)!);
      if (progress.phase === "applying")
        observer.onSnapshotCoherent?.({
          bytes,
          transferMs: durations.get("receiving") ?? 0,
          coherentMs: now - (startedAt.get("receiving") ?? startedAt.get("applying")!),
        });
    }
    observer.onSnapshotProgress?.(progress);
  };
};

export function createHeraldGameSyncSession(
  input: CreateHeraldGameSyncSessionInput,
): GameSyncSessionStart & { transport: HeraldGameSyncTransport } {
  const observer = input.observer ?? {};
  const scope: StoryEventScope = { chainId: input.chainId, worldAddress: input.worldAddress, gameId: input.gameId };
  observer.onStoryEventsReset?.();
  return {
    onLiveUpdate: observer.onLiveUpdate,
    onError: (error) => {
      observer.onLiveApplyFailed?.(error);
      console.error(`[GameSync] live entity apply failed: ${error.message}`);
    },
    onEvent: (event, confirmation) => observer.onStoryEvent?.(event, scope, confirmation),
    onMetrics: observer.onMetrics,
    onSnapshotProgress: createSnapshotProgressObserver(observer),
    onTransactionEntitiesApplied: observer.onEntitiesApplied,
    onTransactionEntitiesReceived: observer.onDiffReceived,
    onSubscriptionActive: observer.onSubscriptionActive,
    onHead: observer.onHead,
    onTransaction: observer.onTransaction,
    scheduler: input.scheduler,
    snapshotModels: input.entityModels,
    store: input.store,
    transport: new HeraldGameSyncTransport({
      modelDefinition: input.modelDefinition,
      socketFactory: input.socketFactory,
      url: buildHeraldGameStreamUrl(input.baseUrl, input.gameId, input.actor),
    }),
  };
}

export function buildHeraldGameStreamUrl(baseUrl: string, gameId: number, actor?: string): string {
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
  url.pathname = `${prefix}/games/${gameId}`;
  url.search = "";
  if (actor !== undefined) url.searchParams.set("actor", `0x${BigInt(actor).toString(16)}`);
  url.hash = "";
  return url.toString();
}
