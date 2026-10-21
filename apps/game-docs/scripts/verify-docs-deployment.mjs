/**
 * Proves a docs deployment serves this build: `node verify-docs-deployment.mjs <dist> <origin> <result.json>`.
 *
 * Every file the build wrote under `assets/` and every page must come back byte for byte as this build wrote it, each
 * page at the address Pages serves it from (`a/b/index.html` at `/a/b/`). A status alone proves nothing: a fallback or
 * an older build answers 200 too. A fresh upload can take a few seconds to reach every edge, so the check is retried
 * before it fails.
 */
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { setTimeout } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const ATTEMPTS = 10;
const RETRY_MS = 6_000;

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** The address Pages serves a built page from: its folder for an index page, else its path without `.html`. */
export const pagePath = (file) => {
  const path = `/${file.split(sep).join("/")}`;
  return path.endsWith("/index.html") ? path.slice(0, -"index.html".length) : path.slice(0, -".html".length);
};

async function filesUnder(directory) {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(directory, join(entry.parentPath, entry.name)));
}

/** One built file, fetched from the address the site serves it at: it passes only as these exact bytes. */
async function checkServed(dist, origin, file, path) {
  try {
    const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(30_000) });
    const served = Buffer.from(await response.arrayBuffer());
    const built = await readFile(join(dist, file));
    return { path, status: response.status, ok: response.status === 200 && digest(served) === digest(built) };
  } catch (error) {
    return { path, ok: false, error: error.message };
  }
}

export async function verifyDocsDeployment(dist, origin) {
  const assets = (await filesUnder(join(dist, "assets"))).map((file) => join("assets", file));
  if (!assets.length) throw new Error("Docs build has no assets");
  const pages = (await filesUnder(dist)).filter((file) => file.endsWith(".html"));
  const checks = [];
  for (const file of assets) checks.push(await checkServed(dist, origin, file, `/${file.split(sep).join("/")}`));
  for (const file of pages) checks.push(await checkServed(dist, origin, file, pagePath(file)));
  return { origin, ok: checks.every((check) => check.ok), assets: assets.length, pages: pages.length, checks };
}

async function main() {
  const [dist, origin, output] = process.argv.slice(2);
  if (!dist || !origin || !output) throw new Error("Usage: verify-docs-deployment.mjs <dist> <origin> <result.json>");
  let result;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    result = { ...(await verifyDocsDeployment(dist, origin)), attempt };
    if (result.ok || attempt === ATTEMPTS) break;
    await setTimeout(RETRY_MS);
  }
  await writeFile(output, JSON.stringify(result, null, 2) + "\n");
  const failed = result.checks.filter((check) => !check.ok);
  console.log(
    result.ok
      ? `Docs at ${origin} serve this build: ${result.assets} assets and ${result.pages} pages.`
      : `Docs at ${origin} do not serve this build: ${failed.length} checks failed, first ${failed[0].path}.`,
  );
  if (!result.ok) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
