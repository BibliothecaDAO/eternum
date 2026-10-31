#!/usr/bin/env node
// A dependency in the default pnpm catalog has one version for the whole repository, written once in
// pnpm-workspace.yaml. A package that pins it by hand drifts from the others on the next upgrade.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
const CATALOG_SPECS = new Set(["catalog:", "catalog:default"]);

/** The names in the workspace file's top-level `catalog:` block. */
export function defaultCatalogOf(workspaceYaml) {
  const names = [];
  let inCatalog = false;
  for (const line of workspaceYaml.split("\n")) {
    if (/^\S/.test(line)) inCatalog = line.trimEnd() === "catalog:";
    else if (inCatalog) {
      const name = line.match(/^\s+["']?([^"':#\s][^"':]*)["']?\s*:/)?.[1];
      if (name) names.push(name);
    }
  }
  return names;
}

/** Every dependency on a default-catalog name that a manifest pins by hand. */
export function findOffCatalogVersions(catalog, manifests) {
  const names = new Set(catalog);
  return manifests.flatMap(({ path, text }) => {
    const manifest = JSON.parse(text);
    return DEPENDENCY_FIELDS.flatMap((field) =>
      Object.entries(manifest[field] ?? {})
        .filter(([name, spec]) => names.has(name) && !CATALOG_SPECS.has(spec))
        .map(([name, spec]) => ({ path, name, spec })),
    );
  });
}

const committedManifests = () =>
  execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter((path) => /(^|\/)package\.json$/.test(path) && !path.includes("node_modules/"))
    .map((path) => ({ path, text: readFileSync(path, "utf8") }));

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const catalog = defaultCatalogOf(readFileSync("pnpm-workspace.yaml", "utf8"));
  const findings = findOffCatalogVersions(catalog, committedManifests());
  for (const { path, name, spec } of findings) {
    console.error(`${path}: "${name}": "${spec}" pins a catalog dependency by hand; use "catalog:"`);
  }
  if (findings.length > 0) process.exit(1);
  console.log(`every package takes ${catalog.join(", ")} from the catalog`);
}
