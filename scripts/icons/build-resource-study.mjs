import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildResourceHistory } from "./resource-history.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const game = `${repo}/apps/game`;
const source = `${game}/asset-sources/rss-icons`;
const output = `${game}/public/lab/rss-icons`;
const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const study = await read(`${source}/catalog.json`);
const { icons } = await read(`${game}/asset-sources/facets/catalog.json`);
const checking = process.argv.includes("--check");
await buildResourceHistory(checking);
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
    const path = `apps/game/public/icons/facets/${size}/${meaning}.webp`;
    const bytes = execFileSync("git", ["show", `${study.before}:${path}`], { cwd: repo });
    await emit(`${output}/before/${size}/${meaning}.webp`, bytes);
  }
  if (icon.source.model)
    await emit(
      `${output}/models/${meaning}.png`,
      await readFile(`${game}/asset-sources/facets/masters/${meaning}.png`),
    );
}
await emit(`${output}/manifest.json`, Buffer.from(JSON.stringify(study, null, 2) + "\n"));
console.log(`${study.changes.length} production changes compared with pinned previous deliveries and model renders.`);
