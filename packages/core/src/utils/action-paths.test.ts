import { describe, expect, it } from "vitest";

import { type ActionPath, ActionPaths, ActionType } from "./action-paths";

const step = (col: number, actionType = ActionType.Move, staminaCost = 10): ActionPath => ({
  hex: { col, row: 0 },
  actionType,
  staminaCost,
});

const paths = (...entries: ActionPath[][]) =>
  new Map(entries.map((path) => [ActionPaths.posKey(path[path.length - 1].hex), path]));

describe("ActionPaths.samePaths", () => {
  it("holds for the same orders planned again", () => {
    expect(ActionPaths.samePaths(paths([step(0), step(1)]), paths([step(0), step(1)]))).toBe(true);
  });

  it("tells apart a new destination, a changed order and a changed cost", () => {
    const planned = paths([step(0), step(1)]);
    expect(ActionPaths.samePaths(planned, paths([step(0), step(1)], [step(0), step(2)]))).toBe(false);
    expect(ActionPaths.samePaths(planned, paths([step(0), step(1, ActionType.Explore)]))).toBe(false);
    expect(ActionPaths.samePaths(planned, paths([step(0), step(1, ActionType.Move, 15)]))).toBe(false);
  });
});
