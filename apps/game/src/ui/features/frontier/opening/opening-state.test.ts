import { expect, it } from "vitest";

import { accountProgress, nextLine, siteAlertOfferDue, openedMoments, reachedOnState } from "./opening-state";

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
  const progress = (owner: string | null, status: "signed-out" | "loading" | "ready" | "error", onDevice = false) => ({
    owner,
    status,
    reached: new Set(["fight"]),
    seen: new Set(["launch"]),
    onDevice,
  });
  // Delayed or failed: the returning account's progress is not yet known, so no line may be told again.
  expect(accountProgress("a", progress("a", "loading")).known).toBe(false);
  expect(accountProgress("a", progress("a", "error")).known).toBe(false);
  expect(accountProgress("a", progress("a", "ready"))).toMatchObject({ known: true, seen: new Set(["launch"]) });
  // Another account's sets are never this one's.
  expect(accountProgress("b", progress("a", "ready"))).toEqual({
    reached: new Set(),
    seen: new Set(),
    known: false,
    ownsParts: false,
  });
  // Parts rest on the service's answer or on what this device kept: a cold device whose read is delayed or failed has
  // neither, so the parts the account earned are not taken away on an empty set.
  expect(accountProgress("a", progress("a", "loading")).ownsParts).toBe(false);
  expect(accountProgress("a", progress("a", "error")).ownsParts).toBe(false);
  expect(accountProgress("a", progress("a", "loading", true)).ownsParts).toBe(true);
  expect(accountProgress("a", progress("a", "ready")).ownsParts).toBe(true);
  expect(accountProgress(null, progress(null, "signed-out")).known).toBe(true);
});

it("makes the site alert's offer once the Deep is entered, until it is answered, whatever lines are told", () => {
  const entered = openedMoments(new Set(), ["launch", "deep"]);
  expect(siteAlertOfferDue(entered, new Set(), true, "site-alert")).toBe(true);
  // An earlier line left unanswered does not hold it back; an unread account does.
  expect(siteAlertOfferDue(entered, new Set(["barracks"]), true, "site-alert")).toBe(true);
  expect(siteAlertOfferDue(entered, new Set(), false, "site-alert")).toBe(false);
  expect(siteAlertOfferDue(entered, new Set(["site-alert"]), true, "site-alert")).toBe(false);
  expect(siteAlertOfferDue(openedMoments(new Set(), ["launch"]), new Set(), true, "site-alert")).toBe(false);
});
