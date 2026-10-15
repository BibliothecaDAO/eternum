import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { normalizeMaster } from "./paint-normalize.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const source = `${repo}/apps/game/asset-sources/icon-study-painted`;
const output = resolve(process.argv[2] ?? `${repo}/apps/game/public/lab-icons`);
const { icons, directions } = JSON.parse(await readFile(`${source}/catalog.json`, "utf8"));
const verdicts = JSON.parse(await readFile(`${source}/verdicts.json`, "utf8"));
const troopIds = ["knight", "crossbowman", "paladin"].flatMap((kind) => [1, 2, 3].map((tier) => `${kind}-t${tier}`));
const actualTroops = icons.filter((icon) => icon.family === "Troops").map((icon) => icon.id);
if (actualTroops.length !== 9 || troopIds.some((id) => !actualTroops.includes(id)))
  throw new Error(
    "Troops require a soldier portrait for every type and tier: knight, crossbowman, paladin × T1/T2/T3.",
  );
await mkdir(output, { recursive: true });
const assets = await buildDirections();
await writeFile(`${output}/catalog.json`, JSON.stringify({ icons, directions, verdicts, assets }, null, 2));
console.log(JSON.stringify({ output, icons: icons.length, directions: directions.length, exports: assets.length }));

async function buildDirections() {
  const assets = [];
  for (const direction of directions) {
    const atlas = [];
    const coordinates = {};
    for (const [index, icon] of icons.entries()) {
      const key = `${direction.id}/${icon.id}`;
      const verdict = verdicts[key];
      if (!verdict || !["equal", "beats shipped"].includes(verdict.verdict))
        throw new Error(`Review before publishing: ${key}`);
      if (!verdict.reason?.trim()) throw new Error(`Record the visual comparison: ${key}`);
      const input = `${source}/masters/${key}.png`;
      const master = await normalizeMaster(input);
      for (const size of [12, 16, 24, 32, 64, 256]) {
        const directory = `${output}/new/${direction.id}/${size}`;
        await mkdir(directory, { recursive: true });
        const file = `${directory}/${icon.id}.png`;
        await sharp(master).resize(size, size).png().toFile(file);
        assets.push({ key, size, file: `new/${direction.id}/${size}/${icon.id}.png` });
      }
      const left = (index % 8) * 256;
      const top = Math.floor(index / 8) * 256;
      atlas.push({ input: `${output}/new/${direction.id}/256/${icon.id}.png`, left, top });
      coordinates[icon.id] = { x: left, y: top, width: 256, height: 256 };
    }
    await sharp({
      create: { width: 2048, height: Math.ceil(icons.length / 8) * 256, channels: 4, background: "#00000000" },
    })
      .composite(atlas)
      .png()
      .toFile(`${output}/${direction.id}-atlas.png`);
    await writeFile(`${output}/${direction.id}-atlas.json`, JSON.stringify(coordinates, null, 2));
  }
  return assets;
}
