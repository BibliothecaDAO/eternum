import { shortString } from "starknet";
import { schema as compiledSchema } from "../../../../apps/herald/src/native/fixtures";
import { schemaIdentity, type NativeMember, type NativeSchema } from "../../../../apps/herald/src/native/schema";
import { defineFactModels } from "../schema/fact-models.mjs";
import { toJsonValue } from "../../../../apps/herald/src/model-registry";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { encodeMembers } from "../../../../apps/herald/src/native/serde";
import { currentPresetFixture, serializePresetRows } from "../../../../apps/herald/src/native/current-preset-fixture";

const schema = presetFixtureSchema();

const directory = new URL("../tests/fixtures/current-presets/", import.meta.url);
mkdirSync(directory, { recursive: true });
const write = (name: string, felts: string[]) => writeFileSync(new URL(name, directory), felts.join("\n") + "\n");
for (const [name, id] of [
  ["blitz", 2],
  ["eternum", 3],
  ["frontier", 5],
] as const) {
  const fixture = await currentPresetFixture(id, schema);
  write(`${name}-register.txt`, fixture.registration);
  write(`${name}-create.txt`, fixture.creation);
  write(`${name}-rows.txt`, serializePresetRows(fixture.rows, schema));
  if (id === 5) {
    writeFileSync(new URL("../frontier-command-mask.txt", directory), `${fixture.definition.rules.command_mask}\n`);
  }
  if (id === 3) {
    const current = conformancePreset(fixture.definition);
    write("preset-3.txt", current.felts);
    writeFileSync(new URL("preset-3.json", directory), JSON.stringify(toJsonValue(current.value), null, 2) + "\n");
  }
}
console.log("Generated current Blitz, Eternum and Frontier preset inputs and Herald projections");

function conformancePreset(definition: Awaited<ReturnType<typeof currentPresetFixture>>["definition"]) {
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

/** Fixture encoding can follow source edits before the single landing compile; production bindings still require ABI. */
function presetFixtureSchema(): NativeSchema {
  const schema = structuredClone(compiledSchema);
  for (const module of ["entry", "presets", "relics", "registrar", "blitz_results"]) readStructs(schema, module);
  schema.models = defineFactModels({
    struct: (name: string) => {
      const type = schema.types[`world_native::${name}`];
      if (type?.type !== "struct") throw new Error(`Missing fixture struct ${name}`);
      return type.members;
    },
    model: (
      name: string,
      scope: "game" | "deployment",
      keys: NativeMember[],
      members: NativeMember[],
      emitterKey?: string,
    ) => fixtureModel(schema, name, scope, keys, members, emitterKey),
  });
  schema.identity = schemaIdentity(schema);
  return schema;
}

function fixtureModel(
  schema: NativeSchema,
  name: string,
  scope: "game" | "deployment",
  keys: NativeMember[],
  members: NativeMember[],
  emitterKey?: string,
) {
  const previous = compiledSchema.models.find((model) => model.name === name);
  return {
    ...previous,
    name,
    scope,
    identity: shortString.encodeShortString(name),
    ...(emitterKey ? { emitterKey } : {}),
    keys: keys.map((key) => ({ ...key, feltLength: feltLength(schema, key.type) })),
    members: members.map((member) => ({
      ...member,
      id: shortString.encodeShortString(member.name),
      feltLength: feltLength(schema, member.type),
    })),
    keyLength: keys.reduce((sum, key) => {
      const length = feltLength(schema, key.type);
      if (length === null) throw new Error(`Variable fixture key ${name}.${key.name}`);
      return sum + length;
    }, 0),
    valueLength: sumLengths(members.map((member) => feltLength(schema, member.type))),
  };
}

function readStructs(schema: NativeSchema, module: string): void {
  const source = readFileSync(new URL(`../src/${module}.cairo`, import.meta.url), "utf8");
  for (const declaration of source.matchAll(/pub struct (\w+)\s*\{([^}]+)\}/g)) {
    const name = `world_native::${module}::${declaration[1]}`;
    const previous = schema.types[name];
    const fields = [...declaration[2].matchAll(/pub (\w+):\s*([^\n]+),/g)];
    const declaredFields = [...declaration[2].matchAll(/\bpub\s+\w+\s*:/g)].length;
    if (!fields.length || fields.length !== declaredFields) throw new Error(`Unsupported fixture declaration ${name}`);
    schema.types[name] = {
      type: "struct",
      name,
      members: fields.map((field) => {
        const old =
          previous?.type === "struct" ? previous.members.find((member) => member.name === field[1]) : undefined;
        return { name: field[1], type: resolveType(schema, field[2].trim(), old?.type) };
      }),
    };
  }
}

function resolveType(schema: NativeSchema, source: string, previous?: string): string {
  const generic = /^(Option|Span)<(.+)>$/.exec(source);
  if (generic) {
    const inner = resolveType(schema, generic[2]);
    if (generic[1] === "Span") return `core::array::Span::<${inner}>`;
    const name = `core::option::Option::<${inner}>`;
    schema.types[name] = {
      type: "enum",
      name,
      variants: [
        { name: "Some", type: inner },
        { name: "None", type: "()" },
      ],
    };
    return name;
  }
  if (/^u(8|16|32|64|128|256)$/.test(source)) return `core::integer::${source}`;
  if (source === "felt252") return "core::felt252";
  if (source === "bool") return "core::bool";
  if (source === "ContractAddress") return "core::starknet::contract_address::ContractAddress";
  if (source.startsWith("crate::")) return source.replace(/^crate::/, "world_native::");
  const candidates = Object.keys(schema.types).filter((name) => name.endsWith(`::${source}`));
  if (candidates.length === 1) return candidates[0]!;
  if (previous?.endsWith(`::${source}`)) return previous;
  throw new Error(`Unsupported fixture field type ${source}`);
}

function feltLength(schema: NativeSchema, name: string): number | null {
  if (name === "()") return 0;
  if (/^core::array::(?:Span|Array)::</.test(name)) return null;
  const type = schema.types[name];
  if (type?.type === "struct") return sumLengths(type.members.map((member) => feltLength(schema, member.type)));
  if (type?.type === "enum") {
    const lengths = type.variants.map((variant) => feltLength(schema, variant.type));
    return lengths.includes(null) || new Set(lengths).size !== 1 ? null : 1 + lengths[0]!;
  }
  if (name.startsWith("(")) return null;
  if (
    /^core::(?:felt252|integer::u(?:8|16|32|64|128)|starknet::(?:contract_address::ContractAddress|class_hash::ClassHash))$/.test(
      name,
    )
  )
    return 1;
  throw new Error(`Unsupported fixture layout ${name}`);
}

function sumLengths(lengths: (number | null)[]): number | null {
  return lengths.includes(null) ? null : lengths.reduce<number>((sum, length) => sum + length!, 0);
}
