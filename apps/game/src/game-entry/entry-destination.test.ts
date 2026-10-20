import { Position } from "@bibliothecadao/eternum";
import { beforeEach, expect, it } from "vitest";

import { resetEntryDestination, settleEntryDestination, whenEntryDestinationSettled } from "./entry-destination";

const REALM = Position.fromContract({ x: 2790, y: 8850 });
const OTHER_REALM = Position.fromContract({ x: 2791, y: 8850 });

beforeEach(resetEntryDestination);

it("holds the map until the entry answers, with the realm it selected", async () => {
  let opened: unknown = "waiting";
  void whenEntryDestinationSettled().then((destination) => (opened = destination));
  await Promise.resolve();
  expect(opened).toBe("waiting");

  settleEntryDestination(REALM);
  await Promise.resolve();
  expect(opened).toBe(REALM);
});

it("keeps the first answer of a game: a later selection does not move where the map opened", async () => {
  settleEntryDestination(null);
  settleEntryDestination(REALM);

  await expect(whenEntryDestinationSettled()).resolves.toBeNull();
});

it("asks again for a new game", async () => {
  settleEntryDestination(REALM);
  resetEntryDestination();
  settleEntryDestination(OTHER_REALM);

  await expect(whenEntryDestinationSettled()).resolves.toBe(OTHER_REALM);
});
