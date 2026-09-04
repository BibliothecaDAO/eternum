// @vitest-environment node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Entity-key hashing goes through ONE memoized chokepoint:
 * packages/core/src/managers/game-entity-keys.ts. The raw
 * @dojoengine/utils getEntityIdFromKeys recomputes a poseidon hash on every
 * call, which dominated live main-thread profiles (~25% of scripting time)
 * before memoization. Import the core re-export instead.
 */
const CHOKEPOINT = "packages/core/src/managers/game-entity-keys.ts";
const SCANNED_ROOTS = ["apps/game/src", "packages/core/src", "packages/provider/src"];

const CLIENT_ROOT = process.cwd();
const REPO_ROOT = resolve(CLIENT_ROOT, "../..");
const FORBIDDEN_IMPORT = /getEntityIdFromKeys[^;]*from\s+"@dojoengine\/utils"/;

const isSourceFile = (name: string) =>
  (name.endsWith(".ts") || name.endsWith(".tsx")) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx");

const walk = (dir: string, files: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === "assets") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (isSourceFile(entry)) files.push(path);
  }
  return files;
};

describe("entity-key memoization chokepoint", () => {
  it("forbids the un-memoized dojo getEntityIdFromKeys outside the chokepoint", () => {
    const offenders: string[] = [];
    for (const root of SCANNED_ROOTS) {
      for (const file of walk(join(REPO_ROOT, root))) {
        const relativePath = relative(REPO_ROOT, file);
        if (relativePath === CHOKEPOINT) continue;
        if (FORBIDDEN_IMPORT.test(readFileSync(file, "utf8"))) offenders.push(relativePath);
      }
    }
    expect(offenders, "import getEntityIdFromKeys from the memoized core chokepoint instead").toEqual([]);
  });

  it("keeps the chokepoint memoized around the dojo implementation", () => {
    const source = readFileSync(join(REPO_ROOT, CHOKEPOINT), "utf8");
    expect(source).toContain('getEntityIdFromKeys as dojoGetEntityIdFromKeys } from "@dojoengine/utils"');
    expect(source).toContain("entityIdCache");
  });
});
