import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSceneSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("worldmap post-commit budgeting wiring", () => {
  it("routes deferred manager catch-up through the budgeted post-commit queue", () => {
    const worldmapSource = readSceneSource("./worldmap.tsx");

    expect(worldmapSource).toMatch(/drainBudgetedDeferredManagerCatchUpQueue\(/);
    expect(worldmapSource).toMatch(/resolveWorldmapPostCommitWorkAction\(/);
  });
});
