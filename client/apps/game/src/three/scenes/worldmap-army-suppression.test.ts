import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("worldmap army suppression integration", () => {
  it("cancelPendingArmyRemoval calls unsuppressArmy", () => {
    const src = readSource("worldmap.tsx");

    const methodStart = src.indexOf("private cancelPendingArmyRemoval(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = src.slice(methodStart, methodStart + 900);
    expect(methodBody).toContain("unsuppressArmy(entityId)");
  });

  it("cancelPendingArmyRemoval handles deferred removals that no longer have a timeout handle", () => {
    const src = readSource("worldmap.tsx");

    const methodStart = src.indexOf("private cancelPendingArmyRemoval(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = src.slice(methodStart, methodStart + 800);
    expect(methodBody).toContain("this.deferredChunkRemovals.has(entityId)");
  });

  it("cancelPendingArmyRemoval attempts immediate army visual recovery", () => {
    const src = readSource("worldmap.tsx");

    const methodStart = src.indexOf("private cancelPendingArmyRemoval(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = src.slice(methodStart, methodStart + 900);
    expect(methodBody).toContain("restoreArmyVisualIfVisible(entityId)");
  });
});
