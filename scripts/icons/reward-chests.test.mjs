import assert from "node:assert/strict";
import { readFile, mkdir, mkdtemp, cp, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { assertIconFill } from "./normalize.mjs";
import { buildRewardChests } from "./reward-chests.mjs";

const game = fileURLToPath(new URL("../../apps/game", import.meta.url));
const meanings = JSON.parse(await readFile(`${game}/asset-sources/facets/semantic-map.json`, "utf8"));
const { files } = JSON.parse(await readFile(`${game}/asset-sources/reward-chests.json`, "utf8"));

test("every approved reward chest original reproduces the undersized delivery regression", async () => {
  assert.equal(Object.keys(files).length, 10);
  for (const file of Object.keys(files)) {
    await assert.rejects(
      assertIconFill(`${game}/asset-sources/reward-chests/originals/${file}`, file),
      /Undersized icon .*83\.[1-6]% subject fill/,
    );
    const { fill } = await assertIconFill(`${game}/public/images/blitz-chests/${file}`, file);
    assert.ok(fill >= 0.85 && fill <= 0.92);
  }
});

test("the production reward check rejects original deliveries, rebuilds them, and rejects an unregistered delivery", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "reward-fill-"));
  try {
    await mkdir(`${fixture}/asset-sources`, { recursive: true });
    await copyFile(`${game}/asset-sources/reward-chests.json`, `${fixture}/asset-sources/reward-chests.json`);
    await cp(`${game}/asset-sources/reward-chests`, `${fixture}/asset-sources/reward-chests`, { recursive: true });
    await cp(`${game}/asset-sources/reward-chests/originals`, `${fixture}/public/images/blitz-chests`, {
      recursive: true,
    });
    await assert.rejects(buildRewardChests(fixture, meanings, { check: true }), /Undersized icon reward chest/);
    await buildRewardChests(fixture, meanings, { check: false });
    await assert.doesNotReject(buildRewardChests(fixture, meanings, { check: true }));
    await copyFile(
      `${fixture}/public/images/blitz-chests/band-0-opened.webp`,
      `${fixture}/public/images/blitz-chests/unregistered.webp`,
    );
    await assert.rejects(buildRewardChests(fixture, meanings, { check: true }), /only the registered deliveries/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
