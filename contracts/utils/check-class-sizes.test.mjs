import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

async function runCheck(t, packageName, required, classes) {
  const directory = await mkdtemp(join(tmpdir(), "service-class-sizes-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(
    join(directory, `${packageName}.starknet_artifacts.json`),
    JSON.stringify({
      contracts: classes.map(([name]) => ({ contract_name: name, artifacts: { casm: `${name}.json` } })),
    }),
  );
  for (const [name, size] of classes)
    if (size !== null)
      await writeFile(join(directory, `${name}.json`), JSON.stringify({ bytecode: Array(size).fill("0x0") }));
  return spawnSync(
    process.execPath,
    [new URL("check-class-sizes.mjs", import.meta.url).pathname, directory, packageName, required],
    { encoding: "utf8" },
  );
}

test("rejects the oversized GameLedger that blocked declaration", async (t) => {
  const result = await runCheck(t, "game_ledger", "GameLedger", [["GameLedger", 82_111]]);
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout).classes, [
    { name: "GameLedger", felts: 82_111, percent: (100 * 82_111) / 81_920, passed: false },
  ]);
});

test("enforces the same headroom boundary for ledger and verifier", async (t) => {
  for (const [pkg, name] of [
    ["game_ledger", "GameLedger"],
    ["realms_vrf_verifier", "Verifier"],
  ]) {
    for (const [size, status] of [
      [75_366, 0],
      [75_367, 1],
      [81_920, 1],
    ]) {
      const result = await runCheck(t, pkg, name, [[name, size]]);
      assert.equal(result.status, status);
      const report = JSON.parse(result.stdout);
      assert.equal(report.classes[0].felts, size);
      assert.equal(report.passed, status === 0);
    }
  }
});

test("checks additional compiled classes and refuses missing bytecode", async (t) => {
  for (const size of [82_111, null, 0]) {
    const result = await runCheck(t, "game_ledger", "GameLedger", [
      ["GameLedger", 100],
      ["RealmsCollectible", size],
    ]);
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).classes.find(({ name }) => name === "RealmsCollectible").passed, false);
  }
});

test("refuses a missing required class and duplicate artifact names", async (t) => {
  const missing = await runCheck(t, "realms_vrf_verifier", "Verifier", [["Other", 1]]);
  assert.equal(missing.status, 1);
  assert.match(
    JSON.parse(missing.stdout).classes.find(({ name }) => name === "Verifier").error,
    /Missing compiled class/,
  );
  const duplicate = await runCheck(t, "game_ledger", "GameLedger", [
    ["GameLedger", 1],
    ["GameLedger", 1],
  ]);
  assert.equal(duplicate.status, 1);
  assert.match(duplicate.stderr, /Duplicate class GameLedger/);
});
