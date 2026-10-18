import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import sharp from "sharp";
import { validateIconFiles } from "./files.mjs";
import { normalizeMaster, deliverIcon } from "./normalize.mjs";
import { readHistoricalArtwork } from "./resource-history.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
test("all 18 restored relic masters are the original mapped resource bytes", async () => {
  const repo = fileURLToPath(new URL("../../", import.meta.url));
  const source = `${repo}/apps/game/asset-sources`;
  const { icons } = JSON.parse(await readFile(`${source}/facets/catalog.json`, "utf8"));
  const history = JSON.parse(await readFile(`${source}/rss-icons/history.json`, "utf8"));
  const relics = icons.filter(({ id }) => id.includes("-relic-"));
  assert.equal(relics.length, 18);
  for (const icon of relics) {
    const entry = history.entries[icon.id];
    assert.equal(icon.source.revision, history.revision);
    assert.equal(icon.source.path, entry.source);
    const bytes = await readHistoricalArtwork(entry);
    assert.deepEqual(await readFile(`${source}/facets/masters/${icon.id}.png`), bytes);
  }
});

test("all 22 live production resource masters match the pinned committed archive", async () => {
  const repo = fileURLToPath(new URL("../../", import.meta.url));
  const source = `${repo}/apps/game/asset-sources`;
  const { icons } = JSON.parse(await readFile(`${source}/facets/catalog.json`, "utf8"));
  const history = JSON.parse(await readFile(`${source}/rss-icons/history.json`, "utf8"));
  const selected = Object.entries(history.entries).filter(([, entry]) => entry.id <= 22);
  assert.equal(selected.length, 22);
  for (const [id, entry] of selected) {
    const icon = icons.find((icon) => icon.id === id);
    assert.equal(icon.source.revision, "638fd7fb410");
    assert.equal(icon.source.committedPath, `apps/game/public${entry.url}`);
    assert.deepEqual(await readFile(`${source}/facets/masters/${id}.png`), await readHistoricalArtwork(entry));
  }
});

test("production validation rejects a changed model, master or stale delivery", async () => {
  const root = await mkdtemp(join(tmpdir(), "icon-source-"));
  const source = `${root}/apps/game/asset-sources/facets`;
  const output = `${root}/out`;
  try {
    await mkdir(`${source}/masters`, { recursive: true });
    const model = Buffer.from("model source");
    await writeFile(`${root}/model.glb`, model);
    const master = await sharp({ create: { width: 20, height: 20, channels: 4, background: "#00000000" } })
      .composite([
        {
          input: Buffer.from('<svg width="20" height="20"><rect x="3" y="3" width="14" height="14" fill="red"/></svg>'),
        },
      ])
      .png()
      .toBuffer();
    const file = `${source}/masters/farm.png`;
    await writeFile(file, master);
    const icons = [{ id: "farm", source: { sha256: hash(master), inputs: { "model.glb": hash(model) } } }];
    const normalized = await normalizeMaster(file);
    for (const size of [64, 128, 256]) {
      await mkdir(`${output}/${size}`, { recursive: true });
      await writeFile(`${output}/${size}/farm.webp`, await deliverIcon(normalized, size, "farm"));
    }
    await validateIconFiles(icons, source, output);
    await writeFile(`${root}/model.glb`, "replacement model");
    await assert.rejects(validateIconFiles(icons, source, output), /Model changed; rerender farm/);
    await writeFile(`${root}/model.glb`, model);
    await writeFile(file, "replacement master");
    await assert.rejects(validateIconFiles(icons, source, output), /Source master changed: farm/);
    await writeFile(file, master);
    await writeFile(`${output}/64/farm.webp`, "stale icon");
    await assert.rejects(validateIconFiles(icons, source, output), /Stale production delivery/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("historical source validation rejects changed committed bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "icon-history-"));
  try {
    await mkdir(`${root}/public`, { recursive: true });
    const entry = { url: "/relic.png", sha256: hash(Buffer.from("pinned original")) };
    await writeFile(`${root}/public/relic.png`, "pinned original");
    assert.deepEqual(await readHistoricalArtwork(entry, root), Buffer.from("pinned original"));
    await writeFile(`${root}/public/relic.png`, "wrong artwork");
    await assert.rejects(readHistoricalArtwork(entry, root), /Historical artwork hash differs/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
