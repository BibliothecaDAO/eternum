import { toJsonValue } from "../../../../apps/herald/src/model-registry";
import { mkdirSync, writeFileSync } from "node:fs";
import { encodeMembers } from "../../../../apps/herald/src/native/serde";
import { schema } from "../../../../apps/herald/src/native/fixtures";
import { currentPresetFixture, serializePresetRows } from "../../../../apps/herald/src/native/current-preset-fixture";

const directory = new URL("../tests/fixtures/current-presets/", import.meta.url);
mkdirSync(directory, { recursive: true });
const write = (name: string, felts: string[]) => writeFileSync(new URL(name, directory), felts.join("\n") + "\n");
for (const [name, id] of [
  ["blitz", 2],
  ["eternum", 3],
  ["frontier", 5],
] as const) {
  const fixture = currentPresetFixture(id);
  write(`${name}-register.txt`, fixture.registration);
  write(`${name}-create.txt`, fixture.creation);
  write(`${name}-rows.txt`, serializePresetRows(fixture.rows));
  if (id === 3) {
    const current = conformancePreset(fixture.definition);
    write("preset-3.txt", current.felts);
    writeFileSync(new URL("preset-3.json", directory), JSON.stringify(toJsonValue(current.value), null, 2) + "\n");
  }
}
console.log("Generated current Blitz, Eternum and Frontier preset inputs and Herald projections");

function conformancePreset(definition: ReturnType<typeof currentPresetFixture>["definition"]) {
  const value = {
    rules: { ...definition.rules, map_center_offset: 20 },
    resources: definition.resources.resources,
    buildings: definition.structures.buildings,
  };
  const felts = encodeMembers(
    schema,
    [
      { name: "rules", type: "world_native::rules::SliceRules" },
      { name: "resources", type: "core::array::Span::<world_native::resources::ResourceRule>" },
      { name: "buildings", type: "core::array::Span::<world_native::buildings::BuildingRuleConfig>" },
    ],
    value,
  );
  return { value, felts };
}
