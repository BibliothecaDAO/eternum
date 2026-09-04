import type { ID } from "@bibliothecadao/types";

export interface ArmySlotAssignment {
  entityId: ID;
  slot: number;
}

export interface ArmySlotCompactionPlan {
  needsCompaction: boolean;
  reassignments: Array<{
    entityId: ID;
    fromSlot: number;
    toSlot: number;
  }>;
}

export function resolveArmySlotCompactionPlan(assignments: ArmySlotAssignment[]): ArmySlotCompactionPlan {
  const sortedAssignments = [...assignments].sort((left, right) => left.slot - right.slot);
  const reassignments = sortedAssignments.flatMap((assignment, denseSlot) =>
    assignment.slot === denseSlot
      ? []
      : [
          {
            entityId: assignment.entityId,
            fromSlot: assignment.slot,
            toSlot: denseSlot,
          },
        ],
  );

  return {
    needsCompaction: reassignments.length > 0,
    reassignments,
  };
}
