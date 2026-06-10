import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, filename), "utf8");
}

describe("Worldmap stale-position filter wiring", () => {
  it("consults armyManager.shouldSkipStalePositionUpdate before updateArmyHexes in onTileUpdate", () => {
    const source = readSource("worldmap.tsx");

    const onTileStart = source.indexOf("this.worldUpdateListener.Army.onTileUpdate(async");
    expect(onTileStart).toBeGreaterThan(0);
    const nextSubStart = source.indexOf("this.addWorldUpdateSubscription(", onTileStart + 100);
    const body = source.slice(onTileStart, nextSubStart);

    const skipPos = body.indexOf("this.armyManager.shouldSkipStalePositionUpdate");
    const updatePos = body.indexOf("this.updateArmyHexes(update)");

    expect(skipPos).toBeGreaterThan(-1);
    expect(updatePos).toBeGreaterThan(-1);
    expect(skipPos).toBeLessThan(updatePos);
  });

  it("passes shouldSkipStalePositionUpdate into processExplorerTroopsUpdate", () => {
    const source = readSource("worldmap.tsx");

    const callStart = source.indexOf("processExplorerTroopsUpdate(update, {");
    expect(callStart).toBeGreaterThan(0);
    const callEnd = source.indexOf("});", callStart);
    const body = source.slice(callStart, callEnd);

    expect(body).toContain("shouldSkipStalePositionUpdate:");
    expect(body).toContain("this.armyManager.shouldSkipStalePositionUpdate");
  });
});
