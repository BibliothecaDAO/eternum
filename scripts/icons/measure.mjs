import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repo = fileURLToPath(new URL("../../", import.meta.url));
if (!process.argv[2]) throw new Error("Pass a new evidence directory.");
const out = resolve(process.argv[2]);
await mkdir(out);
const { icons } = JSON.parse(await readFile(`${repo}/apps/game/asset-sources/facets/catalog.json`, "utf8"));
const rows = [];
for (const size of [64, 128, 256]) {
  const images = await Promise.all(
    icons.map(({ id }) => readFile(`${repo}/apps/game/public/icons/facets/${size}/${id}.webp`)),
  );
  const columns = 16;
  const atlas = await sharp({
    create: {
      width: columns * size,
      height: Math.ceil(images.length / columns) * size,
      channels: 4,
      background: "#00000000",
    },
  })
    .composite(
      images.map((input, index) => ({
        input,
        left: (index % columns) * size,
        top: Math.floor(index / columns) * size,
      })),
    )
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toBuffer();
  await writeFile(`${out}/atlas-${size}.webp`, atlas);
  rows.push({
    size,
    paintings: images.length,
    individualBytes: images.reduce((n, b) => n + b.length, 0),
    individualGzip: images.reduce((n, b) => n + gzipSync(b).length, 0),
    atlasBytes: atlas.length,
    atlasGzip: gzipSync(atlas).length,
  });
}
const assets = await readdir(`${repo}/apps/game/dist/assets`, { recursive: true });
let bytes = 0,
  gzip = 0,
  files = 0;
for (const file of assets) {
  try {
    const b = await readFile(`${repo}/apps/game/dist/assets/${file}`);
    bytes += b.length;
    gzip += gzipSync(b).length;
    files++;
  } catch (error) {
    if (error.code !== "EISDIR") throw error;
  }
}
const result = {
  runs: 1,
  rows,
  bundle: { files, bytes, gzip },
  note: "Deterministic byte counts of checked-in WebP exports and a comparison atlas recompressed at the same quality. No timing or frame-rate measurement. HTTP headers, request overhead and cache reuse excluded. Atlas is evidence only; runtime uses individual images.",
};
await writeFile(`${out}/bytes.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
