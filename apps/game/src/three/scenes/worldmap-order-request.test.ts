import { ActionType } from "@bibliothecadao/eternum";
import { describe, expect, it } from "vitest";

import { orderOnTap, pinsOrder } from "./worldmap-order-request";

const step = (actionType: ActionType) => ({ hex: { col: 0, row: 0 }, actionType });
const tap = (path: ReturnType<typeof step>[] | undefined, standingSite = false) =>
  orderOnTap({ path, armySelected: true, standingSite });

describe("a tap on a tile with an army selected", () => {
  it("pins an order on a tile to explore or move to", () => {
    expect(tap([step(ActionType.Move), step(ActionType.Explore)])).toBe("pin");
    expect(tap([step(ActionType.Move), step(ActionType.Move), step(ActionType.Move)])).toBe("pin");
  });

  it("opens the attack preview on a target in reach, a standing site or any other", () => {
    expect(tap([step(ActionType.Move), step(ActionType.Attack)], true)).toBe("attack");
    expect(tap([step(ActionType.Move), step(ActionType.Attack)])).toBe("attack");
  });

  it("opens a standing site out of reach for the army, so its card can say what the army lacks", () => {
    expect(tap(undefined, true)).toBe("site-out-of-reach");
    expect(orderOnTap({ path: undefined, armySelected: false, standingSite: true })).toBeNull();
  });

  it("counts as an order to a tile only a path that explores or moves there", () => {
    expect(pinsOrder([step(ActionType.Move), step(ActionType.Explore)])).toBe(true);
    expect(pinsOrder([step(ActionType.Move), step(ActionType.Help)])).toBe(false);
    expect(pinsOrder([step(ActionType.Move)])).toBe(false);
  });

  it("keeps the tile's own tap everywhere else: the army's own tile, a help or a spire, no path", () => {
    expect(tap([step(ActionType.Move)])).toBeNull();
    expect(tap([step(ActionType.Move), step(ActionType.Help)])).toBeNull();
    expect(tap([step(ActionType.Move), step(ActionType.SpireTravel)])).toBeNull();
    expect(tap(undefined)).toBeNull();
  });
});
