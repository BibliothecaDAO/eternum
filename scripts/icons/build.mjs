import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { normalizeMaster } from "./normalize.mjs";
import { validateIconFiles } from "./files.mjs";
import { validateIcons } from "./validate.mjs";
const repo = fileURLToPath(new URL("../../", import.meta.url));
const source = `${repo}/apps/game/asset-sources/facets`;
const read = async (file) => JSON.parse(await readFile(`${source}/${file}.json`, "utf8"));
const [{ icons }, meanings, resources, verdicts] = await Promise.all([
  read("catalog"),
  read("semantic-map"),
  read("resources"),
  read("verdicts"),
]);
validateIcons({ icons, meanings, resources, verdicts });
const output = `${repo}/apps/game/public/icons/facets`;
await validateIconFiles(icons, source, process.argv.includes("--check") ? output : undefined);
if (!process.argv.includes("--check")) {
  for (const size of [64, 128, 256]) await mkdir(`${output}/${size}`, { recursive: true });
  const requested = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  for (const id of requested) if (!icons.some((icon) => icon.id === id)) throw new Error(`Unknown painting: ${id}`);
  for (const icon of icons.filter((icon) => !requested.length || requested.includes(icon.id))) {
    const master = await normalizeMaster(`${source}/masters/${icon.id}.png`);
    for (const size of [64, 128, 256])
      await sharp(master)
        .resize(size, size)
        .webp({ quality: 90, alphaQuality: 100, effort: 6 })
        .toFile(`${output}/${size}/${icon.id}.webp`);
  }
  await writeFile(`${output}/manifest.json`, JSON.stringify({ meanings, resources }, null, 2));
}
console.log(`${icons.length} paintings, ${Object.keys(meanings).length} meanings, all 58 resources validated.`);
