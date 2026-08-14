import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const readWorldmap = () => readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");

describe("optimistic worldmap position overlay", () => {
  it("resolves a valid pending target before authoritative projection position", () => {
    const source = readWorldmap();
    const methodStart = source.indexOf("private getArmyDisplayPosition(");
    const methodEnd = source.indexOf("private getArmyAtHex(", methodStart);
    const body = source.slice(methodStart, methodEnd);
    const pending = body.indexOf("this.getValidPendingArmyMovementTarget(entityId)");
    const projection = body.indexOf("this.worldSpatialProjection.getArmy(entityId)");

    expect(pending).toBeGreaterThan(-1);
    expect(projection).toBeGreaterThan(pending);
  });

  it("enforces pending movement TTL at the accessor boundary", () => {
    const source = readWorldmap();
    const methodStart = source.indexOf("private getValidPendingArmyMovementTarget(");
    const methodEnd = source.indexOf("private getStructureOwnerAddress(", methodStart);
    const body = source.slice(methodStart, methodEnd);

    expect(body).toContain("Date.now() - movement.startedAt > this.authoritativePendingArmyMovementMs");
    expect(source).not.toContain("mirrorOptimisticArmyDestinationIntoWorldmapCache");
    expect(source).not.toContain("updateArmyHexes(");
  });
});
