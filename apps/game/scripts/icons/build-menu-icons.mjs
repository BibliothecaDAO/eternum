import { access, mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import { readPathOption } from "./icon-cli.mjs";
import { normalizeIconImage } from "./icon-image.mjs";
import {
  APPROVED_MENU_ICON_DIRECTORY,
  loadMenuIconManifest,
  STAGED_MENU_ICON_DIRECTORY,
} from "./menu-icon-manifest.mjs";

export async function buildMenuIcons({ inputDirectory, outputDirectory }) {
  const manifest = await loadMenuIconManifest();
  await requireMenuIconMasters(manifest.icons, inputDirectory);
  await mkdir(outputDirectory, { recursive: true });

  const results = [];
  for (const icon of manifest.icons) {
    const inputPath = join(inputDirectory, `${icon.slug}.png`);
    const outputPath = join(outputDirectory, icon.target);
    const result = await normalizeIconImage(inputPath, outputPath, manifest.output);
    results.push({ ...result, name: icon.name, slug: icon.slug, target: icon.target });
  }
  return results;
}

async function requireMenuIconMasters(icons, inputDirectory) {
  const missing = [];
  for (const icon of icons) {
    const sourcePath = join(inputDirectory, `${icon.slug}.png`);
    try {
      await access(sourcePath);
    } catch {
      missing.push(basename(sourcePath));
    }
  }
  if (missing.length > 0) throw new Error(`Missing menu icon masters in ${inputDirectory}: ${missing.join(", ")}`);
}

async function main(args) {
  const inputDirectory = readPathOption(args, "--input-dir", APPROVED_MENU_ICON_DIRECTORY);
  const outputDirectory = readPathOption(args, "--output-dir", STAGED_MENU_ICON_DIRECTORY);
  const results = await buildMenuIcons({ inputDirectory, outputDirectory });
  console.log(JSON.stringify({ count: results.length, outputDirectory, results }, null, 2));
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) await main(process.argv.slice(2));
