import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import sharp from "sharp";
import { catalog, themes } from "./catalog.mjs";

const output = resolve(process.argv[2] ?? ".context/icon-study-verification");
await mkdir(output, { recursive: true });
const checks = [];
const duplicates = [];
for (const theme of themes) {
  for (const size of [16, 24, 32]) {
    const resourceHashes = new Map();
    for (const icon of catalog) {
      const source = await readFile(
        new URL(`../../apps/game/asset-sources/icon-study/${theme.id}/${icon.id}.svg`, import.meta.url),
      );
      const { data, info } = await sharp(source)
        .resize(size, size)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const alpha = data.filter((_, i) => i % info.channels === 3);
      const occupiedPixels = alpha.filter((value) => value > 110).length;
      if (occupiedPixels < 3) throw new Error(`${theme.id}/${icon.id} is empty at ${size}px`);
      const hash = createHash("sha256").update(alpha).digest("hex");
      if (icon.resourceId && resourceHashes.has(hash))
        duplicates.push({ theme: theme.id, size, pair: [resourceHashes.get(hash), icon.id] });
      if (icon.resourceId) resourceHashes.set(hash, icon.id);
      checks.push({ theme: theme.id, icon: icon.id, size, occupiedPixels, hash });
    }
  }
}
await writeFile(
  `${output}/raster-checks.json`,
  JSON.stringify(
    {
      checks,
      duplicates,
      note: "Pixel occupancy and exact duplicate detection are technical checks, not recognition evidence.",
    },
    null,
    2,
  ),
);
if (duplicates.length)
  throw new Error(`${duplicates.length} resource pairs render identically; see raster-checks.json`);
console.log(JSON.stringify({ renders: checks.length, duplicates: duplicates.length, output }));
