import * as path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);

/** The pages' source folder. */
export const docsDir = path.resolve(root, "docs");
/** The game app's public folder: it holds the docs' images and fonts. */
export const publicDir = path.resolve(root, "../game/public");
/** The import aliases the pages use: the site's Vite config and the export's evaluation share them. */
export const docsAliases = {
  "@": docsDir,
  "@config": path.resolve(root, "../../config/utils/utils"),
};
