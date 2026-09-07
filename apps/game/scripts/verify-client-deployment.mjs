import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function verifyClientDeployment(dist, origin) {
  const checks = await checkPublishedAssets(dist, origin);
  const modules = checks.length;
  const entry = await readModuleEntry(dist);
  for (const route of [
    "/",
    "/play/madara/deployment-check/map?spectate=true",
    "/biome-lab",
    "/local-lab",
    "/factory/v2",
  ]) {
    checks.push(await checkPublishedRoute(origin, route, entry));
  }
  checks.push(await checkMissingAsset(origin));
  return { origin, ok: checks.every((check) => check.ok), modules, checks };
}

async function checkPublishedAssets(dist, origin) {
  const files = (await readdir(join(dist, "assets"))).filter((name) => /\.(js|css)$/.test(name));
  if (!files.length) throw new Error("Build has no client modules");
  const checks = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (next < files.length) {
        const file = files[next++];
        checks.push(await checkPublishedAsset(dist, origin, file));
      }
    }),
  );
  return checks;
}

async function readModuleEntry(dist) {
  const html = await readFile(join(dist, "index.html"), "utf8");
  const entry = html.match(/src="(\/assets\/[^" ]+\.js)"/)?.[1];
  if (!entry) throw new Error("Build HTML has no module entry");
  return entry;
}

async function fetchResponse(origin, path) {
  return fetch(new URL(path, origin), { signal: AbortSignal.timeout(30_000) });
}

async function checkPublishedAsset(dist, origin, file) {
  const path = `/assets/${file}`;
  try {
    const response = await fetchResponse(origin, path);
    const type = response.headers.get("content-type") ?? "";
    const expectedType = file.endsWith(".js") ? /(?:javascript|ecmascript)/i : /text\/css/i;
    const expected = await readFile(join(dist, "assets", file));
    const actual = Buffer.from(await response.arrayBuffer());
    return {
      path,
      status: response.status,
      type,
      bytes: actual.length,
      ok: response.status === 200 && expectedType.test(type) && digest(actual) === digest(expected),
    };
  } catch (error) {
    return { path, ok: false, error: error.message };
  }
}

async function checkPublishedRoute(origin, path, entry) {
  try {
    const response = await fetchResponse(origin, path);
    const cache = response.headers.get("cache-control") ?? "";
    const html = await response.text();
    return {
      path,
      status: response.status,
      cache,
      ok:
        response.status === 200 &&
        html.includes(entry) &&
        /no-cache|max-age=0\b/.test(cache) &&
        !cache.includes("immutable"),
    };
  } catch (error) {
    return { path, ok: false, error: error.message };
  }
}

async function checkMissingAsset(origin) {
  const path = `/assets/deployment-check-missing-${Date.now()}.js`;
  try {
    const response = await fetchResponse(origin, path);
    const cache = response.headers.get("cache-control") ?? "";
    await response.arrayBuffer();
    return { path, status: response.status, cache, ok: response.status === 404 && !cache.includes("immutable") };
  } catch (error) {
    return { path, ok: false, error: error.message };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [dist, origin, reportPath = "client-deployment-check.json"] = process.argv.slice(2);
  if (!dist || !origin) throw new Error("Usage: verify-client-deployment.mjs <dist> <origin> [report.json]");
  const result = await verifyClientDeployment(dist, origin);
  await writeFile(reportPath, JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify(
      { origin, ok: result.ok, modules: result.modules, failures: result.checks.filter((check) => !check.ok) },
      null,
      2,
    ),
  );
  if (!result.ok) process.exitCode = 1;
}
