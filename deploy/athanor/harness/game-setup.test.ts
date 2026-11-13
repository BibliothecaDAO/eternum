import { test, expect } from "bun:test";
import { harnessSeasonSeconds, launchHarnessGame } from "./game-setup";

test.each([3, 103])("retired preset %s cannot launch before any network access", async (presetId) => {
  await expect(launchHarnessGame({ gameName: "retired", presetId, minutes: 1 })).rejects.toThrow(
    `Unsupported native preset ${presetId}`,
  );
});

test("A harness game outlasts its run by an hour and ends on an army tick", () => {
  expect(harnessSeasonSeconds(1, 30)).toBe(5400);
  expect(harnessSeasonSeconds(40, 31)).toBe(5480);
  expect(harnessSeasonSeconds(120, 30)).toBe(5400);
});
