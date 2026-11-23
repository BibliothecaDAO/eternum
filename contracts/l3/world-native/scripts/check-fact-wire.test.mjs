import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { checkFactWire, declaredByWorld } from "./check-fact-wire.mjs";

const current = { type: "struct", name: "Authentication", members: [{ name: "account_class", type: "ClassHash" }] };
const stale = { ...current, members: [{ name: "submitter", type: "ContractAddress" }] };

async function fixture(t, artifacts, indexed) {
  const directory = await mkdtemp(join(tmpdir(), "native-fact-wire-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [name, type] of Object.entries(artifacts))
    await writeFile(join(directory, name), JSON.stringify({ abi: [type] }));
  await writeFile(
    join(directory, "world_tests_capture_contracts.test.starknet_artifacts.json"),
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

test("checks every test package and rejects conflicts between packages", async (t) => {
  const directory = await fixture(t, { "first.json": current, "second.json": current }, ["first.json"]);
  await writeFile(
    new URL("second.test.starknet_artifacts.json", directory),
    JSON.stringify({
      contracts: [{ artifacts: { sierra: "second.json" } }],
    }),
  );
  assert.equal(await checkFactWire(directory, [current]), 1);
  await writeFile(new URL("second.json", directory), JSON.stringify({ abi: [stale] }));
  await assert.rejects(checkFactWire(directory, [current]), /Conflicting test ABI/);
});

test("compares a type the world declares, in its module file or an enclosing one, and leaves Herald's own rows", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "native-fact-sources-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "logic"));
  await writeFile(join(directory, "deep.cairo"), "pub struct DeepPay {\n}\npub mod inner {\n    pub enum Ring {}\n}\n");
  await writeFile(join(directory, "logic", "mines.cairo"), "pub struct MinePick {\n}\n");
  const sources = pathToFileURL(`${directory}/`);
  assert.equal(await declaredByWorld(sources, "world_native::deep::DeepPay"), true);
  assert.equal(await declaredByWorld(sources, "world_native::deep::inner::Ring"), true);
  assert.equal(await declaredByWorld(sources, "world_native::logic::mines::MinePick"), true);
  assert.equal(await declaredByWorld(sources, "world_native::deep::DeepPayout"), false);
  assert.equal(await declaredByWorld(sources, "world_native::deep::DeepRules"), false);
  assert.equal(await declaredByWorld(sources, "world_native::banes::BaneRules"), false);
  assert.equal(await declaredByWorld(sources, "core::integer::u8"), true);
});
