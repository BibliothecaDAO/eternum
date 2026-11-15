import { expect, it } from "vitest";

import { accountProgress, nextLine, openedMoments, reachedOnState } from "./opening-state";

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

it("reads only the current account's progress, and calls it known only once its service has answered", () => {
  const progress = (owner: string | null, status: "signed-out" | "loading" | "ready" | "error") => ({
    owner,
    status,
    reached: new Set(["fight"]),
    seen: new Set(["launch"]),
  });
  // Delayed or failed: the returning account's progress is not yet known, so no line may be told again.
  expect(accountProgress("a", progress("a", "loading")).known).toBe(false);
  expect(accountProgress("a", progress("a", "error")).known).toBe(false);
  expect(accountProgress("a", progress("a", "ready"))).toMatchObject({ known: true, seen: new Set(["launch"]) });
  // Another account's sets are never this one's.
  expect(accountProgress("b", progress("a", "ready"))).toEqual({ reached: new Set(), seen: new Set(), known: false });
  expect(accountProgress(null, progress(null, "signed-out")).known).toBe(true);
});
