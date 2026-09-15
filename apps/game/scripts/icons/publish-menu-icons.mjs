import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { buildMenuIcons } from "./build-menu-icons.mjs";
import {
  APPROVED_MENU_ICON_DIRECTORY,
  loadMenuIconManifest,
  PUBLISHED_MENU_ICON_DIRECTORY,
  STAGED_MENU_ICON_DIRECTORY,
} from "./menu-icon-manifest.mjs";
import { verifyMenuIcons } from "./verify-menu-icons.mjs";

const buildResults = await buildMenuIcons({
  inputDirectory: APPROVED_MENU_ICON_DIRECTORY,
  outputDirectory: STAGED_MENU_ICON_DIRECTORY,
});
const verification = await verifyMenuIcons({ imageDirectory: STAGED_MENU_ICON_DIRECTORY });
const manifest = await loadMenuIconManifest();

await mkdir(PUBLISHED_MENU_ICON_DIRECTORY, { recursive: true });
for (const icon of manifest.icons) {
  await copyFile(join(STAGED_MENU_ICON_DIRECTORY, icon.target), join(PUBLISHED_MENU_ICON_DIRECTORY, icon.target));
}

console.log(
  JSON.stringify(
    {
      built: buildResults.length,
      published: manifest.icons.length,
      publishedDirectory: PUBLISHED_MENU_ICON_DIRECTORY,
      verification,
    },
    null,
    2,
  ),
);
