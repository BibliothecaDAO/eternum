type SettlementOperation =
  | {
      kind: "assign-and-settle";
      settlementCount: number;
    }
  | {
      kind: "settle";
      settlementCount: number;
    };

type SettlementRequest = {
  settlement_count: number;
};

type SettlementSystemCalls<TSigner> = {
  blitz_realm_assign_and_settle_realms: (request: SettlementRequest & { signer: TSigner }) => Promise<unknown>;
  blitz_realm_settle_realms: (request: SettlementRequest & { signer: TSigner }) => Promise<unknown>;
};

type SettlementFailure = {
  error: unknown;
  index: number;
  operation: SettlementOperation;
};

const DEFAULT_MULTI_REALM_COUNT = 3;
const SINGLE_REALM_COUNT = 1;

const getTargetRealmCount = (singleRealmMode: boolean) =>
  singleRealmMode ? SINGLE_REALM_COUNT : DEFAULT_MULTI_REALM_COUNT;

export const buildSettlementOperations = ({
  isMainnet,
  singleRealmMode,
  assignedRealmCount,
  settledRealmCount,
}: {
  isMainnet: boolean;
  singleRealmMode: boolean;
  assignedRealmCount: number;
  settledRealmCount: number;
}): SettlementOperation[] => {
  const targetRealmCount = getTargetRealmCount(singleRealmMode);
  const normalizedAssignedRealmCount = Math.min(targetRealmCount, Math.max(0, assignedRealmCount));
  const normalizedSettledRealmCount = Math.min(normalizedAssignedRealmCount, Math.max(0, settledRealmCount));

  if (normalizedSettledRealmCount >= targetRealmCount) {
    return [];
  }

  const remainingAssignedRealms = Math.max(0, normalizedAssignedRealmCount - normalizedSettledRealmCount);
  if (remainingAssignedRealms > 0) {
    if (isMainnet) {
      return Array.from({ length: remainingAssignedRealms }, () => ({
        kind: "settle" as const,
        settlementCount: 1,
      }));
    }

    return [
      {
        kind: "settle",
        settlementCount: remainingAssignedRealms,
      },
    ];
  }

  const missingRealmCount = Math.max(0, targetRealmCount - normalizedAssignedRealmCount);
  if (missingRealmCount === 0) {
    return [];
  }

  if (singleRealmMode || isMainnet) {
    return [
      {
        kind: "assign-and-settle",
        settlementCount: 1,
      },
    ];
  }

  return [
    {
      kind: "assign-and-settle",
      settlementCount: missingRealmCount,
    },
  ];
};

export const runSettlementOperations = async <TSigner>({
  signer,
  operations,
  systemCalls,
  onOperationStart,
}: {
  signer: TSigner;
  operations: SettlementOperation[];
  systemCalls: SettlementSystemCalls<TSigner>;
  onOperationStart?: (operation: SettlementOperation, index: number) => void;
}): Promise<{
  failures: SettlementFailure[];
  successfulSettlementCount: number;
}> => {
  const failures: SettlementFailure[] = [];
  let successfulSettlementCount = 0;

  for (const [index, operation] of operations.entries()) {
    onOperationStart?.(operation, index);

    try {
      if (operation.kind === "assign-and-settle") {
        await systemCalls.blitz_realm_assign_and_settle_realms({
          signer,
          settlement_count: operation.settlementCount,
        });
      } else {
        await systemCalls.blitz_realm_settle_realms({
          signer,
          settlement_count: operation.settlementCount,
        });
      }

      successfulSettlementCount += operation.settlementCount;
    } catch (error) {
      failures.push({
        error,
        index,
        operation,
      });

      // A failed assignment means there are no assigned realms to continue from.
      if (operation.kind === "assign-and-settle") {
        break;
      }
    }
  }

  return {
    failures,
    successfulSettlementCount,
  };
};

export const getTargetSettlementRealmCount = getTargetRealmCount;
