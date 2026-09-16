import { defineFactModels } from "../schema/fact-models.mjs";
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
const contracts = {
  season: "SeasonDomain",
  map: "MapDomain",
  troops: "TroopsDomain",
  structures: "StructuresDomain",
  settlement: "SettlementDomain",
  resources: "ResourcesDomain",
};
const artifacts = Object.fromEntries(
  await Promise.all(
    Object.entries(contracts).map(async ([domain, name]) => {
      const artifact = JSON.parse(await readFile(new URL(`target/dev/world_native_${name}.contract_class.json`, root)));
      return [domain, artifact.abi];
    }),
  ),
);
const types = new Map();
for (const abi of Object.values(artifacts)) {
  for (const item of abi) {
    if (item.type === "struct" || item.type === "enum") {
      if (types.has(item.name) && JSON.stringify(types.get(item.name)) !== JSON.stringify(item)) {
        throw new Error(`Conflicting ABI type ${item.name}`);
      }
      types.set(item.name, item);
    }
  }
}

function struct(name) {
  const item = types.get(`world_native::${name}`);
  if (item?.type !== "struct") throw new Error(`Missing ABI struct ${name}`);
  return item.members;
}

function method(domain, name) {
  const item = artifacts[domain].flatMap((item) => item.items ?? []).find((item) => item.name === name);
  if (!item) throw new Error(`Missing ABI method ${domain}.${name}`);
  return item;
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

function model(name, owners, scope, keys, members, emitterKey) {
  return {
    name,
    identity: shortString.encodeShortString(name),
    owners,
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

const models = defineFactModels({ contracts, struct, method, model, types });

function eventLayouts(abi) {
  const events = new Map(abi.filter((item) => item.type === "event").map((item) => [item.name, item]));
  const rootEvent = [...events.values()].find((item) => item.kind === "enum" && /Domain::Event$/.test(item.name));
  if (!rootEvent) throw new Error("Missing contract event root");
  const layouts = [];
  function visit(event, prefix) {
    if (event.kind === "enum") {
      for (const variant of event.variants) {
        visit(
          events.get(variant.type),
          variant.kind === "flat" ? prefix : [...prefix, hash.getSelectorFromName(variant.name)],
        );
      }
      return;
    }
    const name = event.name.split("::").at(-1);
    if (!["RowSet", "RowMemberSet", "RowDeleted", "BattleEvent", "StoryEvent"].includes(name))
      throw new Error(`Unexpected event ${name}`);
    layouts.push({ name, prefix, members: event.members });
  }
  visit(rootEvent, []);
  return layouts;
}

const schema = {
  version: 1,
  cairoVersion: "2.13.1",
  encoding: "cairo-serde",
  modelIdentity: "short-string",
  memberIdentity: "short-string",
  domains: Object.fromEntries(
    Object.entries(contracts).map(([domain, contract]) => [
      domain,
      {
        contract,
        systems:
          domain === "season"
            ? [
                "troop_management_systems",
                "troop_movement_systems",
                "troop_battle_systems",
                "alt_movement_systems",
                "ownership_systems",
                "name_systems",
                "structure_systems",
                "resource_systems",
              ]
            : [],
        events: eventLayouts(artifacts[domain]),
        entrypoints: artifacts[domain].filter((item) => item.type === "interface").flatMap((item) => item.items),
      },
    ]),
  ),
  models,
  absentCollections: ["WorldConfig", "BlitzSettlement", "PresetConfig", "HyperstructureShareholders"],
  projections: [
    {
      name: "StoryEvent",
      owners: ["structures", "resources"],
      scope: "game",
      version: 1,
      derivedRows: [],
      event: artifacts.structures.find(
        (item) => item.type === "event" && item.name === "world_native::ownership::StoryEvent",
      ),
    },
    {
      name: "BattleEvent",
      owners: ["troops"],
      scope: "game",
      version: 1,
      derivedRows: ["LastBattle"],
      event: artifacts.troops.find(
        (item) => item.type === "event" && item.name === "world_native::troops::BattleEvent",
      ),
    },
  ],
  types: Object.fromEntries([...types].sort(([left], [right]) => left.localeCompare(right))),
};
schema.identity = createHash("sha256").update(JSON.stringify(schema)).digest("hex");
await writeJson("schema/schema.json", schema);
await writeFixtures(schema);

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
  const deployment = {
    season: "0x101",
    map: "0x102",
    structures: "0x103",
    troops: emitter,
    settlement: "0x105",
    resources: "0x106",
  };
  const model = schema.models.find((model) => model.name === "ExplorerTroops");
  function raw(name, values = []) {
    const layout = schema.domains.troops.events.find(
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
  const values = [7, ...zeroTroops, 0, 12, 34];
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
    raw: { ...set, from_address: deployment.map },
    expected: { error: "foreign-emitter" },
  });
  await writeJson("schema/fixtures/malformed-row.json", {
    ...fixture,
    raw: { ...set, data: set.data.slice(0, -1) },
    expected: { error: "malformed-row" },
  });
}
console.log(`Generated ${schema.models.length} models at ${fileURLToPath(new URL("schema/schema.json", root))}`);

function clientType(type) {
  if (type === "core::bool") return "Boolean";
  if (["core::integer::u64", "core::integer::u256"].includes(type)) return "BigInt";
  if (/^core::integer::u(8|16|32)$/.test(type)) return "Number";
  if (
    type === "core::integer::u128" ||
    type === "core::felt252" ||
    type.endsWith("::ContractAddress") ||
    type.endsWith("::ClassHash")
  )
    return "BigInt";
  const span = /^core::array::(?:Span|Array)::<(.+)>$/.exec(type);
  if (span) return [clientType(span[1])];
  const definition = types.get(type);
  if (definition?.type === "struct")
    return Object.fromEntries(definition.members.map((member) => [member.name, clientType(member.type)]));
  if (definition?.type === "enum" && definition.variants.every((variant) => variant.type === "()")) return "String";
  throw new Error(`Unsupported client binding ${type}`);
}
await writeJson("schema/bindings.json", {
  schemaIdentity: schema.identity,
  commandAbi: artifacts.season,
  events: schema.projections.map(({ name, scope }) => ({ name, scope })),
  models: [
    ...schema.models.map((model) => ({
      name: model.name,
      scope: model.scope,
      schema: Object.fromEntries(
        [...model.keys, ...model.members].map((member) => [member.name, clientType(member.type)]),
      ),
    })),
    {
      name: "LastBattle",
      scope: "game",
      schema: {
        game_id: "Number",
        entity_id: "Number",
        latest_attacker_id: "OptionalNumber",
        latest_attack_timestamp: "OptionalNumber",
        latest_defender_id: "OptionalNumber",
        latest_defense_timestamp: "OptionalNumber",
      },
    },
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
