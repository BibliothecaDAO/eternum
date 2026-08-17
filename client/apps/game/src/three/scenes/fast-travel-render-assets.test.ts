import { ShapeGeometry } from "three";
import { describe, expect, it, vi } from "vitest";

import { createFastTravelRenderAssets } from "./fast-travel-render-assets";
import { createFastTravelSurfacePalette } from "./fast-travel-surface-material";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

describe("fast-travel render assets", () => {
  it("bakes the visible hex field into one line object", () => {
    const assets = createFastTravelRenderAssets();
    assets.syncPalette(createFastTravelSurfacePalette());

    const hexField = assets.createHexFieldMesh([
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ]);
    const firstArmyMarker = assets.createArmyMarkerMesh();
    const secondArmyMarker = assets.createArmyMarkerMesh();

    expect(hexField.geometry.getAttribute("position").count).toBe(
      assets.hexEdgeGeometry.getAttribute("position").count * 2,
    );
    expect(hexField.material).toBe(assets.hexEdgeMaterial);
    expect(firstArmyMarker.geometry).toBe(secondArmyMarker.geometry);
    expect(firstArmyMarker.material).toBe(secondArmyMarker.material);

    hexField.geometry.dispose();
    assets.dispose();
  });

  it("disposes temporary and shared resources deterministically", () => {
    const tempGeometryDisposeSpy = vi.spyOn(ShapeGeometry.prototype, "dispose");
    const assets = createFastTravelRenderAssets();
    const edgeGeometryDisposeSpy = vi.spyOn(assets.hexEdgeGeometry, "dispose");
    const edgeMaterialDisposeSpy = vi.spyOn(assets.hexEdgeMaterial, "dispose");
    const armyGeometryDisposeSpy = vi.spyOn(assets.armyGeometry, "dispose");
    const armyMaterialDisposeSpy = vi.spyOn(assets.armyMaterial, "dispose");

    assets.dispose();

    expect(tempGeometryDisposeSpy).toHaveBeenCalled();
    expect(edgeGeometryDisposeSpy).toHaveBeenCalledTimes(1);
    expect(edgeMaterialDisposeSpy).toHaveBeenCalledTimes(1);
    expect(armyGeometryDisposeSpy).toHaveBeenCalledTimes(1);
    expect(armyMaterialDisposeSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps scene-level render asset ownership stable across refreshes", () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(resolve(currentDir, "fast-travel.ts"), "utf8");

    expect(source.match(/createFastTravelRenderAssets\(\)/g)).toHaveLength(1);
  });
});
