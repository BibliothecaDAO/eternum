import { access, mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import { readPathOption } from "./icon-cli.mjs";
import { normalizeIconImage } from "./icon-image.mjs";
import {
  APPROVED_RESOURCE_ICON_DIRECTORY,
  loadResourceIconManifest,
  selectResourceIcons,
  STAGED_RESOURCE_ICON_DIRECTORY,
} from "./resource-icon-manifest.mjs";

export async function buildResourceIcons({ inputDirectory, outputDirectory, pilotOnly = false }) {
  const manifest = await loadResourceIconManifest();
  const resources = selectResourceIcons(manifest, pilotOnly);
  await requireResourceIconMasters(resources, inputDirectory);
  await mkdir(outputDirectory, { recursive: true });

  const results = [];
  for (const resource of resources) {
    const inputPath = join(inputDirectory, `${resource.slug}.png`);
    const outputPath = join(outputDirectory, `${resource.id}.png`);
    const result = await normalizeIconImage(inputPath, outputPath, manifest.output);
    results.push({ ...result, enumKey: resource.enumKey, id: resource.id, slug: resource.slug });
  }
  return results;
}

async function requireResourceIconMasters(resources, inputDirectory) {
  const missing = [];
  for (const resource of resources) {
    const sourcePath = join(inputDirectory, `${resource.slug}.png`);
    try {
      await access(sourcePath);
    } catch {
      missing.push(basename(sourcePath));
    }
  }
  if (missing.length > 0) throw new Error(`Missing resource icon masters in ${inputDirectory}: ${missing.join(", ")}`);
}

async function main(args) {
  const inputDirectory = readPathOption(args, "--input-dir", APPROVED_RESOURCE_ICON_DIRECTORY);
  const outputDirectory = readPathOption(args, "--output-dir", STAGED_RESOURCE_ICON_DIRECTORY);
  const results = await buildResourceIcons({
    inputDirectory,
    outputDirectory,
    pilotOnly: args.includes("--pilot"),
  });
  console.log(JSON.stringify({ count: results.length, outputDirectory, results }, null, 2));
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) await main(process.argv.slice(2));
