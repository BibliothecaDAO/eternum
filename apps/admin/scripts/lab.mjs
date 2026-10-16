/**
 * Writes the admin page with the lab's fixtures into a directory any static server can serve:
 *
 *   node apps/admin/scripts/lab.mjs <directory>
 *
 * The page is public/ as the Worker serves it; lab/fixtures.js answers its API calls. Running it again overwrites the
 * same files, so a server already pointed at the directory shows the change on reload.
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [directory] = process.argv.slice(2);
if (!directory) throw new Error("Usage: node apps/admin/scripts/lab.mjs <directory>");
const out = resolve(directory);
const app = new URL("..", import.meta.url).pathname;

mkdirSync(out, { recursive: true });
cpSync(resolve(app, "public"), out, { recursive: true });
cpSync(resolve(app, "lab/fixtures.js"), resolve(out, "fixtures.js"));
const page = readFileSync(resolve(app, "public/index.html"), "utf8");
const withFixtures = page.replace(
  '<script type="module" src="admin.js"></script>',
  '<script src="fixtures.js"></script>\n    <script type="module" src="admin.js"></script>',
);
if (withFixtures === page) throw new Error("index.html no longer loads admin.js as the lab expects");
writeFileSync(resolve(out, "index.html"), withFixtures);
console.log(`Admin lab written to ${out}`);
