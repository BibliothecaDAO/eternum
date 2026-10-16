import { expect, test } from "bun:test";
import { BLITZ_SLOT_PREPARATION_SECONDS } from "../../../packages/value-ledger/src/blitz-slots";
import { slotLaunches } from "./blitz-split";

test("a 2,000-player slot is the production split, dealt to the pool by group index, its settling open now", () => {
  const seaters = Array.from({ length: 16 }, (_, index) => `0x${(index + 1).toString(16)}`);
  const before = Math.floor(Date.now() / 1000);
  const launches = slotLaunches(2000, seaters, Date.now());
  expect(launches.length).toBe(84);
  expect(launches.reduce((sum, launch) => sum + launch.players.length, 0)).toBe(2000);
  expect(new Set(launches.flatMap((launch) => launch.players.map((seat) => seat.account))).size).toBe(2000);
  expect(launches.map((launch) => launch.seater)).toEqual(launches.map((_, index) => seaters[index % 16]));
  for (const launch of launches) {
    const settlingOpens = Date.parse(launch.request.gameStartTime!) / 1000 - BLITZ_SLOT_PREPARATION_SECONDS;
    expect(settlingOpens - before).toBeGreaterThanOrEqual(0);
    expect(settlingOpens - before).toBeLessThanOrEqual(2);
  }
});
