export type SettlementOperation =
  | {
      kind: "assign-and-settle";
      settlementCount: number;
    }
  | {
      kind: "settle";
      settlementCount: number;
    };

type SettlementRequest = {
  signer: unknown;
  settlement_count: number;
};

type SettlementSystemCalls = {
  blitz_realm_assign_and_settle_realms: (request: SettlementRequest) => Promise<unknown>;
  blitz_realm_settle_realms: (request: SettlementRequest) => Promise<unknown>;
};

export type SettlementFailure = {
  error: unknown;
  index: number;
  operation: SettlementOperation;
};

const DEFAULT_MULTI_REALM_COUNT = 3;
const SINGLE_REALM_COUNT = 1;

const getTargetRealmCount = (singleRealmMode: boolean) => (singleRealmMode ? SINGLE_REALM_COUNT : DEFAULT_MULTI_REALM_COUNT);

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
  if (settledRealmCount >= targetRealmCount) {
    return [];
  }

  const remainingAssignedRealms = Math.max(0, assignedRealmCount - settledRealmCount);
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

  if (singleRealmMode) {
    return [
      {
        kind: "assign-and-settle",
        settlementCount: 1,
      },
    ];
  }

  if (isMainnet) {
    return [
      {
        kind: "assign-and-settle",
        settlementCount: 1,
      },
      {
        kind: "settle",
        settlementCount: 1,
      },
      {
        kind: "settle",
        settlementCount: 1,
      },
    ];
  }

  return [
    {
      kind: "assign-and-settle",
      settlementCount: targetRealmCount,
    },
  ];
};

export const runSettlementOperations = async ({
  signer,
  operations,
  systemCalls,
  onOperationStart,
}: {
  signer: unknown;
  operations: SettlementOperation[];
  systemCalls: SettlementSystemCalls;
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
