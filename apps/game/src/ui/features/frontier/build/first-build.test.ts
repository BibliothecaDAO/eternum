import { BuildingType } from "@bibliothecadao/types";
import { expect, it } from "vitest";

import { disclosedBuildOptions, FIRST_BUILD } from "./first-build";

const option = (category: BuildingType, standing: unknown = "open", populationCost = 5) => ({
  category,
  standing,
  populationCost,
});
const barracks = option(FIRST_BUILD);
const hut = option(BuildingType.WorkersHut, "open", 0);

it("offers the first Barracks alone while it can be raised, and every option once the list is open", () => {
  expect(disclosedBuildOptions([hut, barracks], false, 12)).toEqual([barracks]);
  expect(disclosedBuildOptions([hut, barracks], true, 12)).toEqual([hut, barracks]);
});

it("keeps the Hut reachable for a realm that has no room for the Barracks, with no Show everything", () => {
  expect(disclosedBuildOptions([hut, barracks], false, 2)).toEqual([hut, barracks]);
  expect(disclosedBuildOptions([hut, barracks], false, undefined)).toEqual([hut, barracks]);
  expect(disclosedBuildOptions([hut, option(FIRST_BUILD, { gate: 3, bought: 1 })], false, 12)).toHaveLength(2);
});
