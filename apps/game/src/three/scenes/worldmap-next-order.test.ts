import { clearArmyMovementLatencyTrace, snapshotArmyMovementLatencyTrace } from "@bibliothecadao/eternum";
import { beforeEach, describe, expect, it } from "vitest";

import { dropNextOrder, queueNextOrder, takeNextOrder } from "./worldmap-next-order";
import { getLiveWorldmapEntityActions, resetWorldmapEntityActions } from "./worldmap-interaction-state";

const traced = () =>
  snapshotArmyMovementLatencyTrace().map(({ phase, entityId, details }) => ({ phase, entityId, details }));

beforeEach(() => {
  resetWorldmapEntityActions();
  clearArmyMovementLatencyTrace();
});

describe("an army's next order", () => {
  it("is one tile at a time: a later tap replaces it, and the replaced tap is traced as dropped", () => {
    queueNextOrder(7, { col: 1, row: 2 });
    queueNextOrder(7, { col: 3, row: 4 });

    expect(getLiveWorldmapEntityActions().nextOrder).toEqual({ entityId: 7, hex: { col: 3, row: 4 } });
    expect(traced()).toEqual([
      { phase: "next_order_queued", entityId: 7, details: { col: 1, row: 2 } },
      { phase: "next_order_dropped", entityId: 7, details: { col: 1, row: 2, reason: "replaced" } },
      { phase: "next_order_queued", entityId: 7, details: { col: 3, row: 4 } },
    ]);
  });

  it("is taken to run only by its own army, and leaves the queue when it runs", () => {
    queueNextOrder(7, { col: 3, row: 4 });

    expect(takeNextOrder(8)).toBeNull();
    expect(takeNextOrder(7)).toEqual({ col: 3, row: 4 });
    expect(takeNextOrder(7)).toBeNull();
    expect(getLiveWorldmapEntityActions().nextOrder).toBeNull();
    expect(traced().at(-1)).toEqual({ phase: "next_order_run", entityId: 7, details: { col: 3, row: 4 } });
  });

  it("is dropped with its reason on a refusal or Cancel, and another army's drop leaves it queued", () => {
    queueNextOrder(7, { col: 3, row: 4 });
    dropNextOrder("refused", 8);
    expect(getLiveWorldmapEntityActions().nextOrder).toEqual({ entityId: 7, hex: { col: 3, row: 4 } });

    dropNextOrder("refused", 7);
    expect(getLiveWorldmapEntityActions().nextOrder).toBeNull();
    queueNextOrder(7, { col: 5, row: 6 });
    dropNextOrder("cancelled");

    expect(getLiveWorldmapEntityActions().nextOrder).toBeNull();
    expect(traced().filter(({ phase }) => phase === "next_order_dropped")).toEqual([
      { phase: "next_order_dropped", entityId: 7, details: { col: 3, row: 4, reason: "refused" } },
      { phase: "next_order_dropped", entityId: 7, details: { col: 5, row: 6, reason: "cancelled" } },
    ]);
  });
});
