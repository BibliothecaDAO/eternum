import { expect, it } from "vitest";
import { staminaTone } from "./stamina-tone";

it("reads an army's unknown stamina as unknown, never as short", () => {
  expect(staminaTone(undefined, 30)).toEqual({ color: "text-gold/60", isLow: false });
  expect(staminaTone(10n, 30).isLow).toBe(true);
  expect(staminaTone(30n, 30)).toEqual({ color: "text-order-brilliance", isLow: false });
  expect(staminaTone(0n, 0).isLow).toBe(false);
});
