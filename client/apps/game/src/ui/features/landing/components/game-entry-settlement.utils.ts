export type SettlementSnapshot = {
  registered: boolean;
  onceRegistered: boolean;
  hasSettledStructure: boolean;
  coordsCount: number;
  settledCount: number;
};

export type SettlementStatus = {
  assignedCount: number;
  settledCount: number;
  remainingToSettle: number;
  canPlay: boolean;
  needsSettlement: boolean;
};

export const getExpectedSettlementCount = (singleRealmMode: boolean): number => (singleRealmMode ? 1 : 3);

export const deriveSettlementStatus = (snapshot: SettlementSnapshot): SettlementStatus => {
  const coordsCount = Math.max(0, snapshot.coordsCount);
  const settledCount = Math.max(0, snapshot.settledCount);
  const assignedCount = coordsCount + settledCount;
  const remainingToSettle = Math.max(0, assignedCount - settledCount);
  const canPlay = snapshot.hasSettledStructure && assignedCount > 0 && remainingToSettle === 0;
  const isRegisteredForSettlement = snapshot.registered || snapshot.onceRegistered;
  const needsSettlement = isRegisteredForSettlement && !canPlay;

  return {
    assignedCount,
    settledCount,
    remainingToSettle,
    canPlay,
    needsSettlement,
  };
};

export type SettlementExecutionPlan = {
  targetSettleCount: number;
  shouldAssignAndSettle: boolean;
  initialSettleCount: number;
  extraSettleCalls: number;
  missingAssignmentRegistration: boolean;
};

export const buildSettlementExecutionPlan = ({
  isMainnet,
  singleRealmMode,
  snapshot,
}: {
  isMainnet: boolean;
  singleRealmMode: boolean;
  snapshot: SettlementSnapshot;
}): SettlementExecutionPlan => {
  const targetSettleCount = getExpectedSettlementCount(singleRealmMode);
  const settledCount = Math.max(0, snapshot.settledCount);
  const coordsCount = Math.max(0, snapshot.coordsCount);

  if (settledCount >= targetSettleCount) {
    return {
      targetSettleCount,
      shouldAssignAndSettle: false,
      initialSettleCount: 0,
      extraSettleCalls: 0,
      missingAssignmentRegistration: false,
    };
  }

  if (coordsCount > 0) {
    const remainingToTarget = Math.max(0, targetSettleCount - settledCount);
    return {
      targetSettleCount,
      shouldAssignAndSettle: false,
      initialSettleCount: 0,
      extraSettleCalls: Math.min(coordsCount, remainingToTarget),
      missingAssignmentRegistration: false,
    };
  }

  const initialSettleCount = isMainnet ? 1 : Math.max(0, targetSettleCount - settledCount);
  const extraSettleCalls = Math.max(0, targetSettleCount - (settledCount + initialSettleCount));

  return {
    targetSettleCount,
    shouldAssignAndSettle: true,
    initialSettleCount,
    extraSettleCalls,
    missingAssignmentRegistration: !snapshot.registered,
  };
};
