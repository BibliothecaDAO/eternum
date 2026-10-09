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
  assert.deepEqual(method("freeze_blitz_roster").inputs, [
    { name: "game_id", type: "core::integer::u32" },
    { name: "players", type: "core::array::Span::<world_native::registrar::RosterPlayer>" },
  ]);
  assert.deepEqual(abi.find(({ name }) => name === "world_native::registrar::RosterPlayer").members, [
    { name: "account", type: "core::starknet::contract_address::ContractAddress" },
    { name: "wallet", type: "core::starknet::contract_address::ContractAddress" },
  ]);
  assert.equal(
    abi.find(({ name }) => name === "world_native::entry::LaborRealm").members.find(({ name }) => name === "home").type,
    "core::integer::u64",
  );
  assert.equal(method("grant_labor").inputs.find(({ name }) => name === "day").type, "core::integer::u64");
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
