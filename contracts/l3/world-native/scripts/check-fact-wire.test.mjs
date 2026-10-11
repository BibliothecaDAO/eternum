import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { checkFactWire } from "./check-fact-wire.mjs";

const current = { type: "struct", name: "Authentication", members: [{ name: "account_class", type: "ClassHash" }] };
const stale = { ...current, members: [{ name: "submitter", type: "ContractAddress" }] };

async function fixture(t, artifacts, indexed) {
  const directory = await mkdtemp(join(tmpdir(), "native-fact-wire-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [name, type] of Object.entries(artifacts))
    await writeFile(join(directory, name), JSON.stringify({ abi: [type] }));
  await writeFile(
    join(directory, "world_native_unittest.test.starknet_artifacts.json"),
    JSON.stringify({
      contracts: indexed.map((sierra) => ({ artifacts: { sierra } })),
    }),
  );
  return pathToFileURL(`${directory}/`);
}

test("ignores an old unindexed class without hiding conflicts in current classes", async (t) => {
  const artifacts = { "current.test.contract_class.json": current, "old.test.contract_class.json": stale };
  assert.equal(await checkFactWire(await fixture(t, artifacts, ["current.test.contract_class.json"]), [current]), 1);
  await assert.rejects(
    checkFactWire(await fixture(t, artifacts, Object.keys(artifacts)), [current]),
    /Conflicting test ABI/,
  );
});

test("an unindexed old class cannot supply missing coverage or hide wire drift", async (t) => {
  const artifacts = { "old.test.contract_class.json": current, "current.test.contract_class.json": stale };
  await assert.rejects(checkFactWire(await fixture(t, artifacts, []), [current]), /Missing test ABI coverage/);
  await assert.rejects(
    checkFactWire(await fixture(t, artifacts, ["current.test.contract_class.json"]), [current]),
    /Fact wire drift/,
  );
});
