import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { normalizeMaster } from "./normalize.mjs";
import { buildResourceHistory } from "./resource-history.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const source = `${repo}/apps/game/asset-sources/rss-icons`;
const output = `${repo}/apps/game/public/lab/rss-icons`;
const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const { categories, retained, shippedFamilies } = await read(`${source}/catalog.json`);
const verdicts = await read(`${source}/verdicts.json`);
const resources = await read(`${repo}/apps/game/asset-sources/facets/resources.json`);
const checking = process.argv.includes("--check");
await buildResourceHistory(checking);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const ids = categories.flatMap((category) => category.samples.map((sample) => sample.art));
if (new Set(ids).size !== ids.length) throw new Error("Each template sample needs a unique artwork id.");
const required = Object.values(resources).map((resource) => resource.meaning);
const assigned = [
  ...categories.flatMap((category) => category.members.map((member) => member.meaning)),
  ...retained.map((entry) => entry.meaning),
];
if (
  assigned.length !== required.length ||
  new Set(assigned).size !== assigned.length ||
  required.some((meaning) => !assigned.includes(meaning))
)
  throw new Error("Assign each of the 58 resources to exactly one template or retained mark.");
for (const category of categories) {
  if (category.samples.length < 2 || category.samples.length > 3)
    throw new Error(`Template ${category.id}: show two or three sample reskins.`);
  for (const sample of category.samples)
    if (
      !sample.meanings.length ||
      sample.meanings.some((meaning) => !category.members.some((member) => member.meaning === meaning))
    )
      throw new Error(`Template ${category.id}: sample ${sample.art} must belong to its category.`);
}
for (const directory of ["masters", "prompts"]) {
  const files = await readdir(`${source}/${directory}`);
  for (const file of files)
    if (!ids.includes(file.replace(/\.(png|txt)$/, ""))) throw new Error(`Unwired review source: ${file}`);
}
const manifest = { categories, retained, shippedFamilies, artworks: {} };
for (const id of ids) {
  if (verdicts[id]?.status !== "proposal" || !verdicts[id]?.reason?.trim())
    throw new Error(`Review ${id}: explain its comparison before adding it to the lab.`);
  await access(`${source}/prompts/${id}.txt`);
  const file = `${source}/masters/${id}.png`;
  const master = await normalizeMaster(file);
  manifest.artworks[id] = { master: hash(await readFile(file)), deliveries: {} };
  for (const size of [64, 128, 256]) {
    const bytes = await sharp(master).resize(size, size).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toBuffer();
    const path = `${output}/${size}/${id}.webp`;
    manifest.artworks[id].deliveries[size] = hash(bytes);
    if (checking) {
      if (hash(await readFile(path)) !== hash(bytes)) throw new Error(`Stale review delivery: ${path}`);
    } else {
      await mkdir(`${output}/${size}`, { recursive: true });
      await writeFile(path, bytes);
    }
  }
}
for (const size of [64, 128, 256]) {
  for (const file of await readdir(`${output}/${size}`))
    if (!ids.includes(file.replace(/\.webp$/, ""))) throw new Error(`Unwired review delivery: ${file}`);
}
if (checking) {
  if (JSON.stringify(await read(`${output}/manifest.json`)) !== JSON.stringify(manifest))
    throw new Error("Resource review manifest does not match its sources.");
} else await writeFile(`${output}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
console.log(`${categories.length} category templates, ${ids.length} lab-wired samples, three verified sizes each.`);
