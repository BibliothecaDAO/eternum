import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function pinned(path, pattern) {
  const value = readFileSync(new URL(path, import.meta.url), "utf8").match(pattern)?.[1];
  assert.ok(value, `${path} no longer pins the Blitz result commitment vector`);
  return BigInt(value);
}

test("the world's Blitz result commitment pins the ledger's own vector", () => {
  assert.equal(
    pinned("../tests/blitz/play/src/tests/results.cairo", /LEDGER_RESULT_COMMITMENT: felt252 = (0x[0-9a-f]+);/),
    pinned("../../../l2/ledger/src/tests.cairo", /assert!\(expected == (0x[0-9a-f]+)\);/),
  );
});
