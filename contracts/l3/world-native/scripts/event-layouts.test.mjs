import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { eventLayouts, uniqueEventLayouts } from "./event-layouts.mjs";

test("Games exposes the published player frame, roles and frozen roster ABI", async () => {
  const { abi } = JSON.parse(
    await readFile(new URL("../target/dev/world_native_Games.contract_class.json", import.meta.url), "utf8"),
  );
  const methods = abi.flatMap((entry) => (entry.type === "interface" ? entry.items : [entry]));
  const method = (name) => {
    const matches = methods.filter((entry) => entry.name === name);
    assert.equal(matches.length, 1, `Expected one Games ${name}`);
    return matches[0];
  };
  assert.deepEqual(method("play").inputs, [
    { name: "game_id", type: "core::integer::u32" },
    { name: "release_id", type: "core::integer::u32" },
    { name: "preset_commitment", type: "core::felt252" },
    { name: "command", type: "core::array::Span::<core::felt252>" },
  ]);
  assert.deepEqual(method("play").outputs, []);
  assert.deepEqual(
    method("constructor").inputs.map(({ name }) => name),
    ["owner", "launcher", "authentication", "release_id", "release", "vrf_public_key", "l2_gas_bound"],
  );
  for (const name of [
    "owner",
    "launcher",
    "ledger_operator",
    "set_launcher",
    "set_ledger_operator",
    "create_game",
    "register_preset",
  ])
    method(name);
  assert.deepEqual(method("create_game").inputs, [
    { name: "params", type: "world_native::registrar::CreateGameParams" },
  ]);
  assert.deepEqual(abi.find(({ name }) => name === "world_native::registrar::RosterPlayer").members, [
    { name: "account", type: "core::starknet::contract_address::ContractAddress" },
    { name: "wallet", type: "core::starknet::contract_address::ContractAddress" },
  ]);
  assert.equal(
    abi.find(({ name }) => name === "world_native::entry::LaborHome").members.find(({ name }) => name === "home").type,
    "core::integer::u64",
  );
  assert.deepEqual(method("publish_frontier_pool").inputs, [
    { name: "game_id", type: "core::integer::u32" },
    { name: "amount", type: "core::integer::u128" },
    { name: "prize_pool", type: "core::integer::u128" },
  ]);
  assert.deepEqual(method("publish_frontier_pool").outputs, []);
  assert.deepEqual(abi.find(({ name }) => name === "world_native::relics::ChestRules").members, [
    { name: "price_ceiling", type: "core::integer::u128" },
    { name: "shares", type: "world_native::relics::ChestTiers" },
    { name: "claim_window_seconds", type: "core::integer::u32" },
    { name: "pool_bps", type: "core::integer::u16" },
    { name: "top_n", type: "core::integer::u16" },
  ]);
  const relics = JSON.parse(
    await readFile(new URL("../target/dev/world_native_RelicsLogic.contract_class.json", import.meta.url), "utf8"),
  ).abi;
  assert.deepEqual(relics.find(({ name }) => name === "world_native::relics::LordsBudget").members, [
    { name: "pool", type: "core::integer::u128" },
    { name: "pool_left", type: "core::integer::u128" },
    { name: "open", type: "core::integer::u128" },
    { name: "day", type: "core::integer::u64" },
    { name: "price", type: "core::integer::u128" },
    { name: "rolled_shares", type: "core::integer::u128" },
    { name: "yesterday_shares", type: "core::integer::u128" },
    { name: "yesterday_ticks", type: "core::integer::u64" },
  ]);
  assert.equal(
    methods.some(({ name }) => name === "lords_budget"),
    false,
  );
  assert.deepEqual(method("grant_labor").inputs, [
    { name: "home", type: "world_native::entry::LaborHome" },
    { name: "day", type: "core::integer::u64" },
    { name: "account", type: "core::starknet::contract_address::ContractAddress" },
  ]);
  assert.deepEqual(method("grant_labor").outputs, [{ type: "world_native::entry::LaborGrant" }]);
  assert.equal(
    methods.some(({ name }) =>
      /recorded_execution|execution_head|actor_nonce|open_epoch|reveal_epoch/.test(name ?? ""),
    ),
    false,
  );
});

function abi(contract, type) {
  return [
    {
      type: "event",
      name: `${contract}::Event`,
      kind: "enum",
      variants: [{ name: "RowSet", type: `${contract}::RowSet`, kind: "nested" }],
    },
    { type: "event", name: `${contract}::RowSet`, kind: "struct", members: [{ name: "value", type, kind: "data" }] },
  ];
}

test("home rewards have one production implementation and no former-class entrypoints", async () => {
  const entrypoints = async (contract) => {
    const { abi } = JSON.parse(
      await readFile(new URL(`../target/dev/world_native_${contract}.contract_class.json`, import.meta.url), "utf8"),
    );
    return abi.flatMap((entry) => (entry.type === "interface" ? entry.items : [entry])).map(({ name }) => name);
  };
  const { contracts } = JSON.parse(
    await readFile(new URL("../target/dev/world_native.starknet_artifacts.json", import.meta.url), "utf8"),
  );
  const libraries = await Promise.all(
    contracts
      .filter(({ contract_name }) => contract_name.endsWith("Logic"))
      .map(async ({ contract_name }) => [contract_name, await entrypoints(contract_name)]),
  );
  const games = await entrypoints("Games");
  for (const name of ["grant_labor", "labor_grant", "claim_daily_quest", "record_quest_progress"]) {
    const implementations = libraries.flatMap(([contract, entries]) =>
      entries.filter((entry) => entry === name).map(() => contract),
    );
    assert.deepEqual(implementations, ["BridgeLogic"], `${name} must have exactly one production implementation`);
  }
  for (const name of ["grant_labor", "labor_grant"]) {
    assert.equal(games.filter((entry) => entry === name).length, 1);
  }
});

test("terrain derivation has one implementation in MovementLogic", async () => {
  const { contracts } = JSON.parse(
    await readFile(new URL("../target/dev/world_native.starknet_artifacts.json", import.meta.url), "utf8"),
  );
  const implementations = [];
  for (const { contract_name } of contracts) {
    if (!contract_name.endsWith("Logic")) continue;
    const { abi } = JSON.parse(
      await readFile(
        new URL(`../target/dev/world_native_${contract_name}.contract_class.json`, import.meta.url),
        "utf8",
      ),
    );
    for (const entry of abi) {
      if (entry.type === "interface" && entry.name === "world_native::settlement::ITerrainDerivation") {
        implementations.push(contract_name);
        assert.deepEqual(
          entry.items.map(({ name }) => name),
          ["raise_expedition_home", "biome", "expedition_home_ring"],
        );
      }
    }
  }
  assert.deepEqual(implementations, ["MovementLogic"], "Route terrain through the single MovementLogic implementation");
});

test("libraries sharing a Games selector must agree on every wire member", () => {
  const first = eventLayouts(abi("MapLogic", "core::felt252"));
  const same = eventLayouts(abi("TroopsLogic", "core::felt252"));
  assert.deepEqual(uniqueEventLayouts([...first, ...same]), first);
  const different = eventLayouts(abi("TroopsLogic", "core::integer::u256"));
  assert.throws(() => uniqueEventLayouts([...first, ...different]), /Conflicting event layout/);
  assert.throws(
    () => eventLayouts([...abi("MapLogic", "core::felt252"), ...abi("MapLogic", "core::integer::u256")]),
    /Conflicting event definition/,
  );
});
