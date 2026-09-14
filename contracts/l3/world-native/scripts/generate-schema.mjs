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
const contracts = { season: "SeasonDomain", map: "MapDomain", troops: "TroopsDomain" };
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
  if (type === "core::integer::u256") return 2;
  const item = types.get(type);
  if (item?.type === "struct") return item.members.reduce((length, member) => length + feltLength(member.type), 0);
  if (item?.type === "enum") {
    const lengths = item.variants.map((variant) => feltLength(variant.type));
    if (new Set(lengths).size !== 1) throw new Error(`Variable row enum ${type}`);
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
    valueLength: members.reduce((length, member) => length + feltLength(member.type), 0),
  };
}

const domainKey = [{ name: "address", type: struct("lifecycle::Peers")[0].type }];
const models = [
  model("TileOpt", ["map"], "game", struct("map::TileKey"), struct("map::TileOpt")),
  model("ExplorerTroops", ["troops"], "game", struct("troops::ExplorerKey"), struct("troops::ExplorerTroops")),
  model("GameRegistry", ["season"], "game", method("season", "game").inputs, struct("game::GameRegistry")),
  model("SliceRules", ["season"], "game", method("season", "rules").inputs, struct("rules::SliceRules")),
  model("EntitySequence", ["season"], "game", method("season", "allocate_entity").inputs, [
    { name: "next_entity_id", type: method("season", "allocate_entity").outputs[0].type },
  ]),
  model(
    "PlayerRegisteredPoints",
    ["season"],
    "game",
    method("season", "player_points").inputs.map((key) => ({
      ...key,
      name: key.name === "actor" ? "address" : key.name,
    })),
    [{ name: "registered_points", type: method("season", "player_points").outputs[0].type }],
  ),
  model("SeasonPrize", ["season"], "game", method("season", "season_points").inputs, [
    { name: "total_registered_points", type: method("season", "season_points").outputs[0].type },
    { name: "total_lords_pool", type: "core::integer::u256" },
  ]),
  model("DomainState", Object.keys(contracts), "deployment", domainKey, struct("lifecycle::DomainState"), "address"),
  model("DomainClass", Object.keys(contracts), "deployment", domainKey, method("season", "upgrade").inputs, "address"),
  model("Authentication", ["season"], "deployment", domainKey, struct("season::Authentication"), "address"),
  model("ExecutionHead", ["season"], "deployment", domainKey, struct("recording::ExecutionHead"), "address"),
  model(
    "ExecutionResult",
    ["season"],
    "deployment",
    [...domainKey, ...method("season", "get_result").inputs],
    types.get(method("season", "get_result").outputs[0].type).members,
    "address",
  ),
  model("ActionNonce", ["season"], "game", method("season", "next_nonce").inputs, [
    { name: "next_nonce", type: method("season", "next_nonce").outputs[0].type },
  ]),
];

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
    if (!["RowSet", "RowMemberSet", "RowDeleted"].includes(name)) throw new Error(`Unexpected event ${name}`);
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
        events: eventLayouts(artifacts[domain]),
        entrypoints: artifacts[domain].filter((item) => item.type === "interface").flatMap((item) => item.items),
      },
    ]),
  ),
  models,
  types: Object.fromEntries([...types].sort(([left], [right]) => left.localeCompare(right))),
};
schema.identity = createHash("sha256").update(JSON.stringify(schema)).digest("hex");
await writeJson("schema/schema.json", schema);
await writeFixtures(schema);
const preset = JSON.parse(await readFile(new URL("fixtures/preset-1.json", root)));
const encodedRules = new CallData(artifacts.season).compile("rules_commitment", { rules: preset.rules });
const rulesPath = new URL("tests/fixtures/preset-1.txt", root);
const rulesText = encodedRules.map(String).join(" ") + "\n";
if (process.argv.includes("--check")) {
  if ((await readFile(rulesPath, "utf8")) !== rulesText) throw new Error("Generated preset rules differ");
} else {
  await mkdir(new URL("./", rulesPath), { recursive: true });
  await writeFile(rulesPath, rulesText);
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
  const deployment = { season: "0x101", map: "0x102", troops: emitter };
  const model = schema.models.find((model) => model.name === "ExplorerTroops");
  function raw(name, values = []) {
    const layout = schema.domains.troops.events.find((event) => event.name === name);
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
