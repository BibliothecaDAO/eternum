import { parse } from "acorn";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PWA_PRECACHE_BUDGET_BYTES, PWA_PRECACHE_FILES } from "../build/pwa-assets.mjs";

/** Inspect the injected worker itself, rather than a second list that could drift from it. */
export async function verifyPwaBuild(dist) {
  const worker = await readFile(join(dist, "sw.js"), "utf8");
  const entries = readInjectedPrecache(worker);
  const failures = [];
  const totalBytes = await checkPrecacheEntries(dist, entries, failures);
  await checkInstallAssets(dist, failures);
  return {
    ok: failures.length === 0,
    totalBytes,
    budgetBytes: PWA_PRECACHE_BUDGET_BYTES,
    workerBytes: Buffer.byteLength(worker),
    entries,
    failures,
  };
}

async function checkPrecacheEntries(dist, entries, failures) {
  const urls = entries.map(({ url }) => url);
  if (new Set(urls).size !== urls.length) failures.push("Duplicate precache URLs");
  for (const url of PWA_PRECACHE_FILES) if (!urls.includes(url)) failures.push(`Missing precache file: ${url}`);
  for (const entry of entries) {
    if (!PWA_PRECACHE_FILES.includes(entry.url)) {
      failures.push(`Unapproved precache file: ${entry.url}`);
      continue;
    }
    const bytes = await readFile(join(dist, entry.url));
    entry.bytes = bytes.length;
    if (createHash("md5").update(bytes).digest("hex") !== entry.revision) failures.push(`Stale revision: ${entry.url}`);
  }
  const totalBytes = entries.reduce((total, entry) => total + (entry.bytes ?? 0), 0);
  if (totalBytes >= PWA_PRECACHE_BUDGET_BYTES) failures.push("Precache exceeds the byte budget");
  return totalBytes;
}

function readInjectedPrecache(worker) {
  const arrays = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "ArrayExpression" && node.elements.length) {
      const values = node.elements.map(readManifestEntry);
      if (values.every(Boolean)) arrays.push(values);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  };
  visit(parse(worker, { ecmaVersion: "latest", sourceType: "module" }));
  if (arrays.length !== 1) throw new Error("Worker must contain exactly one injected precache manifest");
  return arrays[0];
}

function readManifestEntry(node) {
  if (node?.type !== "ObjectExpression") return null;
  const values = Object.fromEntries(
    node.properties.map((property) => [property.key?.name ?? property.key?.value, property.value?.value]),
  );
  return typeof values.url === "string" && typeof values.revision === "string"
    ? { url: values.url, revision: values.revision }
    : null;
}

async function checkInstallAssets(dist, failures) {
  const manifest = JSON.parse(await readFile(join(dist, "manifest.webmanifest"), "utf8"));
  if (manifest.id !== "/" || manifest.scope !== "/" || manifest.start_url !== "/" || manifest.display !== "standalone")
    failures.push("Invalid installed-app identity or scope");
  await checkInstallIcons(dist, manifest, failures);
  await checkThemeColor(dist, manifest, failures);
  await checkOfflineDependencies(dist, failures);
  await checkCacheHeaders(dist, failures);
}

async function checkInstallIcons(dist, manifest, failures) {
  for (const [size, purpose] of [
    [192, "any"],
    [512, "any"],
    [512, "maskable"],
  ]) {
    const icon = manifest.icons?.find((entry) => entry.sizes === `${size}x${size}` && entry.purpose === purpose);
    if (!icon || !PWA_PRECACHE_FILES.includes(icon.src.replace(/^\//, ""))) {
      failures.push(`Missing ${size}px ${purpose} install icon`);
      continue;
    }
    const bytes = await readFile(join(dist, icon.src));
    if (bytes.length < 24 || bytes.readUInt32BE(16) !== size || bytes.readUInt32BE(20) !== size)
      failures.push(`Wrong icon dimensions: ${icon.src}`);
  }
}

async function checkThemeColor(dist, manifest, failures) {
  const html = await readFile(join(dist, "index.html"), "utf8");
  const theme = html.match(/<meta\s+name="theme-color"\s+content="([^"]+)"/i)?.[1];
  if (!theme || theme.toLowerCase() !== manifest.theme_color?.toLowerCase()) failures.push("Theme color mismatch");
}

async function checkOfflineDependencies(dist, failures) {
  const offline = await readFile(join(dist, "offline.html"), "utf8");
  for (const [, url] of offline.matchAll(/(?:src|href)\s*=\s*["']([^"']+)/g)) {
    if (!PWA_PRECACHE_FILES.includes(url.replace(/^\//, "")))
      failures.push(`Offline document requires uncached resource: ${url}`);
  }
}

async function checkCacheHeaders(dist, failures) {
  const headers = await readFile(join(dist, "_headers"), "utf8");
  for (const path of ["sw.js", "manifest.webmanifest", "offline.html"]) {
    if (!headers.includes(`/${path}\n  Cache-Control: no-cache`))
      failures.push(`Missing revalidation header: /${path}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [dist = "dist", output = "pwa-build-check.json"] = process.argv.slice(2);
  let result;
  try {
    result = await verifyPwaBuild(dist);
  } catch (error) {
    result = { ok: false, failures: [error.message] };
  }
  await writeFile(output, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
