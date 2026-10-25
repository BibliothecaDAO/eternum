import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { normalizeMaster, deliverIcon, assertIconFill } from "./normalize.mjs";

const game = fileURLToPath(new URL("../../apps/game/", import.meta.url));
const source = `${game}asset-sources/beast-icon-study`;
const output = `${game}asset-sources/lab/beast-icons`;
const catalogue = JSON.parse(await readFile(`${source}/catalog.json`, "utf8"));
const hashes = JSON.parse(await readFile(`${source}/hashes.json`, "utf8"));
const checking = process.argv.includes("--check");

/** The six proposals use the production normalizer and delivery checks, outside the production icon catalogue. */
for (const { options } of Object.values(catalogue)) {
  for (const id of options) {
    const original = await readFile(`${source}/masters/${id}.png`);
    if (createHash("sha256").update(original).digest("hex") !== hashes[id])
      throw new Error(`Changed beast proposal master: ${id}`);
    const master = await normalizeMaster(original);
    for (const size of [64, 128, 256]) {
      const path = `${output}/${size}/${id}.webp`;
      const bytes = await deliverIcon(master, size, id);
      if (checking) {
        const delivered = await readFile(path);
        if (!bytes.equals(delivered)) throw new Error(`Stale beast proposal: ${path}`);
        await assertIconFill(delivered, id);
      } else {
        await mkdir(`${output}/${size}`, { recursive: true });
        await writeFile(path, bytes);
      }
      const { fill } = await assertIconFill(bytes, id);
      console.log(`${id} ${size}px: ${(fill * 100).toFixed(1)}% subject, ${bytes.length} bytes`);
    }
  }
}
