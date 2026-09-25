import { compileCommandRoutes } from "./command-routes.mjs";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { eventLayouts, uniqueEventLayouts } from "./event-layouts.mjs";
import { defineFactModels, factWireTypes, syncScopes, executionRecordedVersion } from "../schema/fact-models.mjs";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { hash, shortString } from "starknet";
import { toJsonValue } from "../../../../apps/herald/src/model-registry.ts";

const root = new URL("../", import.meta.url);
// Use Herald's SDK instance so enum instances reach its canonical JSON projection.
const { CallData } = await import(
  Bun.resolveSync("starknet", fileURLToPath(new URL("../../../../apps/herald/src/", import.meta.url)))
);
const gamesAbi = await readContractAbi("Games");
const logicClasses = Object.fromEntries(
  gamesAbi
    .find((item) => item.name === "games_storage::release::LogicClasses")
    .members.map(({ name }) => [name, `${name[0].toUpperCase()}${name.slice(1)}Logic`]),
);
const artifacts = {
  games: gamesAbi,
  ...Object.fromEntries(
    await Promise.all(Object.entries(logicClasses).map(async ([logic, name]) => [logic, await readContractAbi(name)])),
  ),
};

async function readContractAbi(name) {
  const artifact = JSON.parse(await readFile(new URL(`target/dev/world_native_${name}.contract_class.json`, root)));
  return artifact.abi;
}

const types = new Map();
for (const abi of [...Object.values(artifacts), factWireTypes]) {
  for (const item of abi) {
    if (item.type === "struct" || item.type === "enum") {
      if (types.has(item.name) && JSON.stringify(types.get(item.name)) !== JSON.stringify(item)) {
        throw new Error(`Conflicting ABI type ${item.name}`);
      }
      types.set(item.name, item);
    }
  }
}

const routes = compileCommandRoutes(artifacts, types, feltLength);
types.set(routes.command.name, routes.command);
await writeCairo("src/command_routes.cairo", routes.cairo);

// Serialization projections use the types carried by the production gameplay and preset ABIs.
// These bindings do not add entrypoints to Games.
const commandInterface = {
  type: "interface",
  name: "NativeCommandEncoding",
  items: [
    {
      type: "function",
      name: "command_commitment",
      inputs: [{ name: "command", type: "world_native::commands::Command" }],
      outputs: [],
      state_mutability: "view",
    },
  ],
};
if (!types.has("world_native::commands::Command"))
  throw new Error("Missing command encoding type world_native::commands::Command");
const commandTypes = new Set();
function includeCommandType(name) {
  const nested = name.match(/::<(.+)>$/)?.[1];
  if (nested && !types.has(name)) includeCommandType(nested);
  if (commandTypes.has(name) || !types.has(name)) return;
  commandTypes.add(name);
  const item = types.get(name);
  for (const field of item.members ?? item.variants) includeCommandType(field.type);
  if (nested) includeCommandType(nested);
}
for (const method of commandInterface.items) {
  for (const field of [...method.inputs, ...method.outputs]) includeCommandType(field.type);
}
const commandAbi = [commandInterface, ...[...commandTypes].map((name) => types.get(name))];

function struct(name) {
  const item = types.get(`world_native::${name}`);
  if (item?.type !== "struct") throw new Error(`Missing ABI struct ${name}`);
  return item.members;
}

function feltLength(type) {
  if (type === "()") return 0;
  if (/^core::array::(Span|Array)::</.test(type)) return null;
  const item = types.get(type);
  if (item?.type === "struct") return sumLengths(item.members.map((member) => feltLength(member.type)));
  if (item?.type === "enum") {
    const lengths = item.variants.map((variant) => feltLength(variant.type));
    if (lengths.includes(null) || new Set(lengths).size !== 1) return null;
    return 1 + lengths[0];
  }
  if (
    /^core::(felt252|integer::u(8|16|32|64|128)|starknet::(contract_address::ContractAddress|class_hash::ClassHash))$/.test(
      type,
    )
  ) {
    return 1;
  }
  throw new Error(`Unsupported row type ${type}`);
}

function sumLengths(lengths) {
  return lengths.includes(null) ? null : lengths.reduce((sum, length) => sum + length, 0);
}

function model(name, scope, keys, members, emitterKey) {
  if (scope === "game" && keys[0]?.name !== "game_id") throw new Error(`Missing leading game key for ${name}`);
  return {
    name,
    identity: shortString.encodeShortString(name),
    scope,
    ...(emitterKey ? { emitterKey } : {}),
    keys: keys.map((key) => ({ ...key, feltLength: feltLength(key.type) })),
    members: members.map((member) => ({
      ...member,
      id: shortString.encodeShortString(member.name),
      feltLength: feltLength(member.type),
    })),
    keyLength: keys.reduce((length, key) => length + feltLength(key.type), 0),
    valueLength: sumLengths(members.map((member) => feltLength(member.type))),
  };
}

const models = defineFactModels({ struct, model });

const ruleSource = await readFile(new URL("src/rules.cairo", root), "utf8");
const ruleConstants = Object.fromEntries(
  [...ruleSource.matchAll(/^pub const ([A-Z][A-Z0-9_]*): u(?:8|32) = ([0-9]+);$/gm)].map(([, name, value]) => [
    name,
    Number(value),
  ]),
);

const mapSource = await readFile(new URL("src/map.cairo", root), "utf8");
const tileOccupierConstants = Object.fromEntries(
  [...mapSource.matchAll(/^pub const ([A-Z][A-Z0-9_]*_OCCUPIER): u8 = ([0-9]+);$/gm)].map(([, name, value]) => [
    name,
    Number(value),
  ]),
);

const tilePackingConstants = Object.fromEntries(
  ["BIOME_SCALE", "BYTE_RANGE", "REWARD_EXTRACTED_FLAG"].map((name) => {
    const value = mapSource.match(
      new RegExp(`^(?:pub\\(crate\\) )?const ${name}: u128 = (0x[0-9a-fA-F]+);$`, "m"),
    )?.[1];
    if (!value) throw new Error(`Missing Cairo tile packing constant ${name}`);
    return [name, value];
  }),
);

// Every library emits in Games' context. A prefix must identify exactly one layout.
const gamesEvents = uniqueEventLayouts(Object.values(artifacts).flatMap(eventLayouts));
const productionAbi = Object.values(artifacts).flat();

const schema = {
  ruleConstants,
  tileOccupierConstants,
  tilePackingConstants,
  logicClasses,
  version: 2,
  cairoVersion: "2.17.0",
  encoding: "cairo-serde",
  modelIdentity: "short-string",
  memberIdentity: "short-string",
  games: {
    contract: "Games",
    events: gamesEvents,
    entrypoints: gamesAbi.flatMap((item) =>
      item.type === "interface" ? item.items : item.type === "function" ? [item] : [],
    ),
  },
  models,
  events: [
    {
      name: "BatchProgress",
      scope: "game",
      version: 1,
      event: productionAbi.find(
        (item) => item.type === "event" && item.name === "world_native::commands::BatchProgress",
      ),
    },
    {
      name: "ExecutionRecorded",
      scope: "deployment",
      version: executionRecordedVersion,
      event: productionAbi.find(
        (item) => item.type === "event" && item.name === "eternum_randomness_protocol::recording::ExecutionRecorded",
      ),
    },
    {
      name: "PointsAwarded",
      scope: "game",
      version: 1,
      event: productionAbi.find((item) => item.type === "event" && item.name === "world_native::game::PointsAwarded"),
    },
    {
      name: "StoryEvent",
      scope: "game",
      version: 1,
      event: productionAbi.find((item) => item.type === "event" && item.name === "world_native::ownership::StoryEvent"),
    },
    {
      name: "BattleEvent",
      scope: "game",
      version: 1,
      event: productionAbi.find((item) => item.type === "event" && item.name === "world_native::troops::BattleEvent"),
    },
    {
      name: "RaidEvent",
      scope: "game",
      version: 1,
      event: productionAbi.find(
        (item) => item.type === "event" && item.name === "world_native::combat_actions::RaidEvent",
      ),
    },
  ],
  types: Object.fromEntries([...types].sort(([left], [right]) => left.localeCompare(right))),
};
schema.identity = createHash("sha256").update(JSON.stringify(schema)).digest("hex");
await writeJson("schema/schema.json", schema);
await writeFixtures(schema);

async function writeCairo(path, value) {
  const temporary = await mkdtemp(fileURLToPath(new URL("src/.command-routes-", root)));
  try {
    const input = join(temporary, "routes.cairo");
    await writeFile(input, value);
    execFileSync("scarb", ["fmt", input], { cwd: fileURLToPath(root), encoding: "utf8" });
    const formatted = await readFile(input, "utf8");
    const target = new URL(path, root);
    if (process.argv.includes("--check")) {
      if ((await readFile(target, "utf8")) !== formatted) throw new Error(`Generated artifact differs: ${path}`);
    } else {
      await writeFile(target, formatted);
    }
  } finally {
    await rm(temporary, { recursive: true });
  }
}

async function writeJson(path, value) {
  const url = new URL(path, root);
  await mkdir(new URL("./", url), { recursive: true });
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (process.argv.includes("--check")) {
    if ((await readFile(url, "utf8")) !== text) throw new Error(`Generated artifact differs: ${path}`);
    return;
  }
  await writeFile(url, text);
}

async function writeFixtures(schema) {
  const emitter = "0x100";
  const deployment = { games: emitter };
  const model = schema.models.find((model) => model.name === "ExplorerTroops");
  function raw(name, values = []) {
    const layout = schema.games.events.find(
      (event) => event.name === name && event.prefix[0] === hash.getSelectorFromName("TroopEvent"),
    );
    const keys = [...layout.prefix, "0x1", model.identity];
    if (name === "RowMemberSet") keys.push(shortString.encodeShortString("troops"));
    const data = [2, 1, 7];
    if (name !== "RowDeleted") data.push(values.length, ...values);
    return { from_address: emitter, keys, data: data.map((value) => `0x${BigInt(value).toString(16)}`) };
  }
  // These values match the raw events asserted by the Cairo event-shape test.
  const zeroTroops = Array(14).fill(0);
  const decoder = new CallData([
    ...Object.values(schema.types),
    { type: "function", name: "key", inputs: [], outputs: model.keys, state_mutability: "view" },
    { type: "function", name: "value", inputs: [], outputs: model.members, state_mutability: "view" },
  ]);
  const values = [7, ...zeroTroops];
  const key = toJsonValue(decoder.parse("key", ["1", "7"]));
  const value = toJsonValue(decoder.parse("value", values.map(String)));
  const troops = value.troops;
  const set = raw("RowSet", values);
  const fixture = {
    schemaIdentity: schema.identity,
    deployment,
    raw: set,
    expected: { kind: "set", model: model.name, key, value },
  };
  await writeJson("schema/fixtures/row-set.json", fixture);
  const updatedTroops = [...zeroTroops];
  updatedTroops[2] = 25;
  await writeJson("schema/fixtures/row-member-set.json", {
    ...fixture,
    before: { key, value },
    raw: raw("RowMemberSet", updatedTroops),
    expected: { kind: "set", model: model.name, key, value: { ...value, troops: { ...troops, count: "0x19" } } },
  });
  await writeJson("schema/fixtures/row-deleted.json", {
    ...fixture,
    before: { key, value },
    raw: raw("RowDeleted"),
    expected: { kind: "delete", model: model.name, key },
  });
  await writeJson("schema/fixtures/foreign-emitter.json", {
    ...fixture,
    raw: { ...set, from_address: "0x999" },
    expected: { error: "foreign-emitter" },
  });
  await writeJson("schema/fixtures/malformed-row.json", {
    ...fixture,
    raw: { ...set, data: set.data.slice(0, -1) },
    expected: { error: "malformed-row" },
  });
}
console.log(`Generated ${schema.models.length} models at ${fileURLToPath(new URL("schema/schema.json", root))}`);

await writeJson("schema/bindings.json", {
  schemaIdentity: schema.identity,
  commandAbi,
  events: schema.events.map(({ name, scope }) => ({ name, scope })),
  models: [
    ...schema.models.map((model) => ({
      name: model.name,
      scope: model.scope,
    })),
  ],
});

async function writeText(path, text) {
  const url = new URL(path, root);
  if (process.argv.includes("--check")) {
    if ((await readFile(url, "utf8")) !== text) throw new Error(`Generated artifact differs: ${path}`);
  } else {
    await mkdir(new URL("./", url), { recursive: true });
    await writeFile(url, text);
  }
}

function factType(type) {
  if (type === "core::bool") return { ts: "boolean", wire: "boolean" };
  if (type === "core::felt252" || type.endsWith("::ContractAddress") || type.endsWith("::ClassHash"))
    return { ts: "bigint", wire: "felt" };
  const integer = /^core::integer::u(8|16|32|64|128|256)$/.exec(type);
  if (integer) return { ts: Number(integer[1]) <= 32 ? "number" : "bigint", wire: `u${integer[1]}` };
  const span = /^core::array::(?:Span|Array)::<(.+)>$/.exec(type);
  if (span) {
    const item = factType(span[1]);
    return { ts: `readonly (${item.ts})[]`, wire: [item.wire] };
  }
  const option = /^core::option::Option::<(.+)>$/.exec(type);
  if (option) {
    const item = factType(option[1]);
    return { ts: `(${item.ts}) | null`, wire: { option: item.wire } };
  }
  const definition = types.get(type);
  if (definition?.type === "enum" && definition.variants.every((variant) => variant.type === "()")) {
    const variants = definition.variants.map((variant) => variant.name);
    return { ts: variants.map(JSON.stringify).join(" | "), wire: { enum: variants } };
  }
  if (definition?.type === "struct") return factMembers(definition.members);
  throw new Error(`Unsupported native fact type ${type}`);
}

function factMembers(members) {
  const fields = members.map((member) => [member.name, factType(member.type)]);
  return {
    ts: `{ ${fields.map(([name, type]) => `readonly ${name}: ${type.ts}`).join("; ")} }`,
    wire: Object.fromEntries(fields.map(([name, type]) => [name, type.wire])),
  };
}

const factRows = schema.models.map((model) => [model.name, factMembers([...model.keys, ...model.members])]);

/** Every fact and event needs a subscription scope whose fields exist, or generation stops here. */
function validatedSyncScopes() {
  const fields = new Map([
    ...schema.models.map((model) => [model.name, new Set([...model.keys, ...model.members].map(({ name }) => name))]),
    ...schema.events.map(({ name, event }) => [name, new Set(event.members.map((member) => member.name))]),
  ]);
  const missing = [...fields.keys()].filter((name) => !Object.hasOwn(syncScopes, name));
  if (missing.length > 0) throw new Error(`No subscription scope for ${missing.join(", ")}`);
  const unknown = Object.keys(syncScopes).filter((name) => !fields.has(name));
  if (unknown.length > 0) throw new Error(`Subscription scope for unknown facts ${unknown.join(", ")}`);
  for (const [name, rule] of Object.entries(syncScopes)) {
    if (rule === "shared" || rule === "actor" || rule === "internal") continue;
    const { epoch, regions = [], ...sets } = rule;
    const named = [...Object.values(sets).flat(), ...regions.flatMap((region) => Object.values(region))];
    if (epoch !== undefined) named.push(epoch);
    const absent = named.filter((field) => !fields.get(name).has(field));
    if (absent.length > 0) throw new Error(`Subscription scope for ${name} names unknown fields ${absent.join(", ")}`);
  }
  return syncScopes;
}
const declarations = [
  "// Generated from native fact models and contract ABIs. Run the native schema generator to update.",
  `export const nativeFactSchemaIdentity = ${JSON.stringify(schema.identity)};`,
  `export const nativeRuleConstants = ${JSON.stringify(ruleConstants, null, 2)} as const;`,
  `export const nativeTileOccupierConstants = ${JSON.stringify(tileOccupierConstants, null, 2)} as const;`,
  `export const nativeTilePackingConstants = ${JSON.stringify(tilePackingConstants, null, 2)} as const;`,
  "export interface NativeRows {",
  ...factRows.map(([name, row]) => `  ${name}: ${row.ts};`),
  "}",
  "export interface NativeKeys {",
  ...schema.models.map((model) => `  ${model.name}: ${factMembers(model.keys).ts};`),
  "}",
  "export type NativeModelName = keyof NativeRows;",
  `export const nativeFactModels = ${JSON.stringify(
    Object.fromEntries(
      schema.models.map((model, index) => [
        model.name,
        {
          keys: model.keys.map((member) => member.name),
          scope: model.scope,
          fields: factRows[index][1].wire,
        },
      ]),
    ),
    null,
    2,
  )} as const;`,
  `export const nativeSyncScopes = ${JSON.stringify(validatedSyncScopes(), null, 2)} as const;`,
];
await writeText("schema/client.gen.ts", declarations.join("\n") + "\n");

function commandType(type) {
  if (type === "()") return "undefined";
  if (type === "core::bool") return "boolean";
  if (
    type === "core::felt252" ||
    type.endsWith("::ContractAddress") ||
    type.endsWith("::ClassHash") ||
    /^core::integer::u/.test(type)
  )
    return "BigNumberish";
  const span = /^core::array::(?:Span|Array)::<(.+)>$/.exec(type);
  if (span) return `readonly (${commandType(span[1])})[]`;
  const item = types.get(type);
  if (item?.type === "struct")
    return `{ ${item.members.map(({ name, type }) => `readonly ${name}: ${commandType(type)}`).join("; ")} }`;
  if (item?.type === "enum")
    return item.variants
      .map(({ name, type }) => `{ readonly kind: ${JSON.stringify(name)}; readonly value: ${commandType(type)} }`)
      .join(" | ");
  throw new Error(`Unsupported native command type ${type}`);
}
const command = types.get("world_native::commands::Command");
const commandBits = Object.fromEntries(
  command.variants.map(({ name }, index) => [name, (1n << BigInt(index)).toString()]),
);
await writeText(
  "schema/commands.gen.ts",
  [
    "// Generated from command routes and production payload ABIs. Run the native schema generator to update.",
    'import type { BigNumberish } from "starknet";',
    `export const nativeCommandBits = ${JSON.stringify(commandBits, null, 2)} as const;`,
    "export interface NativeCommandPayloads {",
    ...command.variants.map(({ name, type }) => `  ${name}: ${commandType(type)};`),
    "}",
    "export type NativeCommand = { [K in keyof NativeCommandPayloads]: { kind: K; value: NativeCommandPayloads[K] } }[keyof NativeCommandPayloads];",
  ].join("\n") + "\n",
);
