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
});
