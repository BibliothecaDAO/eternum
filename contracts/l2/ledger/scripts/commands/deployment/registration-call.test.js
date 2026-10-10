import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CallData, ValidateType, uint256 } from "starknet";

const { abi } = JSON.parse(
  readFileSync(new URL("../../../target/dev/game_ledger_GameLedger.contract_class.json", import.meta.url), "utf8"),
);
const codec = new CallData(abi);
const entries = abi.flatMap((entry) => (entry.type === "interface" ? entry.items : [entry]));
const key = { shard: 17n, slot_id: 7 };

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
