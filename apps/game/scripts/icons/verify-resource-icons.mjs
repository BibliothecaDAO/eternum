import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { readPathOption } from "./icon-cli.mjs";
import { verifyIconImage } from "./icon-image.mjs";
import {
  loadResourceIconManifest,
  selectResourceIcons,
  STAGED_RESOURCE_ICON_DIRECTORY,
} from "./resource-icon-manifest.mjs";

export async function verifyResourceIcons({ imageDirectory, pilotOnly = false, verifyImages = true }) {
  const manifest = await loadResourceIconManifest();
  const resources = selectResourceIcons(manifest, pilotOnly);
  if (!verifyImages) return { count: resources.length, manifest: "valid" };

  const results = [];
  const hashes = new Map();
  for (const resource of resources) {
    const path = join(imageDirectory, `${resource.id}.png`);
    const result = await verifyIconImage(path, manifest.output);
    const duplicate = hashes.get(result.sha256);
    if (duplicate) throw new Error(`${resource.slug} duplicates ${duplicate}`);
    hashes.set(result.sha256, resource.slug);
    results.push({ ...result, enumKey: resource.enumKey, id: resource.id, slug: resource.slug });
  }
  return { count: results.length, imageDirectory, manifest: "valid", results };
}

async function main(args) {
  const verifyImages = args.includes("--images") || args.includes("--pilot");
  const result = await verifyResourceIcons({
    imageDirectory: readPathOption(args, "--input-dir", STAGED_RESOURCE_ICON_DIRECTORY),
    pilotOnly: args.includes("--pilot"),
    verifyImages,
  });
  console.log(JSON.stringify(result, null, 2));
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) await main(process.argv.slice(2));
