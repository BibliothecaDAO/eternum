import { BuildingType } from "@bibliothecadao/types";
import { expect, it } from "vitest";

import { disclosedBuildOptions, FIRST_BUILD } from "./first-build";

const option = (category: BuildingType, standing: unknown = "open") => ({ category, standing });
const barracks = option(FIRST_BUILD);
const farm = option(BuildingType.ResourceWheat);

it("offers the first Barracks alone while it is open, and every option once the list is open", () => {
  expect(disclosedBuildOptions([farm, barracks], false)).toEqual([barracks]);
  expect(disclosedBuildOptions([farm, barracks], true)).toEqual([farm, barracks]);
});

it("keeps every option for a realm whose Barracks is not open, with no Show everything", () => {
  expect(disclosedBuildOptions([farm, option(FIRST_BUILD, "built")], false)).toEqual([
    farm,
    option(FIRST_BUILD, "built"),
  ]);
  expect(disclosedBuildOptions([farm, option(FIRST_BUILD, { level: 1 })], false)).toHaveLength(2);
});
