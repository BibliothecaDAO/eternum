import sharp from "sharp";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("./", import.meta.url);
const delivery = new URL("../../public/images/landscapes/", root);
const ids = ["season-citadel", "blitz-aftermath"];
const check = process.argv.includes("--check");
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");
const manifest = [];
for (const id of ids) {
  const master = await readFile(new URL(`masters/${id}.png`, root));
  const prompt = await readFile(new URL(`prompts/${id}.txt`, root));
  const metadata = await sharp(master).metadata();
  const files = [];
  for (const width of [800, 1536]) {
    if (width > metadata.width) throw new Error(`${id}: upscaling is forbidden`);
    const bytes = await sharp(master).resize({ width }).webp({ quality: 78, effort: 6 }).toBuffer();
    const path = new URL(`${id}-${width}.webp`, delivery);
    if (check) {
      if (!(await readFile(path)).equals(bytes)) throw new Error(`Rebuild ${fileURLToPath(path)}`);
    } else await writeFile(path, bytes);
    if (bytes.length > 300_000) throw new Error(`${id}-${width}: background exceeds 300 KB`);
    files.push({ file: `${id}-${width}.webp`, width, bytes: bytes.length, sha256: hash(bytes) });
  }
  manifest.push({
    id,
    masterSha256: hash(master),
    promptSha256: hash(prompt),
    width: metadata.width,
    height: metadata.height,
    files,
  });
}
const json = JSON.stringify(manifest, null, 2) + "\n";
const path = new URL("delivery.json", root);
if (check) {
  if ((await readFile(path, "utf8")) !== json) throw new Error("Rebuild app background delivery manifest");
} else await writeFile(path, json);
console.log(`${check ? "Checked" : "Built"} ${manifest.length} paintings, four WebP deliveries, no upscaling.`);
