import { fileURLToPath } from "node:url";

import { buildResourceIconPrompt, loadResourceIconManifest, selectResourceIcons } from "./resource-icon-manifest.mjs";

export function formatResourceIconPrompts(manifest, resources) {
  return resources
    .map(
      (resource) =>
        `## ${resource.id}. ${resource.name} [${resource.slug}]\n\n${buildResourceIconPrompt(manifest, resource)}`,
    )
    .join("\n\n");
}

async function main(args) {
  const manifest = await loadResourceIconManifest();
  const resources = selectResourceIcons(manifest, args.includes("--pilot"));
  console.log(formatResourceIconPrompts(manifest, resources));
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) await main(process.argv.slice(2));
