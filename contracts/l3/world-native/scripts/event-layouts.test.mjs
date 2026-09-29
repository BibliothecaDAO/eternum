import assert from "node:assert/strict";
import test from "node:test";
import { eventLayouts, uniqueEventLayouts } from "./event-layouts.mjs";

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
