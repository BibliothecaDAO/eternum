// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

const extractRecoverMethod = (source: string): string => {
  const start = source.indexOf("recoverChunkUpdateAfterStall(input: RecoverManagerChunkRuntimeAfterStallInput)");
  expect(start).toBeGreaterThan(-1);
  // The recovery method is short; grab the next ~25 lines.
  const slice = source.slice(start, start + 1200);
  const end = slice.indexOf("\n  }\n");
  return slice.slice(0, end + 4);
};

describe("ArmyManager.recoverChunkUpdateAfterStall side-effect gating", () => {
  const source = readSource("src/three/managers/army-manager.ts");
  const method = extractRecoverMethod(source);

  it("gates isArmyChunkTransitioning, drainDeferredArmyQueue, drainPreCommitArmyQueue on the recovery's didApply", () => {
    expect(method).toMatch(/didApply/);
    expect(method).not.toMatch(
      /recoverManagerChunkRuntimeAfterStall\([^)]*\);\s*\n\s*this\.isArmyChunkTransitioning\s*=\s*false/,
    );
  });
});

describe("StructureManager.recoverChunkUpdateAfterStall side-effect gating", () => {
  const source = readSource("src/three/managers/structure-manager.ts");
  const method = extractRecoverMethod(source);

  it("gates isUpdatingVisibleStructures and fence invalidation on the recovery's didApply", () => {
    expect(method).toMatch(/didApply/);
    expect(method).not.toMatch(
      /recoverManagerChunkRuntimeAfterStall\([^)]*\);\s*\n\s*this\.isUpdatingVisibleStructures\s*=\s*false/,
    );
  });
});
