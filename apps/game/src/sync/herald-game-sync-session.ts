import type { SetupResult } from "@bibliothecadao/dojo";
import {
  HeraldGameSyncTransport,
  type GameSyncRuntimeMetrics,
  type GameSyncSnapshotProgress,
  type GameSyncSessionStart,
} from "@bibliothecadao/eternum/game-sync";
import type { GameChain } from "@realms-world/chain";

import { createBrowserScheduler, createRecsGameSyncStore } from "./recs-game-sync-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { acceptGameSyncStoryEvent, resetGameSyncStoryEvents } from "@/hooks/store/use-story-events-store";
import { recordClientActionDiffReceived, recordClientActionRecsApplied } from "@/observability/client-action-latency";
import { markGameEntryMilestone, recordGameEntryDuration } from "@/ui/layouts/game-entry-timeline";

interface CreateHeraldGameSyncSessionInput {
  baseUrl: string;
  chain: GameChain;
  entityModels: readonly string[];
  eventModels: readonly string[];
  gameId: number;
  logging: boolean;
  onLiveUpdate?: (kind: "entity" | "event") => void;
  onMetrics?: (metrics: GameSyncRuntimeMetrics) => void;
  onSnapshotProgress?: (progress: GameSyncSnapshotProgress) => void;
  onSubscriptionActive?: () => void;
  setup: SetupResult;
}

const createSnapshotProgressObserver = (
  onProgress?: (progress: GameSyncSnapshotProgress) => void,
): ((progress: GameSyncSnapshotProgress) => void) => {
  const startedAt = new Map<GameSyncSnapshotProgress["phase"], number>();
  const completed = new Set<GameSyncSnapshotProgress["phase"]>();

  return (progress) => {
    const milestone = progress.phase === "receiving" ? "snapshot-receive" : "snapshot-apply";
    if (!startedAt.has(progress.phase)) {
      startedAt.set(progress.phase, performance.now());
      markGameEntryMilestone(`${milestone}-started`);
    }
    if (progress.total > 0 && progress.completed >= progress.total && !completed.has(progress.phase)) {
      completed.add(progress.phase);
      markGameEntryMilestone(`${milestone}-completed`);
      recordGameEntryDuration(milestone, performance.now() - startedAt.get(progress.phase)!);
    }
    onProgress?.(progress);
  };
};

export function createHeraldGameSyncSession(input: CreateHeraldGameSyncSessionInput): GameSyncSessionStart {
  resetGameSyncStoryEvents();
  const syncModels = [...input.entityModels, ...input.eventModels];
  const observeSnapshotProgress = createSnapshotProgressObserver(input.onSnapshotProgress);
  return {
    onLiveUpdate: input.onLiveUpdate,
    onError: (error) => {
      useConnectionStore.getState().setGlobalStatus("failed");
      console.error(`[GameSync] live entity apply failed: ${error.message}`);
    },
    onEvent: acceptGameSyncStoryEvent,
    onMetrics: input.onMetrics,
    onSnapshotProgress: observeSnapshotProgress,
    onTransactionEntitiesApplied: recordClientActionRecsApplied,
    onTransactionEntitiesReceived: recordClientActionDiffReceived,
    onSubscriptionActive: input.onSubscriptionActive,
    onHead: (head) => {
      useChainTimeStore.getState().setHeartbeat({
        blockNumber: head.block,
        source: "herald-head",
        timestamp: head.timestamp * 1_000,
      });
    },
    scheduler: createBrowserScheduler(),
    snapshotModels: input.entityModels,
    store: createRecsGameSyncStore(input.setup, input.logging, syncModels),
    transport: new HeraldGameSyncTransport({
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
