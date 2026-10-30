#!/usr/bin/env node
// Code that runs on Cloudflare Workers never asks fetch for `redirect: "error"`. Node accepts it, so tests that run in
// Node pass; the Workers runtime throws before anything is sent ("error" won't be implemented ... use "manual"), and a
// caller that turns failures into a fallback hides it. The marketplace index read did exactly that on 10-29: every
// held-Realms answer was a 503. Use `redirect: "manual"` and treat a 3xx as the failure it is.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REFUSED = /redirect\s*:\s*["'`]error["'`]/;

/** Every line of Worker source that asks fetch for a redirect option the Workers runtime refuses. */
export function findEdgeRefusedFetchOptions(files) {
  return files.flatMap(({ path, text }) =>
    text
      .split("\n")
      .flatMap((line, index) => (REFUSED.test(line) ? [{ path, line: index + 1, text: line.trim() }] : [])),
  );
}

/** The source a Worker runs: each app with a wrangler config, and the packages Workers import, tests aside. */
export const isWorkerSource = (path, workerApps) =>
  /\.(ts|tsx|js|mjs)$/.test(path) &&
  !/\.test\.|\/test\/|node_modules\//.test(path) &&
  (workerApps.some((app) => path.startsWith(`${app}/`)) || /^packages\/[^/]+\/src\//.test(path));

const committedFiles = () => execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const files = committedFiles();
  const workerApps = files.filter((path) => /^apps\/[^/]+\/wrangler\.(jsonc|json|toml)$/.test(path)).map(dirname);
  const findings = findEdgeRefusedFetchOptions(
    files
      .filter((path) => isWorkerSource(path, workerApps) && existsSync(path))
      .map((path) => ({ path, text: readFileSync(path, "utf8") })),
  );
  for (const { path, line, text } of findings)
    console.error(
      `${path}:${line}: ${text}  ← the Workers runtime refuses redirect "error"; use "manual" and fail on 3xx`,
    );
  if (findings.length > 0) process.exit(1);
  console.log(`no Worker source asks fetch for redirect "error" (${workerApps.length} Worker apps and packages/*/src)`);
}
