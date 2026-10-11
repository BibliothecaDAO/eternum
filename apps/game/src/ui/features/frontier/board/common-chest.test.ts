import { expect, it } from "vitest";

import { commonChestOf } from "./season-board";

it("pays a common chest its tier's shares at the preset's one price, with no day's budget read", () => {
  const shares = { common: 2, uncommon: 4, rare: 8, epic: 20, legendary: 40 };
  // The chest rules alone decide it: the price a share is the preset's, fixed for the season.
  expect(commonChestOf({ shares, price: 15n })).toEqual({ tier: 1, lords: 30 });
  expect(commonChestOf({ shares: { ...shares, common: 1 }, price: 15n })).toEqual({ tier: 1, lords: 15 });
});
