import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(fileURLToPath(new URL("./hexagon-map.ts", import.meta.url)), "utf8");

describe("HexagonMap layer update routing", () => {
  it("filters ethereal Tile, Army, Structure, and Chest updates before they reach world-layer managers", () => {
    expect(source).toContain("this.systemManager.Tile.onTileUpdate((update) => {");
    expect(source).toContain("this.systemManager.Army.onTileUpdate((update) => {");
    expect(source).toContain("this.systemManager.Structure.onTileUpdate((update) => {");
    expect(source).toContain("this.systemManager.Chest.onTileUpdate((update) => {");

    expect(source.match(/isWorldLayerUpdate\(update\)/g)).toHaveLength(5);
  });

  it("unwraps chest removal payloads before deleting from the mobile chest manager", () => {
    expect(source).toContain("this.systemManager.Chest.onDeadChest((rawUpdate) => {");
    expect(source).toContain("const update = normalizeChestRemovalUpdate(rawUpdate");
    expect(source).toContain("this.chestManager.deleteChest(update.entityId)");
  });
});
