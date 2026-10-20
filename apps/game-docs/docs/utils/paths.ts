import * as path from "node:path";

// This file sits in docs/utils; the docs app is two folders up.
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

/** The pages' source folder. */
export const docsDir = path.resolve(root, "docs");
/** The game app's public folder: it holds the docs' images and fonts, and serves the text export. */
export const publicDir = path.resolve(root, "../game/public");
/** Where the text export is written; the game app serves it as /llm.txt. */
export const llmTxtFile = path.resolve(publicDir, "llm.txt");
/** The import aliases the pages use: the site's Vite config and the export's evaluation share them. */
export const docsAliases = {
  "@": docsDir,
  "@config": path.resolve(root, "../../config/utils/utils"),
};
