import {
  buildSettlementExecutionPlan,
  getExpectedSettlementCount,
  hasReachedSettlementTarget,
  type SettlementExecutionPlan,
  type SettlementSnapshot,
  type SettlementStatus,
  type SettleStage,
} from "./game-entry-settlement.utils";

type SettlementStageChange = Extract<SettleStage, "assigning" | "settling">;

type BlitzSettlementFlowFailure = {
  status: "failed";
  error: Error;
  plan: SettlementExecutionPlan | null;
  recoverySnapshot: SettlementSnapshot | null;
  recoveryStatus: SettlementStatus | null;
};

type BlitzSettlementFlowSuccess = {
  status: "completed";
  recovered: boolean;
  plan: SettlementExecutionPlan;
  finalSnapshot: SettlementSnapshot;
  finalStatus: SettlementStatus;
};

export type BlitzSettlementFlowResult = BlitzSettlementFlowSuccess | BlitzSettlementFlowFailure;

type RunBlitzSettlementFlowParams = {
  isMainnet: boolean;
  singleRealmMode: boolean;
  readSettlementSnapshot: () => Promise<SettlementSnapshot | null>;
  syncSettlementStateFromSnapshot: (snapshot: SettlementSnapshot) => SettlementStatus;
  waitForSettlementTarget: (targetSettleCount: number) => Promise<SettlementSnapshot | null>;
  onStageChange: (stage: SettlementStageChange) => void;
  runAssignAndSettle: (initialSettleCount: number) => Promise<void>;
  runSingleSettle: (stepIndex: number, totalSteps: number) => Promise<void>;
};

const toError = (error: unknown): Error => (error instanceof Error ? error : new Error("Settlement failed"));

const readSettlementSnapshotSafely = async (
  readSettlementSnapshot: RunBlitzSettlementFlowParams["readSettlementSnapshot"],
): Promise<SettlementSnapshot | null> => {
  try {
    return await readSettlementSnapshot();
  } catch {
    return null;
  }
};

const buildCompletedResult = ({
  recovered,
  plan,
  finalSnapshot,
  finalStatus,
}: {
  recovered: boolean;
  plan: SettlementExecutionPlan;
  finalSnapshot: SettlementSnapshot;
  finalStatus: SettlementStatus;
}): BlitzSettlementFlowSuccess => ({
  status: "completed",
  recovered,
  plan,
  finalSnapshot,
  finalStatus,
});

const buildFailedResult = ({
  error,
  plan,
  recoverySnapshot,
  recoveryStatus,
}: {
  error: unknown;
  plan: SettlementExecutionPlan | null;
  recoverySnapshot: SettlementSnapshot | null;
  recoveryStatus: SettlementStatus | null;
}): BlitzSettlementFlowFailure => ({
  status: "failed",
  error: toError(error),
  plan,
  recoverySnapshot,
  recoveryStatus,
});

export const runBlitzSettlementFlow = async ({
  isMainnet,
  singleRealmMode,
  readSettlementSnapshot,
  syncSettlementStateFromSnapshot,
  waitForSettlementTarget,
  onStageChange,
  runAssignAndSettle,
  runSingleSettle,
}: RunBlitzSettlementFlowParams): Promise<BlitzSettlementFlowResult> => {
  let plan: SettlementExecutionPlan | null = null;

  try {
    const initialSnapshot = await readSettlementSnapshot();
    if (!initialSnapshot) {
      throw new Error("Unable to read settlement status for current player.");
    }

    const initialStatus = syncSettlementStateFromSnapshot(initialSnapshot);
    let targetProgress = initialStatus.settledCount;

    plan = buildSettlementExecutionPlan({
      isMainnet,
      singleRealmMode,
      snapshot: initialSnapshot,
    });

    if (plan.missingAssignmentRegistration) {
      throw new Error("Cannot assign realm positions because the player is no longer in registered state.");
    }

    if (plan.shouldAssignAndSettle && plan.initialSettleCount > 0) {
      onStageChange("assigning");
      await runAssignAndSettle(plan.initialSettleCount);
      targetProgress = Math.min(plan.targetSettleCount, targetProgress + plan.initialSettleCount);
      await waitForSettlementTarget(targetProgress);
    }

    if (plan.extraSettleCalls > 0) {
      onStageChange("settling");
      for (let stepIndex = 0; stepIndex < plan.extraSettleCalls; stepIndex++) {
        await runSingleSettle(stepIndex, plan.extraSettleCalls);
        targetProgress = Math.min(plan.targetSettleCount, targetProgress + 1);
        await waitForSettlementTarget(targetProgress);
      }
    }

    const finalSnapshot = await waitForSettlementTarget(plan.targetSettleCount);
    if (!finalSnapshot) {
      throw new Error("Timed out waiting for settlement progress.");
    }

    const finalStatus = syncSettlementStateFromSnapshot(finalSnapshot);
    if (!hasReachedSettlementTarget(finalStatus, plan.targetSettleCount)) {
      throw new Error(`Settlement incomplete: ${finalStatus.settledCount}/${plan.targetSettleCount} realms settled.`);
    }

    return buildCompletedResult({
      recovered: false,
      plan,
      finalSnapshot,
      finalStatus,
    });
  } catch (error) {
    const recoverySnapshot = await readSettlementSnapshotSafely(readSettlementSnapshot);
    const recoveryStatus = recoverySnapshot ? syncSettlementStateFromSnapshot(recoverySnapshot) : null;
    const recoveryPlan =
      recoverySnapshot && !plan
        ? buildSettlementExecutionPlan({
            isMainnet,
            singleRealmMode,
            snapshot: recoverySnapshot,
          })
        : plan;
    const targetSettleCount = recoveryPlan?.targetSettleCount ?? getExpectedSettlementCount(singleRealmMode);

    if (recoveryPlan && recoverySnapshot && recoveryStatus && hasReachedSettlementTarget(recoveryStatus, targetSettleCount)) {
      return buildCompletedResult({
        recovered: true,
        plan: recoveryPlan,
        finalSnapshot: recoverySnapshot,
        finalStatus: recoveryStatus,
      });
    }

    return buildFailedResult({
      error,
      plan: recoveryPlan,
      recoverySnapshot,
      recoveryStatus,
    });
  }
};
