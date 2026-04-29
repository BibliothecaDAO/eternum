import { describe, expect, it } from "vitest";

import { resolvePendingArmyMovementSubmitAction } from "./worldmap-army-movement-submit";

describe("resolvePendingArmyMovementSubmitAction", () => {
  it("submits normally when there is no action path", () => {
    expect(
      resolvePendingArmyMovementSubmitAction({
        actionPathLength: 0,
        hasPendingMovement: true,
        isOptimisticMovementActive: false,
      }),
    ).toBe("submit");
  });

  it("submits normally when the army has no pending movement", () => {
    expect(
      resolvePendingArmyMovementSubmitAction({
        actionPathLength: 1,
        hasPendingMovement: false,
        isOptimisticMovementActive: false,
      }),
    ).toBe("submit");
  });

  it("queues a next move while the optimistic tween is active", () => {
    expect(
      resolvePendingArmyMovementSubmitAction({
        actionPathLength: 1,
        hasPendingMovement: true,
        isOptimisticMovementActive: true,
      }),
    ).toBe("queue_next_move");
  });

  it("queues a next move after pending state hands off to the optimistic tween", () => {
    expect(
      resolvePendingArmyMovementSubmitAction({
        actionPathLength: 1,
        hasPendingMovement: false,
        isOptimisticMovementActive: true,
      }),
    ).toBe("queue_next_move");
  });

  it("blocks duplicate submits while the first tx is pending but not animating yet", () => {
    expect(
      resolvePendingArmyMovementSubmitAction({
        actionPathLength: 1,
        hasPendingMovement: true,
        isOptimisticMovementActive: false,
      }),
    ).toBe("block_pending_handoff");
  });
});
