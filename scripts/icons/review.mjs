import { readFile, mkdir, access } from "node:fs/promises";
import sharp from "sharp";
import { normalizeMaster } from "./normalize.mjs";
const source = "apps/game/asset-sources/facets";
let { icons } = JSON.parse(await readFile(`${source}/catalog.json`, "utf8"));
const requested = process.argv.slice(4).filter((arg) => !arg.startsWith("--"));
if (requested.length) icons = icons.filter((icon) => requested.includes(icon.id));
if (process.argv.includes("--unreviewed")) {
  const verdicts = JSON.parse(await readFile(`${source}/verdicts.json`, "utf8"));
  icons = icons.filter((icon) => !verdicts[`faceted/${icon.id}`]);
}
const output = process.argv[2];
if (!output) throw Error("Supply a new review directory");
await mkdir(output, { recursive: false });
let ready = [];
for (const icon of icons) {
  try {
    await access(`${source}/masters/${icon.id}.png`);
    ready.push(icon);
  } catch {}
}
for (let start = 0; start < ready.length; start += 24) {
  const batch = ready.slice(start, start + 24),
    layers = [];
  for (let i = 0; i < batch.length; i++) {
    const icon = batch[i],
      x = (i % 4) * 240,
      y = Math.floor(i / 4) * 120;
    layers.push({
      input: Buffer.from(
        `<svg width="240" height="120"><text x="8" y="18" fill="#eee" font-family="sans-serif" font-size="12">${icon.id}</text><text x="8" y="112" fill="#bbb" font-family="sans-serif" font-size="10">shipped 32 · Facets 24 / 32 / 64</text></svg>`,
      ),
      left: x,
      top: y,
    });
    try {
      layers.push({
        input: await sharp(`${process.argv[3]}/shipped/${icon.id}.png`)
          .resize(32, 32, { fit: "contain" })
          .png()
          .toBuffer(),
        left: x + 8,
        top: y + 46,
      });
    } catch {}
    const master = await normalizeMaster(`${source}/masters/${icon.id}.png`);
    for (const [size, dx] of [
      [24, 58],
      [32, 100],
      [64, 157],
    ])
      layers.push({
        input: await sharp(master).resize(size, size).png().toBuffer(),
        left: x + dx,
        top: y + 61 - size / 2,
      });
  }
  await sharp({ create: { width: 960, height: Math.ceil(batch.length / 4) * 120, channels: 4, background: "#25282d" } })
    .composite(layers)
    .png()
    .toFile(`${output}/sheet-${String(start / 24 + 1).padStart(2, "0")}.png`);
}
console.log(`${ready.length} paintings reviewed in ${Math.ceil(ready.length / 24)} sheets: ${output}`);
