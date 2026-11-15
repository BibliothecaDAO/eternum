import { expect, it } from "vitest";

import { nextLine, openedMoments, reachedOnState } from "./opening-state";

it("reaches the launch always and each moment whose state is held", () => {
  expect(reachedOnState({})).toEqual(["launch"]);
  expect(reachedOnState({ barracks: true, fight: false, deep: true })).toEqual(["launch", "barracks", "deep"]);
});

it("keeps a moment the account reached before although its state has passed, and drops no moment", () => {
  const opened = openedMoments(new Set(["fight", "not-a-moment"]), ["launch", "barracks"]);
  expect([...opened].sort()).toEqual(["barracks", "fight", "launch"]);
});

it("says the first unseen line of the moments reached, in the table's order, once each", () => {
  const opened = openedMoments(new Set(), ["launch", "barracks", "fight"]);
  expect(nextLine(opened, new Set())).toBe("launch");
  expect(nextLine(opened, new Set(["launch"]))).toBe("barracks");
  expect(nextLine(opened, new Set(["launch", "barracks", "fight"]))).toBeNull();
});
