import { access, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { normalizeMaster, assertIconFill, deliverIcon } from "./normalize.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function validateIconFiles(icons, source, output) {
  const queue = [...icons];
  // Four icons at a time: sharp decodes and encodes off the main thread while another icon's subject is measured.
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (queue.length) await validateIcon(queue.shift(), source, output);
    }),
  );
}

async function validateIcon({ id, source: origin }, source, output) {
  const master = `${source}/masters/${id}.png`;
  await access(master);
  if (origin) {
    if (hash(await readFile(master)) !== origin.sha256) throw new Error(`Source master changed: ${id}`);
    for (const [input, expected] of Object.entries(origin.inputs ?? {})) {
      if (hash(await readFile(resolve(source, "../../../..", input))) !== expected)
        throw new Error(`Model changed; rerender ${id}: ${input}`);
    }
  }
  if (output) await assertDeliveredFromMaster(master, output, id);
}

/** Every delivery fills its frame and is exactly what the pipeline makes from its master today. */
async function assertDeliveredFromMaster(master, output, id) {
  const normalized = await normalizeMaster(master);
  for (const size of [64, 128, 256]) {
    const delivery = `${output}/${size}/${id}.webp`;
    await assertIconFill(delivery, `${id}/${size}`);
    if (!(await readFile(delivery)).equals(await deliverIcon(normalized, size, id)))
      throw new Error(`Stale production delivery: ${delivery}. Run pnpm icons:build ${id}.`);
  }
}
