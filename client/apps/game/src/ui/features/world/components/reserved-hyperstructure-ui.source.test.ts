// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Reserved hyperstructure client wiring", () => {
  it("treats reserved hyperstructures as occupied tiles in entity and panel flows", () => {
    const selectedWorldmapEntitySource = readSource(
      "src/ui/features/world/components/actions/selected-worldmap-entity.tsx",
    );
    const bottomRightPanelSource = readSource(
      "src/ui/features/world/components/bottom-right-panel/bottom-right-panel.tsx",
    );

    expect(selectedWorldmapEntitySource).toContain(
      "const hasOccupier = !!tile && hasTileOccupier(tile.occupier_type);",
    );
    expect(selectedWorldmapEntitySource).toContain(
      "const isReservedHyperstructure = isTileOccupierReservedHyperstructure(occupierType);",
    );
    expect(selectedWorldmapEntitySource).toContain("Unconstructed Hyperstructure");
    expect(selectedWorldmapEntitySource).toContain("Double-click it on the map or press Create Here");
    expect(selectedWorldmapEntitySource).toContain("Create Here");
    expect(selectedWorldmapEntitySource).toContain("useBlitzHyperstructureCreation");

    expect(bottomRightPanelSource).toContain("return hasTileOccupier(tile.occupier_type);");
    expect(bottomRightPanelSource).toContain('if (isReservedHyperstructure) return "Unconstructed Hyperstructure";');
  });

  it("gives reserved hyperstructures dedicated minimap occupancy handling", () => {
    const minimapSource = readSource("src/ui/features/world/components/bottom-right-panel/hex-minimap.tsx");

    expect(minimapSource).toContain("if (!hasTileOccupier(type)) return null;");
    expect(minimapSource).toContain(
      'if (isTileOccupierReservedHyperstructure(type as TileOccupier)) return "#fbbf24";',
    );
    expect(minimapSource).toContain("sizeMultiplier: info.reserved ? 1.05 : 1.1");
  });
});
