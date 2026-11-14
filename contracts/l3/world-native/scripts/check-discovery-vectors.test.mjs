import assert from "node:assert/strict";
import test from "node:test";
import { checkDiscoveryVectors, discoveryVectorSources } from "./check-discovery-vectors.mjs";

test("every live command has its typed vector and both full root sweeps", () => {
  checkDiscoveryVectors(...discoveryVectorSources());
});

test("the omitted daily quest vector fails before compiling the discovery suites", () => {
  const [vectors, cases] = discoveryVectorSources();
  const previous = vectors.replace(/^.*Command::ClaimDailyQuest.*\n/m, "");
  assert.notEqual(previous, vectors);
  assert.throws(() => checkDiscoveryVectors(previous, cases), /Update typed_commands/);
});

test("adding a vector without its root cases is refused", () => {
  const [vectors, cases] = discoveryVectorSources();
  const previous = cases.replace(/^#\[test_case\(name: "route_52_roots_.*\n/gm, "");
  assert.notEqual(previous, cases);
  assert.throws(() => checkDiscoveryVectors(vectors, previous), /both discovery refusal tests/);
});
