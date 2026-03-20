import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("StructureManager deferred bounds", () => {
  it("setChunkBounds does not propagate worldBounds to instanced models directly", () => {
    const source = readSource("./structure-manager.ts");

    // Extract the setChunkBounds method body
    const setChunkBoundsMatch = source.match(
      /public setChunkBounds\([^)]*\)\s*\{([\s\S]*?)\n  \}/,
    );
    expect(setChunkBoundsMatch).not.toBeNull();
    const methodBody = setChunkBoundsMatch![1];

    // setChunkBounds should NOT call setWorldBounds on models — that causes ghosting
    // when bounds update before instance data is rebuilt
    expect(methodBody).not.toContain("setWorldBounds");
  });

  it("performVisibleStructuresUpdate applies pending model world bounds after instance rebuild", () => {
    const source = readSource("./structure-manager.ts");

    // applyPendingModelBounds must appear AFTER the batch setCount loop
    // and BEFORE recordWorldmapRenderDuration (end of method)
    const setCountIdx = source.indexOf("model.setCount(count)");
    const applyBoundsIdx = source.indexOf("this.applyPendingModelBounds()");
    const recordDurationIdx = source.indexOf('recordWorldmapRenderDuration("performVisibleStructuresUpdate"');

    expect(setCountIdx).toBeGreaterThan(-1);
    expect(applyBoundsIdx).toBeGreaterThan(-1);
    expect(recordDurationIdx).toBeGreaterThan(-1);

    // Ordering: setCount → applyPendingModelBounds → recordDuration
    expect(applyBoundsIdx).toBeGreaterThan(setCountIdx);
    expect(applyBoundsIdx).toBeLessThan(recordDurationIdx);
  });
});
