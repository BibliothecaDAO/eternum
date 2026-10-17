import { expect, it } from "vitest";
import { realmLevelNumber } from "./realm-level";

it("numbers a realm's levels from 1, a Settlement, whatever form the chain gives them in", () => {
  expect([0, 1, 2, 3].map(realmLevelNumber)).toEqual([1, 2, 3, 4]);
  expect(realmLevelNumber(1n)).toBe(2);
});
