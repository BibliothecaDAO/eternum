import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { root } from "./settings";

/**
 * A deploy command must reach its own preconditions on a checkout whose workspace packages are not built yet: CI runs
 * `season` on an empty directory before `build:packages`, and an owner runs every command from a fresh export. So the
 * static import graph of each command's entry may load only source files and installed dependencies, never a workspace
 * package that resolves to its build output. Type-only imports are erased and dynamic imports run after the
 * preconditions, so neither counts.
 */
// Each command's own module: owner-command.ts only dispatches to main.ts (setup) and season.ts, whose static graphs load
// before their preconditions run.
const ENTRIES = ["owner-command.ts", "main.ts", "season.ts", "deploy.ts", "cloudflare.ts", "teardown.ts"];
const SOURCE = [".ts", ".tsx", ".js", ".mjs"];

/** Every workspace package by name: its directory and its export map. */
const workspacePackages = () => {
  const packages = new Map<string, { directory: string; exports: Record<string, unknown> }>();
  for (const group of ["packages", "apps"])
    for (const name of readdirSync(join(root, group))) {
      const manifest = join(root, group, name, "package.json");
      if (!existsSync(manifest)) continue;
      const { name: id, exports, main } = JSON.parse(readFileSync(manifest, "utf8"));
      if (id) packages.set(id, { directory: join(root, group, name), exports: exports ?? { ".": main ?? "" } });
    }
  return packages;
};

/** The file an export map entry names for this runtime, as bun picks it. */
const exportTarget = (entry: unknown): string | null => {
  if (typeof entry === "string") return entry;
  if (!entry || typeof entry !== "object") return null;
  const conditions = entry as Record<string, unknown>;
  for (const condition of ["bun", "import", "default", "require"])
    if (condition in conditions) return exportTarget(conditions[condition]);
  return null;
};

const sourceFile = (base: string): string | null => {
  for (const candidate of [
    base,
    ...SOURCE.map((extension) => base + extension),
    ...SOURCE.map((e) => join(base, `index${e}`)),
  ])
    if (existsSync(candidate) && SOURCE.some((extension) => candidate.endsWith(extension))) return candidate;
  const stem = base.replace(/\.(m?js)$/, "");
  return stem !== base ? sourceFile(stem) : null;
};

/** The value imports a file makes: `import type` and `export type` are erased, dynamic imports run later. */
const valueImports = (file: string): string[] => {
  const text = readFileSync(file, "utf8");
  const statements =
    text.match(/^\s*(?:import|export)\s[^;]*?from\s*["'][^"']+["']|^\s*import\s*["'][^"']+["']/gm) ?? [];
  return statements
    .filter((statement) => !/^\s*(?:import|export)\s+type\s/.test(statement))
    .map((statement) => /["']([^"']+)["']\s*$/.exec(statement)![1]!);
};

/** Each import on the entry's static graph that needs a build, as "importer -> specifier (target)". */
const unbuiltImports = (entry: string) => {
  const packages = workspacePackages();
  const pending = [entry];
  const seen = new Set(pending);
  const found: string[] = [];
  while (pending.length) {
    const file = pending.pop()!;
    for (const specifier of valueImports(file)) {
      let target: string | null = null;
      if (specifier.startsWith(".")) target = sourceFile(normalize(join(dirname(file), specifier)));
      else {
        const name = specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0]!;
        const workspace = packages.get(name);
        if (!workspace) continue; // An installed dependency: present before any build.
        const subpath = `.${specifier.slice(name.length)}` || ".";
        const named = exportTarget(workspace.exports[subpath === "." ? "." : subpath]);
        if (!named || /(^|\/)dist\//.test(named)) {
          found.push(`${relative(root, file)} -> ${specifier} (${named ?? "no source export"})`);
          continue;
        }
        target = sourceFile(join(workspace.directory, named));
      }
      if (target && !seen.has(target)) {
        seen.add(target);
        pending.push(target);
      }
    }
  }
  return found;
};

test.each(ENTRIES)("%s starts without built workspace packages", (entry) => {
  expect(unbuiltImports(join(root, "deploy/first", entry))).toEqual([]);
});
