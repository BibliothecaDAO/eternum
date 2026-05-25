import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

function readRuntimeSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap-post-commit-manager-catchup-runtime.ts"), "utf8");
}

describe("worldmap manager drain throughput wiring", () => {
  it("uses the multi-task budgeted drain in the production post-commit path", () => {
    const worldmapSource = readWorldmapSource();
    const runtimeSource = readRuntimeSource();

    expect(worldmapSource).toMatch(/drainWorldmapPostCommitManagerCatchUpQueue\(/);
    expect(runtimeSource).toMatch(/drainMultiBudgetedDeferredManagerCatchUpQueue\(/);
    expect(runtimeSource).not.toMatch(/drainBudgetedDeferredManagerCatchUpQueue\(/);
  });
});
