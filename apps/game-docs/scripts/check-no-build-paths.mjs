/**
 * Fails the docs build when a built file names the checkout it was built in: `node check-no-build-paths.mjs <dist>`.
 *
 * Such a path publishes the build machine's layout, and it makes the output depend on the directory: the deploy builds
 * in a fresh directory each run, so its build would never match the one already published, and the deployment check
 * could not pass on a rerun.
 */
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const CHECKOUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** The built files whose bytes contain `checkout`, relative to `dist`. */
export async function filesNamingCheckout(dist, checkout = CHECKOUT) {
  const entries = await readdir(dist, { recursive: true, withFileTypes: true });
  const named = [];
  for (const entry of entries.filter((entry) => entry.isFile())) {
    const file = join(entry.parentPath, entry.name);
    if ((await readFile(file)).includes(checkout)) named.push(relative(dist, file));
  }
  return named.sort();
}

async function main() {
  const [dist] = process.argv.slice(2);
  if (!dist) throw new Error("Usage: check-no-build-paths.mjs <dist>");
  const named = await filesNamingCheckout(dist);
  if (named.length) {
    console.error(`${named.length} built files name the checkout ${CHECKOUT}: ${named.slice(0, 5).join(", ")}`);
    process.exitCode = 1;
    return;
  }
  console.log("No built file names the checkout it was built in.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
