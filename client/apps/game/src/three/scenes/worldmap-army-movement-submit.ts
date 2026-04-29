type PendingArmyMovementSubmitAction = "submit" | "queue_next_move" | "block_pending_handoff";

export function resolvePendingArmyMovementSubmitAction(input: {
  actionPathLength: number;
  hasPendingMovement: boolean;
  isOptimisticMovementActive: boolean;
}): PendingArmyMovementSubmitAction {
  if (input.actionPathLength <= 0) {
    return "submit";
  }

  if (input.isOptimisticMovementActive) {
    return "queue_next_move";
  }

  if (input.hasPendingMovement) {
    return "block_pending_handoff";
  }

  return "submit";
}
