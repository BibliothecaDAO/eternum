/**
 * Fails the docs build when a built file holds a filesystem path: `node check-no-build-paths.mjs <dist>`.
 *
 * A machine's path in the site publishes that machine's layout, whichever machine or folder it names: the checkout,
 * a shared asset folder, a temporary build directory. The site's own addresses are root-relative URLs (`/images/…`),
 * which name no filesystem root and pass.
 */
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * A POSIX path under a root that holds machines' files (home folders, temporary and workspace directories, mounts), or
 * a Windows path from a drive letter. A web address names none of these roots: one inside a URL follows its host's
 * name or its own path, which the lookbehind refuses.
 */
const FILESYSTEM_PATH = new RegExp(
  [
    String.raw`(?<![\w.-])/(?:home|Users|root|tmp|private|var/folders|var/tmp|workspaces?|mnt|opt|srv|runner|builds)/[^\s"'\x60<>)]+`,
    String.raw`(?<![A-Za-z])[A-Za-z]:(?:\\{1,2}|/)(?:[\w .-]+(?:\\{1,2}|/))*[\w .-]+`,
  ].join("|"),
  "g",
);

/** The built files a reader's browser reads as text; images, fonts and video hold no path and are not scanned. */
const TEXT = /\.(?:html|js|mjs|css|json|txt|xml|svg|webmanifest)$/;

/** Every filesystem path a built text file holds, each with the file it is in, relative to `dist`. */
export async function buildPathsIn(dist) {
  const entries = await readdir(dist, { recursive: true, withFileTypes: true });
  const found = [];
  for (const entry of entries.filter((entry) => entry.isFile() && TEXT.test(entry.name))) {
    const file = join(entry.parentPath, entry.name);
    for (const [path] of (await readFile(file, "utf8")).matchAll(FILESYSTEM_PATH))
      found.push({ file: relative(dist, file), path });
  }
  return found.sort((a, b) => a.file.localeCompare(b.file) || a.path.localeCompare(b.path));
}

async function main() {
  const [dist] = process.argv.slice(2);
  if (!dist) throw new Error("Usage: check-no-build-paths.mjs <dist>");
  const found = await buildPathsIn(dist);
  if (found.length) {
    const first = found.slice(0, 5).map(({ file, path }) => `${file}: ${path.slice(0, 120)}`);
    console.error(`${found.length} filesystem paths in the built docs:\n${first.join("\n")}`);
    process.exitCode = 1;
    return;
  }
  console.log("No built file holds a filesystem path.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
