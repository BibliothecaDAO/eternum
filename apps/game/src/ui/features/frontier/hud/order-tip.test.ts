import { ActionType } from "@bibliothecadao/eternum";
import { describe, expect, it } from "vitest";

import { orderTipLine } from "./order-tip";

const step = (actionType: ActionType, staminaCost?: number) => ({ hex: { col: 0, row: 0 }, actionType, staminaCost });
const tip = (path: ReturnType<typeof step>[] | undefined, target: string | null = null) =>
  orderTipLine({ path, target, exploreStamina: 30 });

describe("a highlighted tile's line", () => {
  it("names the order and what it costs: explore, move by the path's cost, attack by its target", () => {
    expect(tip([step(ActionType.Move), step(ActionType.Explore)])).toBe("Unexplored · Explore · 30 stamina");
    expect(tip([step(ActionType.Move), step(ActionType.Move, 10), step(ActionType.Move, 10)])).toBe(
      "Move · 20 stamina",
    );
    expect(tip([step(ActionType.Move), step(ActionType.Attack, 30)], "Rift")).toBe("Rift · Attack · 30 stamina");
    expect(tip([step(ActionType.Move), step(ActionType.Attack, 30)])).toBe("Army · Attack · 30 stamina");
  });

  it("names a transfer to another of the player's armies, and says nothing where no order leads", () => {
    expect(tip([step(ActionType.Move), step(ActionType.Help)])).toBe("Army · Transfer");
    expect(tip([step(ActionType.Move)])).toBeNull();
    expect(tip(undefined)).toBeNull();
  });
});
