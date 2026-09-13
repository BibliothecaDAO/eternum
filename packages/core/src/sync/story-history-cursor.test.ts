import { expect, it } from "vitest";
import {
  parseStoryHistoryCursor,
  encodeStoryHistoryCursor,
  compareStoryHistoryCursors,
  endOfStoryBlock,
} from "./story-history-cursor";
it("round-trips receipt position cursors and orders within one block", () => {
  expect(parseStoryHistoryCursor(encodeStoryHistoryCursor({ block: 50, transaction: 2, event: 3 }))).toEqual({
    block: 50,
    transaction: 2,
    event: 3,
  });
  expect(
    compareStoryHistoryCursors({ block: 50, transaction: 2, event: 3 }, { block: 50, transaction: 2, event: 4 }),
  ).toBeLessThan(0);
  expect(compareStoryHistoryCursors(endOfStoryBlock(50), { block: 51, transaction: 0, event: 0 })).toBeLessThan(0);
});
it.each(["-1:0:0", "1:2", "1:2:3junk", "9007199254740992:0:0", "1:2147483648:0", { block: 1 }, null])(
  "rejects malformed cursor %j",
  (value) => {
    expect(() => parseStoryHistoryCursor(value)).toThrow();
  },
);
