import { describe, expect, it } from "bun:test";
import preset from "../../../../contracts/l3/world-native/fixtures/preset-1.json";
import { upgradeRecipes } from "./upgrade-recipes";

describe("upgrade recipe inputs", () => {
  it("preserves configured level and cost order independently of table transport order", () => {
    const tables = preset.oraclePreset.sideTables;
    const expected = upgradeRecipes(tables);
    expect(expected.map((recipe) => recipe.costs.length)).toEqual([4, 5, 7]);
    expect(upgradeRecipes({ ...tables, structure_levels: [...tables.structure_levels].reverse(), resource_lists: [...tables.resource_lists].reverse() })).toEqual(expected);
  });

  it("rejects missing levels or recipe rows before a game is configured", () => {
    const tables = preset.oraclePreset.sideTables;
    expect(() => upgradeRecipes({ ...tables, structure_levels: tables.structure_levels.slice(1) })).toThrow("Missing upgrade level");
    const resource_lists = tables.resource_lists.filter((row) => row.entity_id !== tables.structure_levels[0].required_resources_id || row.index !== 0);
    expect(() => upgradeRecipes({ ...tables, resource_lists })).toThrow("Incomplete upgrade recipe");
  });
});
