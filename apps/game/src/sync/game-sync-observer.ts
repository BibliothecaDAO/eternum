import type { SetupResult } from "@bibliothecadao/dojo";
import type { GameClientObserver, GameSyncSnapshotPhase } from "@bibliothecadao/eternum/game-client";
import type { GameSyncHead, GameSyncSnapshotProgress } from "@bibliothecadao/eternum/game-sync";

import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { acceptGameSyncStoryEvent, resetGameSyncStoryEvents } from "@/hooks/store/use-story-events-store";
import { recordClientActionDiffReceived, recordClientActionRecsApplied } from "@/observability/client-action-latency";
import { publishSyncMetrics } from "@/observability/sync-metrics";
import { markGameEntryMilestone, recordGameEntryDuration } from "@/ui/layouts/game-entry-timeline";
import { DEV_MODE_ENABLED } from "@/utils/dev-mode";

interface GameSyncObserverInput {
  /** Initial-sync progress as a percentage for the entry screen. */
  reportProgress: (progress: number) => void;
  /** Runs between setup and the Herald session, where the bootstrap prepares the renderer. */
  onSetupCompleted: (setup: SetupResult) => void;
}

const snapshotPhaseMilestone = (phase: GameSyncSnapshotPhase) =>
  phase === "receiving" ? "snapshot-receive" : "snapshot-apply";

const snapshotProgressPercentage = ({ completed, phase, total }: GameSyncSnapshotProgress): number => {
  const ratio = total > 0 ? Math.min(1, completed / total) : 0;
  return phase === "receiving" ? 5 + ratio * 40 : 45 + ratio * 45;
};

const recordHeraldHead = (head: GameSyncHead): void => {
  if (!head.preconfirmed) useConnectionStore.getState().recordConfirmedHead(head.block);
  useChainTimeStore.getState().setHeartbeat({
    blockNumber: head.block,
    source: head.preconfirmed ? "herald-clock" : "herald-head",
    timestamp: head.timestamp * 1_000,
  });
};

const recordGamewideSubscriptionActive = (): void => {
  const connection = useConnectionStore.getState();
  connection.recordGlobalHandshake();
  connection.recordSpatialHandshake();
};

// The connection store is a React store: every write re-renders its readers, so liveness is
// recorded at most four times a second however fast the batches arrive.
const LIVENESS_RECORD_INTERVAL_MS = 250;
let livenessRecordedAt = 0;

const recordGamewideLiveUpdate = (): void => {
  const now = Date.now();
  if (now - livenessRecordedAt < LIVENESS_RECORD_INTERVAL_MS) return;
  livenessRecordedAt = now;
  const connection = useConnectionStore.getState();
  connection.recordGlobalUpdate();
  connection.recordSpatialUpdate();
};

/** The web client's view of the game client: connection and chain-time stores, story events, entry timeline. */
export const createGameSyncObserver = (input: GameSyncObserverInput): GameClientObserver => ({
  onSetupCompleted: (setup) => {
    markGameEntryMilestone("setup-completed");
    input.onSetupCompleted(setup);
    markGameEntryMilestone("initial-sync-started");
  },
  onSubscriptionActive: recordGamewideSubscriptionActive,
  onLiveUpdate: recordGamewideLiveUpdate,
  onLiveApplyFailed: () => useConnectionStore.getState().setGlobalStatus("failed"),
  onHead: recordHeraldHead,
  onStoryEvent: acceptGameSyncStoryEvent,
  onStoryEventsReset: resetGameSyncStoryEvents,
  onDiffReceived: recordClientActionDiffReceived,
  onRecsApplied: recordClientActionRecsApplied,
  onMetrics: DEV_MODE_ENABLED ? publishSyncMetrics : undefined,
  onSnapshotProgress: (progress) => input.reportProgress(snapshotProgressPercentage(progress)),
  onSnapshotPhaseStarted: (phase) => markGameEntryMilestone(`${snapshotPhaseMilestone(phase)}-started`),
  onSnapshotPhaseCompleted: (phase, durationMs) => {
    const milestone = snapshotPhaseMilestone(phase);
    markGameEntryMilestone(`${milestone}-completed`);
    recordGameEntryDuration(milestone, durationMs);
  },
});
