import { expect, test } from "bun:test";
import { prepareHomeCalls } from "./game-setup";
test("96 open-season homes are prepared privately in the published batches of at most 64", () => {
  const calls = prepareHomeCalls(
    "0x123",
    7,
    Array.from({ length: 96 }, (_, index) => String(index + 1)),
  );
  expect(calls).toHaveLength(2);
  expect(calls.map((call) => call.entrypoint)).toEqual(["prepare_homes", "prepare_homes"]);
  expect(calls.map((call) => BigInt(call.calldata[1]!))).toEqual([64n, 32n]);
  expect(calls.every((call) => BigInt(call.calldata[0]!) === 7n)).toBe(true);
});
test("repeated owners are refused before any allocation call is built", () => {
  expect(() => prepareHomeCalls("0x123", 7, ["1", "0x1"])).toThrow("distinct approved owners");
});
