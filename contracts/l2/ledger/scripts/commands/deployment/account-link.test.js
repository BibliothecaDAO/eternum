import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CallData, ValidateType, uint256 } from "starknet";

const { abi } = JSON.parse(
  readFileSync(new URL("../../../target/dev/game_ledger_GameLedger.contract_class.json", import.meta.url), "utf8"),
);
const codec = new CallData(abi);
const entries = abi.flatMap((entry) => (entry.type === "interface" ? entry.items : [entry]));
const key = { shard: 17n, game_id: 7 };

for (const { name, fields, arguments: args, felts } of [
  { name: "register", fields: ["key", "sword", "shield"], arguments: [key, false, true], felts: ["17", "7", "0", "1"] },
  {
    name: "register_with_pass",
    fields: ["key", "pass_id"],
    arguments: [key, uint256.bnToUint256(42n)],
    felts: ["17", "7", "42", "0"],
  },
  {
    name: "register_village",
    fields: ["key", "village_pass_id"],
    arguments: [key, uint256.bnToUint256(43n)],
    felts: ["17", "7", "43", "0"],
  },
]) {
  test(`${name} encodes the connected wallet's registration without an account argument`, () => {
    assert.deepEqual(
      entries.find((entry) => entry.name === name).inputs.map(({ name }) => name),
      fields,
    );
    codec.validate(ValidateType.INVOKE, name, args);
    assert.deepEqual(codec.compile(name, args), felts);
    assert.throws(
      () => codec.validate(ValidateType.INVOKE, name, [key, "0xdead", ...args.slice(1)]),
      /Invalid number of arguments/,
    );
  });
}

test("link mutation and views use the same scalar addresses as the relay interface", () => {
  assert.deepEqual(codec.compile("set_account_link", { wallet: "0x123", account: "0x456" }), ["291", "1110"]);
  assert.deepEqual(codec.compile("set_account_link", { wallet: "0x123", account: "0x0" }), ["291", "0"]);
  for (const [name, input] of [
    ["account_of_wallet", "wallet"],
    ["wallet_of_account", "account"],
  ]) {
    const entry = entries.find((entry) => entry.name === name);
    assert.deepEqual(
      entry.inputs.map(({ name }) => name),
      [input],
    );
    assert.equal(entry.outputs.length, 1);
    assert.equal(entry.outputs[0].type, "core::starknet::contract_address::ContractAddress");
  }
});

test("the link event records both displaced sides with the published key/data layout", () => {
  const event = abi.find((entry) => entry.type === "event" && entry.name.endsWith("::AccountLinkChanged"));
  assert.deepEqual(
    event.members.map(({ name, kind }) => ({ name, kind })),
    [
      { name: "wallet", kind: "key" },
      { name: "account", kind: "key" },
      { name: "previous_account", kind: "data" },
      { name: "previous_wallet", kind: "data" },
    ],
  );
});
