import { ActionType } from "@bibliothecadao/eternum";
import { describe, expect, it } from "vitest";

import { pinsOrder } from "./worldmap-order-request";

const step = (actionType: ActionType) => ({ hex: { col: 0, row: 0 }, actionType });

describe("a tap on a tile with an army selected", () => {
  it("pins an order on a tile to explore or move to", () => {
    expect(pinsOrder([step(ActionType.Move), step(ActionType.Explore)])).toBe(true);
    expect(pinsOrder([step(ActionType.Move), step(ActionType.Move), step(ActionType.Move)])).toBe(true);
  });

  it("keeps its own tap everywhere else: a site to attack, the army's own tile, no path", () => {
    expect(pinsOrder([step(ActionType.Move), step(ActionType.Attack)])).toBe(false);
    expect(pinsOrder([step(ActionType.Move)])).toBe(false);
    expect(pinsOrder(undefined)).toBe(false);
  });
});
