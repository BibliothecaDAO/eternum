import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const revision = "b636c768616959a27e2ef45665e2c317fda9b40c";
const replacedBy = "301ca1d55a2a95ac6899a445cc4ea33db7d15b88";
const renderer = "apps/game/src/ui/design-system/molecules/resource-icon.tsx";
const git = (...args) => execFileSync("git", args, { cwd: repo });

/** Restore the exact pre-Facets renderer's artwork, including its Donkey and SAT exceptions. */
export async function buildResourceHistory(checking) {
  const resources = JSON.parse(await readFile(`${repo}/apps/game/asset-sources/facets/resources.json`, "utf8"));
  const oldRenderer = git("show", `${revision}:${renderer}`).toString();
  const oldIds = git("show", `${revision}:packages/types/src/constants/resource-ids.ts`).toString();
  const output = `${repo}/apps/game/public/lab/rss-icons/history`;
  const entries = {};
  if (!checking) await mkdir(output, { recursive: true });
  for (const [id, { name, meaning }] of Object.entries(resources)) {
    if (!oldIds.includes(`${name} = ${id},`)) throw new Error(`Historical resource id differs: ${name}`);
    const entry = {
      id: Number(id),
      source: null,
      blob: null,
      sha256: null,
      url: null,
      width: null,
      height: null,
      glyph: null,
      note: "",
    };
    if (name === "SAT") {
      if (!oldRenderer.includes('className="font-bold text-orange-400"') || !oldRenderer.includes("₿"))
        throw new Error("Historical SAT glyph changed.");
      entry.glyph = "₿";
      entry.note = "The old renderer used an orange text glyph, not a painting.";
    } else {
      const source = name === "Donkey" ? "images/buildings/thumb/trade.png" : `images/resources/${id}.png`;
      const reference =
        name === "Donkey" ? "/images/buildings/thumb/trade.png" : "/images/resources/${ResourcesIds." + name + "}.png";
      if (!oldRenderer.includes(reference)) throw new Error(`Historical renderer does not use ${source}`);
      entry.source = `apps/game/public/${source}`;
      const bytes = git("show", `${revision}:${entry.source}`);
      const metadata = await sharp(bytes).metadata();
      entry.blob = git("rev-parse", `${revision}:${entry.source}`).toString().trim();
      entry.sha256 = createHash("sha256").update(bytes).digest("hex");
      entry.url = `/lab/rss-icons/history/${meaning}.png`;
      entry.width = metadata.width;
      entry.height = metadata.height;
      if (name === "Donkey") entry.note = "The old resource renderer used the trade-building thumbnail.";
      const path = `${output}/${meaning}.png`;
      if (checking) {
        if (!bytes.equals(await readFile(path))) throw new Error(`Historical artwork differs from git: ${meaning}`);
      } else await writeFile(path, bytes);
    }
    entries[meaning] = entry;
  }
  const expected = Object.values(entries).flatMap((entry) => (entry.url ? [entry.url.split("/").pop()] : []));
  for (const file of await readdir(output))
    if (!expected.includes(file)) throw new Error(`Unwired historical artwork: ${file}`);
  const manifest = { revision, replacedBy, renderer, entries };
  const path = `${repo}/apps/game/asset-sources/rss-icons/history.json`;
  if (checking) {
    if (JSON.stringify(JSON.parse(await readFile(path, "utf8"))) !== JSON.stringify(manifest))
      throw new Error("Historical catalog differs from the pinned renderer and artwork.");
  } else await writeFile(path, JSON.stringify(manifest, null, 2) + "\n");
  console.log(
    `Historical set: ${expected.length} exact git images and the SAT glyph, ${Object.keys(entries).length} resources.`,
  );
}
