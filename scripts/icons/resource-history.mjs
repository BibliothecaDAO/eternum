import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function readHistoricalArtwork(entry, game = `${repo}/apps/game`) {
  const bytes = await readFile(`${game}/public${entry.url}`);
  if (hash(bytes) !== entry.sha256) throw new Error(`Historical artwork hash differs: ${entry.url}`);
  return bytes;
}

/** The committed archive is the source; historical revisions describe its provenance. */
export async function buildResourceHistory() {
  const resources = JSON.parse(await readFile(`${repo}/apps/game/asset-sources/facets/resources.json`, "utf8"));
  const { entries } = JSON.parse(await readFile(`${repo}/apps/game/asset-sources/rss-icons/history.json`, "utf8"));
  const meanings = Object.values(resources)
    .map((r) => r.meaning)
    .sort();
  if (JSON.stringify(Object.keys(entries).sort()) !== JSON.stringify(meanings))
    throw new Error("Historical resource coverage differs.");
  for (const [id, { meaning }] of Object.entries(resources)) {
    const entry = entries[meaning];
    if (entry.id !== Number(id)) throw new Error(`Historical resource id differs: ${meaning}`);
    if (meaning === "s-a-t") {
      if (entry.glyph !== "₿" || entry.url !== null) throw new Error("Historical SAT glyph changed.");
      continue;
    }
    const metadata = await sharp(await readHistoricalArtwork(entry)).metadata();
    if (metadata.width !== entry.width || metadata.height !== entry.height)
      throw new Error(`Historical dimensions differ: ${meaning}`);
  }
  const expected = Object.values(entries)
    .flatMap((entry) => (entry.url ? [entry.url.split("/").pop()] : []))
    .sort();
  const actual = (await readdir(`${repo}/apps/game/public/lab/rss-icons/history`)).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Missing or unwired historical artwork.");
  console.log(
    `Historical set: ${expected.length} pinned committed images and the SAT glyph, ${meanings.length} resources.`,
  );
}
