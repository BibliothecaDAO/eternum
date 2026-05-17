import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("worldmap layer filter wiring", () => {
  it("skips ethereal tile updates before mutating world-layer army state", () => {
    const src = readSource("worldmap.tsx");

    const listenerStart = src.indexOf(
      "this.worldUpdateListener.Army.onTileUpdate(async (update: ExplorerTroopsTileSystemUpdate) => {",
    );
    expect(listenerStart).toBeGreaterThan(-1);

    const listenerBody = src.slice(listenerStart, listenerStart + 900);
    expect(listenerBody).toContain("if (!this.isWorldLayerArmyUpdate(update))");
    expect(listenerBody).toContain("return;");
    expect(listenerBody.indexOf("if (!this.isWorldLayerArmyUpdate(update))")).toBeLessThan(
      listenerBody.indexOf("this.incrementToriiBoundsCounter"),
    );
  });

  it("passes the layer gate into processExplorerTroopsUpdate", () => {
    const src = readSource("worldmap.tsx");

    const callStart = src.indexOf("processExplorerTroopsUpdate(update, {");
    expect(callStart).toBeGreaterThan(-1);

    const callEnd = src.indexOf("});", callStart);
    const callBody = src.slice(callStart, callEnd);

    expect(callBody).toContain("shouldProcessLayerUpdate:");
    expect(callBody).toContain("this.isWorldLayerArmyUpdate");
  });

  it("skips ethereal tile updates before mutating world-layer terrain", () => {
    const src = readSource("worldmap.tsx");

    const listenerStart = src.indexOf("this.worldUpdateListener.Tile.onTileUpdate((value) => {");
    expect(listenerStart).toBeGreaterThan(-1);

    const listenerBody = src.slice(listenerStart, listenerStart + 500);
    expect(listenerBody).toContain("if (!this.isWorldLayerTileUpdate(value))");
    expect(listenerBody).toContain("return;");
    expect(listenerBody.indexOf("if (!this.isWorldLayerTileUpdate(value))")).toBeLessThan(
      listenerBody.indexOf("this.incrementToriiBoundsCounter"),
    );
  });

  it("skips ethereal chest updates before mutating world-layer chest state", () => {
    const src = readSource("worldmap.tsx");

    const listenerStart = src.indexOf("this.worldUpdateListener.Chest.onTileUpdate((update: ChestSystemUpdate) => {");
    expect(listenerStart).toBeGreaterThan(-1);

    const listenerBody = src.slice(listenerStart, listenerStart + 500);
    expect(listenerBody).toContain("if (!this.isWorldLayerTileUpdate(update))");
    expect(listenerBody).toContain("return;");
    expect(listenerBody.indexOf("if (!this.isWorldLayerTileUpdate(update))")).toBeLessThan(
      listenerBody.indexOf("this.updateChestHexes"),
    );
  });

  it("skips ethereal dead chest updates before deleting world-layer chest state", () => {
    const src = readSource("worldmap.tsx");

    const listenerStart = src.indexOf("this.worldUpdateListener.Chest.onDeadChest((rawUpdate) => {");
    expect(listenerStart).toBeGreaterThan(-1);

    const listenerBody = src.slice(listenerStart, listenerStart + 500);
    expect(listenerBody).toContain("const update = rawUpdate as unknown as ChestRemovalSystemUpdate;");
    expect(listenerBody).toContain("if (!this.isWorldLayerTileUpdate(update))");
    expect(listenerBody).toContain("return;");
    expect(listenerBody.indexOf("if (!this.isWorldLayerTileUpdate(update))")).toBeLessThan(
      listenerBody.indexOf("this.deleteChest(update.entityId)"),
    );
  });

  it("skips ethereal structure tile updates before mutating world-layer structure state", () => {
    const src = readSource("worldmap.tsx");

    const listenerStart = src.indexOf("this.worldUpdateListener.Structure.onTileUpdate(async (value) => {");
    expect(listenerStart).toBeGreaterThan(-1);

    const listenerBody = src.slice(listenerStart, listenerStart + 700);
    expect(listenerBody).toContain("if (!this.isWorldLayerTileUpdate(value))");
    expect(listenerBody).toContain("return;");
    expect(listenerBody.indexOf("if (!this.isWorldLayerTileUpdate(value))")).toBeLessThan(
      listenerBody.indexOf("this.updateStructureHexes"),
    );
  });

  it("ignores ethereal TileOpt records when hydrating world-layer terrain from RECS", () => {
    const src = readSource("worldmap.tsx");

    const methodStart = src.indexOf("private hydrateExploredTilesFromTileOptRecs(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodEnd = src.indexOf("private isPositionWithinBounds(", methodStart);
    expect(methodEnd).toBeGreaterThan(methodStart);

    const methodBody = src.slice(methodStart, methodEnd);
    expect(methodBody).toContain("if (tile.alt === true)");
    expect(methodBody.indexOf("if (tile.alt === true)")).toBeLessThan(
      methodBody.indexOf("const normalized = new Position"),
    );
  });
});
