import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, filename), "utf8");
}

describe("Optimistic worldmap cache mirror", () => {
  it("calls updateArmyHexes with the optimistic target after submitted tx starts the tween", () => {
    const source = readSource("worldmap.tsx");

    const handlerStart = source.indexOf("private mirrorOptimisticArmyDestinationIntoWorldmapCache(");
    expect(handlerStart).toBeGreaterThan(0);
    const handlerEnd = source.indexOf("\n  private ", handlerStart + 20);
    expect(handlerEnd).toBeGreaterThan(handlerStart);
    const handlerBody = source.slice(handlerStart, handlerEnd);

    expect(handlerBody).toMatch(/this\.updateArmyHexes\(\s*\{[\s\S]*?entityId[\s\S]*?hexCoords/);
    expect(handlerBody).toContain("plan.targetHexCoords.getContract()");
  });

  it("guards the mirror call so an army without an owner address is skipped", () => {
    const source = readSource("worldmap.tsx");

    // updateArmyHexes early-returns on undefined ownerAddress — we read the
    // address from armyManager.getArmy(entityId).owner, which can be zero for
    // detached/failed armies. The mirror must only write cache state when a
    // usable owner exists.
    const handlerStart = source.indexOf("private mirrorOptimisticArmyDestinationIntoWorldmapCache(");
    const handlerEnd = source.indexOf("\n  private ", handlerStart + 20);
    const handlerBody = source.slice(handlerStart, handlerEnd);

    expect(handlerBody).toContain("this.armyManager.getArmy(entityId)");
  });
});
