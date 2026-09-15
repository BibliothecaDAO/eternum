import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { buildResourceIcons } from "./build-resource-icons.mjs";
import {
  APPROVED_RESOURCE_ICON_DIRECTORY,
  loadResourceIconManifest,
  PUBLISHED_RESOURCE_ICON_DIRECTORY,
  STAGED_RESOURCE_ICON_DIRECTORY,
} from "./resource-icon-manifest.mjs";
import { verifyResourceIcons } from "./verify-resource-icons.mjs";

const buildResults = await buildResourceIcons({
  inputDirectory: APPROVED_RESOURCE_ICON_DIRECTORY,
  outputDirectory: STAGED_RESOURCE_ICON_DIRECTORY,
});
const verification = await verifyResourceIcons({ imageDirectory: STAGED_RESOURCE_ICON_DIRECTORY });
const manifest = await loadResourceIconManifest();

await mkdir(PUBLISHED_RESOURCE_ICON_DIRECTORY, { recursive: true });
for (const resource of manifest.resources) {
  await copyFile(
    join(STAGED_RESOURCE_ICON_DIRECTORY, `${resource.id}.png`),
    join(PUBLISHED_RESOURCE_ICON_DIRECTORY, `${resource.id}.png`),
  );
}

console.log(
  JSON.stringify(
    {
      built: buildResults.length,
      published: manifest.resources.length,
      publishedDirectory: PUBLISHED_RESOURCE_ICON_DIRECTORY,
      verification,
    },
    null,
    2,
  ),
);
