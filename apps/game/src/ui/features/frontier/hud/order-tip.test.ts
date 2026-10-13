import { ActionType } from "@bibliothecadao/eternum";
import { describe, expect, it } from "vitest";

import { orderTip } from "./order-tip";

const step = (actionType: ActionType, staminaCost?: number) => ({ hex: { col: 0, row: 0 }, actionType, staminaCost });
const tip = (path: ReturnType<typeof step>[] | undefined, target: string | null = null, explored = true) =>
  orderTip({ path, target, exploreStamina: 30, explored });
const line = (...args: Parameters<typeof tip>) => tip(...args)?.line;

describe("a highlighted tile's line", () => {
  it("names the order and what it costs: explore, move by the path's cost, attack by its target", () => {
    expect(line([step(ActionType.Move), step(ActionType.Explore)])).toBe("Unexplored · Explore · 30 stamina");
    expect(line([step(ActionType.Move), step(ActionType.Move, 10), step(ActionType.Move, 10)])).toBe(
      "Move · 20 stamina",
    );
    expect(line([step(ActionType.Move), step(ActionType.Attack, 30)], "Rift")).toBe("Rift · Attack · 30 stamina");
    expect(line([step(ActionType.Move), step(ActionType.Attack, 30)])).toBe("Army · Attack · 30 stamina");
  });

  it("names a transfer to another of the player's armies, and says nothing where no order leads", () => {
    expect(line([step(ActionType.Move), step(ActionType.Help)])).toBe("Army · Transfer");
    expect(tip([step(ActionType.Move)])).toBeNull();
    expect(tip(undefined)).toBeNull();
  });

  it("names a tile nobody has revealed where no order leads, and says nothing of a revealed one", () => {
    expect(tip(undefined, null, false)).toEqual({ line: "Unexplored", gestures: null });
    expect(tip([step(ActionType.Move)], null, false)).toEqual({ line: "Unexplored", gestures: null });
    expect(tip(undefined, null, true)).toBeNull();
    // An order's own line already says it, with its cost.
    expect(line([step(ActionType.Move), step(ActionType.Explore)], null, false)).toBe(
      "Unexplored · Explore · 30 stamina",
    );
  });

  it("says which click previews and which sends on a tile to explore or move to, and on no other", () => {
    const gestures = "Click previews · Right-click sends";
    expect(tip([step(ActionType.Move), step(ActionType.Explore)])?.gestures).toBe(gestures);
    expect(tip([step(ActionType.Move), step(ActionType.Move, 10)])?.gestures).toBe(gestures);
    // Either click opens an attack's forecast or a transfer's sheet: neither is sent unseen.
    expect(tip([step(ActionType.Move), step(ActionType.Attack, 30)], "Rift")?.gestures).toBeNull();
    expect(tip([step(ActionType.Move), step(ActionType.Help)])?.gestures).toBeNull();
  });
});
