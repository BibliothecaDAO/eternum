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
const { proposals } = await read(`${source}/catalog.json`);
const verdicts = await read(`${source}/verdicts.json`);
const meanings = await read(`${repo}/apps/game/asset-sources/facets/semantic-map.json`);
const checking = process.argv.includes("--check");
await buildResourceHistory(checking);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const ids = proposals.flatMap((proposal) => proposal.options.map((option) => option.id));
if (new Set(ids).size !== ids.length) throw new Error("Each review option needs a unique id.");
for (const proposal of proposals) {
  if (!meanings[proposal.meaning] || proposal.options.length < 2 || proposal.options.length > 3)
    throw new Error(`Review ${proposal.meaning}: require a shipped meaning and two or three options.`);
}
for (const directory of ["masters", "prompts"]) {
  const files = await readdir(`${source}/${directory}`);
  for (const file of files)
    if (!ids.includes(file.replace(/\.(png|txt)$/, ""))) throw new Error(`Unwired review source: ${file}`);
}
const manifest = {};
for (const id of ids) {
  if (verdicts[id]?.status !== "proposal" || !verdicts[id]?.reason?.trim())
    throw new Error(`Review ${id}: explain its comparison before adding it to the lab.`);
  await access(`${source}/prompts/${id}.txt`);
  const file = `${source}/masters/${id}.png`;
  const master = await normalizeMaster(file);
  manifest[id] = { master: hash(await readFile(file)), deliveries: {} };
  for (const size of [64, 128, 256]) {
    const bytes = await sharp(master).resize(size, size).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toBuffer();
    const path = `${output}/${size}/${id}.webp`;
    manifest[id].deliveries[size] = hash(bytes);
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
console.log(`${proposals.length} reviewed resources, ${ids.length} lab-wired options, three verified sizes each.`);
