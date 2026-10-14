// @vitest-environment node
import { ResourcesIds } from "@bibliothecadao/types";
import { expect, it } from "vitest";
import { summarizeStocks } from "./stock-summary";

const stock = (resourceId: ResourcesIds, amount: number, perHour = 0) => ({
  resourceId,
  name: ResourcesIds[resourceId],
  amount,
  perHour,
});
const ids = (stocks: { resourceId: ResourcesIds }[]) => stocks.map((entry) => ResourcesIds[entry.resourceId]);
const TROOPS = [ResourcesIds.Knight, ResourcesIds.Crossbowman];

it("names the economy first, labor, wheat and donkeys even at zero, then the troops held", () => {
  const { summary } = summarizeStocks(
    [
      stock(ResourcesIds.Wood, 40),
      stock(ResourcesIds.Knight, 12),
      stock(ResourcesIds.Crossbowman, 0),
      stock(ResourcesIds.Essence, 0),
      stock(ResourcesIds.Donkey, 0),
      stock(ResourcesIds.Wheat, 300, 20),
      stock(ResourcesIds.Labor, 0, 5),
    ],
    TROOPS,
  );
  expect(ids(summary)).toEqual(["Labor", "Wheat", "Donkey", "Knight"]);
});

it("shows essence in the summary once the realm holds some", () => {
  const { summary } = summarizeStocks([stock(ResourcesIds.Essence, 3)], TROOPS);
  expect(ids(summary)).toEqual(["Essence"]);
});

it("lists every stock held or growing, and nothing empty and idle", () => {
  const { held } = summarizeStocks(
    [stock(ResourcesIds.Wood, 40), stock(ResourcesIds.Coal, 0, 2), stock(ResourcesIds.Copper, 0)],
    TROOPS,
  );
  expect(ids(held)).toEqual(["Wood", "Coal"]);
});
