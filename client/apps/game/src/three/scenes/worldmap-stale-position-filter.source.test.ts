import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const readManager = () => readFileSync(resolve(currentDir, "../managers/army-manager.ts"), "utf8");
const readProjection = () =>
  readFileSync(resolve(currentDir, "../../../../../../packages/core/src/sync/world-spatial-projection.ts"), "utf8");

describe("projected army stale-position filter", () => {
  it("checks the optimistic lock before applying a projected move", () => {
    const source = readManager();
    const methodStart = source.indexOf("private async ensureArmyPresentation(");
    const methodEnd = source.indexOf("private buildProjectedArmyPresentation(", methodStart);
    const body = source.slice(methodStart, methodEnd);
    const staleCheck = body.indexOf("this.shouldSkipStalePositionUpdate");
    const move = body.indexOf("await this.moveArmy");

    expect(staleCheck).toBeGreaterThan(-1);
    expect(move).toBeGreaterThan(staleCheck);
  });

  it("rejects alternate-layer and empty ExplorerTroops rows at the projection boundary", () => {
    const source = readProjection();
    const resolverStart = source.indexOf("const resolveArmyRenderable");
    const resolverEnd = source.indexOf("class SpatialIndex", resolverStart);
    const resolver = source.slice(resolverStart, resolverEnd);

    expect(resolver).toContain("explorerTroops.coord.alt");
    expect(resolver).toContain("explorerTroops.troops.count <= 0n");
  });
});
