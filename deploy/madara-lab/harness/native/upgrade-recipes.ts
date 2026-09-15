import type preset from "../../../../contracts/l3/world-native/fixtures/preset-1.json";

export function upgradeRecipes(tables: typeof preset.oraclePreset.sideTables) {
  return [...tables.structure_levels].sort((a, b) => a.level - b.level).map((level, index) => {
    if (level.level !== index + 1) throw new Error(`Missing upgrade level ${index + 1}`);
    const resources = tables.resource_lists
      .filter((row) => row.entity_id === level.required_resources_id)
      .sort((a, b) => a.index - b.index);
    if (resources.length !== level.required_resource_count || resources.some((row, index) => row.index !== index))
      throw new Error(`Incomplete upgrade recipe for level ${level.level}`);
    return { costs: resources.map(({ resource_type, amount }) => ({ resource_type, amount })) };
  });
}
