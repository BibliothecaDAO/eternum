import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { normalizeMaster, deliverIcon } from "./normalize.mjs";
import { buildResourceHistory } from "./resource-history.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const game = `${repo}/apps/game`;
const source = `${game}/asset-sources/rss-icons`;
const output = `${game}/public/lab/rss-icons`;
const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const study = await read(`${source}/catalog.json`);
const { icons } = await read(`${game}/asset-sources/facets/catalog.json`);
const checking = process.argv.includes("--check");
await buildResourceHistory();
const emit = async (path, bytes) => {
  if (checking) {
    if (!(await readFile(path)).equals(bytes)) throw new Error(`Stale comparison: ${path}`);
  } else {
    await mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
    await writeFile(path, bytes);
  }
};
for (const { meaning } of study.changes) {
  const icon = icons.find(({ id }) => id === meaning);
  if (!icon?.source) throw new Error(`Missing production source for ${meaning}`);
  for (const size of [64, 128]) {
    const path = `${output}/before/${size}/${meaning}.webp`;
    const bytes = await readFile(path);
    if (createHash("sha256").update(bytes).digest("hex") !== study.beforeHashes[meaning][size])
      throw new Error(`Pinned before artwork changed: ${path}`);
  }
  if (icon.source.model)
    await emit(
      `${output}/models/${meaning}.png`,
      await normalizeMaster(`${game}/asset-sources/facets/masters/${meaning}.png`),
    );
}
const relics = await read(`${source}/relics/catalog.json`);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const expected = icons
  .filter(({ id }) => id.includes("-relic-"))
  .map(({ id }) => id)
  .sort();
const actual = relics.icons.map(({ meaning }) => meaning).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Review every relic exactly once.");
for (const reference of relics.styleReferences) {
  const bytes = await readFile(`${game}/asset-sources/facets/masters/${reference.meaning}.png`);
  if (hash(bytes) !== reference.sha256) throw new Error(`Style reference changed: ${reference.meaning}`);
}
for (const directory of ["masters", "prompts"]) {
  const names = (await readdir(`${source}/relics/${directory}`)).map((name) => name.replace(/\.(png|txt)$/, "")).sort();
  if (JSON.stringify(names) !== JSON.stringify(expected)) throw new Error(`Missing or unwired relic ${directory}`);
}
const deliveries = {};
for (const entry of relics.icons) {
  const { meaning } = entry;
  if (entry.verdict !== "proposal" || !entry.reason.trim()) throw new Error(`Review ${meaning} before showing it.`);
  const original = await readFile(`${game}/asset-sources/facets/masters/${meaning}.png`);
  if (hash(original) !== entry.sourceSha256) throw new Error(`Old relic reference changed: ${meaning}`);
  const path = `${source}/relics/masters/${meaning}.png`;
  if (hash(await readFile(path)) !== entry.masterSha256) throw new Error(`Relic review master changed: ${meaning}`);
  const master = await normalizeMaster(path);
  deliveries[meaning] = {};
  for (const size of [64, 128, 256]) {
    const bytes = await deliverIcon(master, size, meaning);
    deliveries[meaning][size] = hash(bytes);
    await emit(`${output}/relics/${size}/${meaning}.webp`, bytes);
  }
}
for (const size of [64, 128, 256]) {
  const names = (await readdir(`${output}/relics/${size}`)).map((name) => name.replace(/\.webp$/, "")).sort();
  if (JSON.stringify(names) !== JSON.stringify(expected)) throw new Error(`Missing or unwired relic delivery: ${size}`);
}
await emit(`${output}/manifest.json`, Buffer.from(JSON.stringify({ ...study, relics, deliveries }, null, 2) + "\n"));
console.log(`${relics.icons.length} Facets relic proposals, three verified deliveries each; production unchanged.`);
console.log(`${study.changes.length} production changes compared with pinned previous deliveries and model renders.`);
