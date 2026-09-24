import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { classSizeReport } from "./check-class-sizes.mjs";

async function fixture(t, classes) {
  const directory = await mkdtemp(join(tmpdir(), "native-class-sizes-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(
    join(directory, "world_native.starknet_artifacts.json"),
    JSON.stringify({
      contracts: classes.map(([name]) => ({ contract_name: name, artifacts: { casm: `${name}.json` } })),
    }),
  );
  for (const [name, size] of classes) {
    if (size !== null)
      await writeFile(join(directory, `${name}.json`), JSON.stringify({ bytecode: Array(size).fill("0x0") }));
  }
  return directory;
}

const schema = { domains: { season: { contract: "Games" } } };

test("accepts the headroom boundary and reports every compiled class", async (t) => {
  const directory = await fixture(t, [
    ["Games", 75_366],
    ["SequencingAccount", 10],
    ["ExtraLogic", 20],
  ]);
  const report = await classSizeReport(directory, schema);
  assert.equal(report.passed, true);
  assert.equal(report.classes.length, 3);
  assert.equal(report.classes.find(({ name }) => name === "Games").felts, 75_366);
});

test("rejects a class one felt above the headroom boundary", async (t) => {
  const directory = await fixture(t, [
    ["Games", 75_367],
    ["SequencingAccount", 10],
  ]);
  assert.equal((await classSizeReport(directory, schema)).passed, false);
});

test("rejects a required class missing from the artifact index", async (t) => {
  const directory = await fixture(t, [["SequencingAccount", 10]]);
  const report = await classSizeReport(directory, schema);
  assert.equal(report.passed, false);
  assert.match(report.classes.find(({ name }) => name === "Games").error, /Missing compiled class/);
});

test("rejects an indexed class with no artifact file or empty bytecode", async (t) => {
  for (const size of [null, 0]) {
    const directory = await fixture(t, [
      ["Games", size],
      ["SequencingAccount", 10],
    ]);
    assert.equal((await classSizeReport(directory, schema)).passed, false);
  }
});
