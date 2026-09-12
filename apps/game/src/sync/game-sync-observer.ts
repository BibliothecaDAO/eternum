import type { GameClientObserver, GameSyncSnapshotPhase } from "@bibliothecadao/eternum/game-client";
import type { GameSyncHead } from "@bibliothecadao/eternum/game-sync";

import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { acceptGameSyncStoryEvent, resetGameSyncStoryEvents } from "@/hooks/store/use-story-events-store";
import { recordClientActionDiffReceived, recordClientActionRecsApplied } from "@/observability/client-action-latency";
import { markGameEntryMilestone, recordGameEntryDuration } from "@/ui/layouts/game-entry-timeline";

const snapshotPhaseMilestone = (phase: GameSyncSnapshotPhase) =>
  phase === "receiving" ? "snapshot-receive" : "snapshot-apply";

const recordHeraldHead = (head: GameSyncHead): void => {
  if (!head.preconfirmed) useConnectionStore.getState().recordConfirmedHead(head.block);
  useChainTimeStore.getState().setHeartbeat({
    blockNumber: head.block,
    source: head.preconfirmed ? "herald-clock" : "herald-head",
    timestamp: head.timestamp * 1_000,
  });
};

/** The web client's view of the Herald session: connection and chain-time stores, story events, entry timeline. */
export const createGameSyncObserver = (): GameClientObserver => ({
  onLiveApplyFailed: () => useConnectionStore.getState().setGlobalStatus("failed"),
  onHead: recordHeraldHead,
  onStoryEvent: acceptGameSyncStoryEvent,
  onStoryEventsReset: resetGameSyncStoryEvents,
  onDiffReceived: recordClientActionDiffReceived,
  onRecsApplied: recordClientActionRecsApplied,
  onSnapshotPhaseStarted: (phase) => markGameEntryMilestone(`${snapshotPhaseMilestone(phase)}-started`),
  onSnapshotPhaseCompleted: (phase, durationMs) => {
    const milestone = snapshotPhaseMilestone(phase);
    markGameEntryMilestone(`${milestone}-completed`);
    recordGameEntryDuration(milestone, durationMs);
  },
});
