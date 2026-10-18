import { access, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import sharp from "sharp";
import { normalizeMaster } from "./normalize.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function validateIconFiles(icons, source, output) {
  for (const { id, source: origin } of icons) {
    const master = `${source}/masters/${id}.png`;
    await access(master);
    if (origin) {
      if (hash(await readFile(master)) !== origin.sha256) throw new Error(`Source master changed: ${id}`);
      for (const [input, expected] of Object.entries(origin.inputs ?? {})) {
        if (hash(await readFile(resolve(source, "../../../..", input))) !== expected)
          throw new Error(`Model changed; rerender ${id}: ${input}`);
      }
    }
    const normalized = output && origin ? await normalizeMaster(master) : undefined;
    if (output)
      for (const size of [64, 128, 256]) {
        const delivery = `${output}/${size}/${id}.webp`;
        await access(delivery);
        if (normalized) {
          const expected = await sharp(normalized)
            .resize(size, size)
            .webp({ quality: 90, alphaQuality: 100, effort: 6 })
            .toBuffer();
          if (!(await readFile(delivery)).equals(expected)) throw new Error(`Stale production delivery: ${delivery}`);
        }
      }
  }
}
