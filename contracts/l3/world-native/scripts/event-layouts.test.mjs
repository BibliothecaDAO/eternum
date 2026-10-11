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
    abi.find(({ name }) => name === "world_native::entry::LaborRealm").members.find(({ name }) => name === "home").type,
    "core::integer::u64",
  );
  assert.deepEqual(method("publish_frontier_pool").inputs, [
    { name: "game_id", type: "core::integer::u32" },
    { name: "amount", type: "core::integer::u128" },
  ]);
  assert.deepEqual(method("publish_frontier_pool").outputs, []);
  assert.deepEqual(abi.find(({ name }) => name === "world_native::relics::ChestRules").members, [
    { name: "price", type: "core::integer::u128" },
    { name: "shares", type: "world_native::relics::ChestTiers" },
    { name: "claim_window_seconds", type: "core::integer::u32" },
  ]);
  assert.deepEqual(method("grant_labor").inputs, [
    { name: "realms", type: "core::array::Array::<world_native::entry::LaborRealm>" },
    { name: "day", type: "core::integer::u64" },
    { name: "account", type: "core::starknet::contract_address::ContractAddress" },
  ]);
  assert.deepEqual(method("grant_labor").outputs, [{ type: "core::array::Array::<world_native::entry::LaborGrant>" }]);
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
