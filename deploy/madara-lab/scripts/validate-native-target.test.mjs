import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const directory = mkdtempSync(join(tmpdir(), "native-target-"));
after(() => rmSync(directory, { recursive: true, force: true }));
const manifest = {
  world: { address: "0x1" }, native: { version: 1, activeSchema: "test", schemas: { test: { identity: "test", domains: { season: {}, registry: {} } } }, domains: { season: { address: "0x1" }, registry: { address: "0x2" } } },
};
function run(value, overrides = {}) {
  const path = join(directory, "manifest.json");
  writeFileSync(path, JSON.stringify(value));
  return spawnSync(process.execPath, [new URL("./validate-native-target.mjs", import.meta.url).pathname], {
    env: { NATIVE_WORLD_MANIFEST: path, ADMISSION_URL: "http://127.0.0.1:15081", ...overrides }, encoding: "utf8",
  });
}
test("native release validates without accessing the target", () => {
  const result = run(manifest);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).worldAddress, "0x1");
});
for (const name of ["NATIVE_WORLD_MANIFEST", "ADMISSION_URL"]) test(`missing ${name} fails closed`, () => {
  const result = run(manifest, { [name]: "" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, new RegExp(`${name} is required`));
});
test("a legacy manifest cannot pass a configured admission endpoint", () => {
  assert.equal(run({ world: { address: "0x1" }, models: [], contracts: [] }).status, 1);
});
test("incomplete releases and mismatched world identities fail closed", () => {
  for (const mutate of [value => delete value.native.domains.registry, value => value.world.address = "0x3", value => value.native.schemas.test.identity = "other"] ) {
    const value = structuredClone(manifest); mutate(value); assert.equal(run(value).status, 1);
  }
});
