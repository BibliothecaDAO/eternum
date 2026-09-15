import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { readPathOption } from "./icon-cli.mjs";
import { verifyIconImage } from "./icon-image.mjs";
import { loadMenuIconManifest, STAGED_MENU_ICON_DIRECTORY } from "./menu-icon-manifest.mjs";

export async function verifyMenuIcons({ imageDirectory }) {
  const manifest = await loadMenuIconManifest();
  const hashes = new Map();
  const results = [];
  for (const icon of manifest.icons) {
    const result = await verifyIconImage(join(imageDirectory, icon.target), manifest.output);
    const duplicate = hashes.get(result.sha256);
    if (duplicate) throw new Error(`${icon.slug} duplicates ${duplicate}`);
    hashes.set(result.sha256, icon.slug);
    results.push({ ...result, name: icon.name, slug: icon.slug, target: icon.target });
  }
  return { count: results.length, imageDirectory, manifest: "valid", results };
}

async function main(args) {
  const result = await verifyMenuIcons({
    imageDirectory: readPathOption(args, "--input-dir", STAGED_MENU_ICON_DIRECTORY),
  });
  console.log(JSON.stringify(result, null, 2));
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) await main(process.argv.slice(2));
