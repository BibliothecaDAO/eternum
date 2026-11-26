import assert from "node:assert/strict";
import test from "node:test";
import { checkDiscoveryVectors, discoveryVectorSource } from "./check-discovery-vectors.mjs";

test("every live command has its typed vector and both full root sweeps", () => {
  checkDiscoveryVectors(discoveryVectorSource());
});

test("the omitted daily quest vector fails before compiling the discovery suites", () => {
  const vectors = discoveryVectorSource();
  const previous = vectors.replace(/^.*Command::ClaimDailyQuest.*\n/m, "");
  assert.notEqual(previous, vectors);
  assert.throws(() => checkDiscoveryVectors(previous, vectors), /Update typed_commands/);
});

test("adding a vector without its root cases is refused", () => {
  const cases = discoveryVectorSource();
  const previous = cases.replace(/^#\[test_case\(name: "route_00_roots_.*\n/gm, "");
  assert.notEqual(previous, cases);
  assert.throws(() => checkDiscoveryVectors(cases, previous), /both discovery refusal tests/);
});

test("both refusal functions need every root group even when other tests reuse case names", () => {
  const cases = discoveryVectorSource();
  const missing = cases.replace(/^#\[test_case\(name: "route_00_roots_00_07".*\n/m, "");
  assert.notEqual(missing, cases);
  assert.throws(() => checkDiscoveryVectors(cases, missing), /both discovery refusal tests/);
});

test("permanent wire IDs do not define the generated route position", () => {
  const vectors = discoveryVectorSource();
  const claim = vectors.match(/^.*Command::ClaimDailyQuest.*\n/m)?.[0];
  assert.ok(claim);
  const body = vectors.split("#[test_case")[0];
  const end = body.lastIndexOf("    ]");
  assert.ok(end > 0);
  const before = body.slice(0, end).replace(claim, "");
  const previous = before + claim + vectors.slice(end);
  assert.notEqual(previous, vectors);
  assert.throws(() => checkDiscoveryVectors(previous, vectors), /generated route order/);
});
