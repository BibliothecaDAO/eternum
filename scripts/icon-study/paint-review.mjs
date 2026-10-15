import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { normalizeMaster } from "./paint-normalize.mjs";
const repo = fileURLToPath(new URL("../../", import.meta.url));
const source = `${repo}/apps/game/asset-sources/icon-study-painted`;
const { icons, directions } = JSON.parse(await readFile(`${source}/catalog.json`, "utf8"));
const output = process.argv[2];
if (!output) throw new Error("Provide a new review evidence directory");
await mkdir(output, { recursive: true });
for (const direction of directions) {
  for (const size of [32, 64]) {
    const layers = [];
    for (const [index, icon] of icons.entries()) {
      const x = (index % 4) * 260,
        y = Math.floor(index / 4) * 116;
      layers.push({
        input: Buffer.from(
          `<svg width="260" height="116"><text x="10" y="16" fill="#eadbc2" font-family="sans-serif" font-size="12">${icon.label}</text><text x="16" y="106" fill="#bcae97" font-family="sans-serif" font-size="10">Shipped</text><text x="142" y="106" fill="#bcae97" font-family="sans-serif" font-size="10">${direction.name}</text></svg>`,
        ),
        left: x,
        top: y,
      });
      layers.push({
        input: await sharp(`${repo}/apps/game/public/${icon.old}`)
          .resize(size, size, { fit: "contain", background: "#00000000" })
          .png()
          .toBuffer(),
        left: x + 42 - size / 2,
        top: y + 57 - size / 2,
      });
      try {
        layers.push({
          input: await sharp(await normalizeMaster(`${source}/masters/${direction.id}/${icon.id}.png`))
            .resize(size, size)
            .png()
            .toBuffer(),
          left: x + 170 - size / 2,
          top: y + 57 - size / 2,
        });
      } catch (error) {
        console.log(`${direction.id}/${icon.id}: ${error.message}`);
      }
    }
    await sharp({ create: { width: 1040, height: 812, channels: 4, background: "#21190f" } })
      .composite(layers)
      .png()
      .toFile(`${output}/${direction.id}-${size}.png`);
  }
}
