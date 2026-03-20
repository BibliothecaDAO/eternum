import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

function extractDrainMethod(source: string): string {
  const start = source.indexOf("  private drainPostCommitManagerCatchUpQueue(): void {");
  const end = source.indexOf("  private clearStreamingWorkState(): void {", start);
  return source.slice(start, end);
}

describe("worldmap manager drain throughput wiring", () => {
  it("uses the multi-task budgeted drain in the production post-commit path", () => {
    const methodSource = extractDrainMethod(readWorldmapSource());

    expect(methodSource).toMatch(/drainMultiBudgetedDeferredManagerCatchUpQueue\(/);
    expect(methodSource).not.toMatch(/drainBudgetedDeferredManagerCatchUpQueue\(/);
  });
});
