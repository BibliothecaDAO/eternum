import { beforeEach, expect, it } from "vitest";

import { resetEntryDestination, settleEntryDestination, whenEntryDestinationSettled } from "./entry-destination";

beforeEach(resetEntryDestination);

it("holds the map until the entry answers, with the realm it selected", async () => {
  let opened: unknown = "waiting";
  void whenEntryDestinationSettled().then((destination) => (opened = destination));
  await Promise.resolve();
  expect(opened).toBe("waiting");

  settleEntryDestination({ col: 12, row: -4 });
  await Promise.resolve();
  expect(opened).toEqual({ col: 12, row: -4 });
});

it("keeps the first answer of a game: a later selection does not move where the map opened", async () => {
  settleEntryDestination(null);
  settleEntryDestination({ col: 12, row: -4 });

  await expect(whenEntryDestinationSettled()).resolves.toBeNull();
});

it("asks again for a new game", async () => {
  settleEntryDestination({ col: 1, row: 1 });
  resetEntryDestination();
  settleEntryDestination({ col: 2, row: 2 });

  await expect(whenEntryDestinationSettled()).resolves.toEqual({ col: 2, row: 2 });
});
