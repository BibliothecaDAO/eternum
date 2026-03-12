import { ShapeGeometry } from "three";
import { describe, expect, it, vi } from "vitest";

import { createFastTravelRenderAssets } from "./fast-travel-render-assets";

describe("fast-travel render assets", () => {
  it("reuses shared geometries and materials across repeated mesh creation", () => {
    const assets = createFastTravelRenderAssets();
    assets.syncPalette({
      backgroundColor: "#000000",
      edgeColor: "#ff4fd8",
      edgeOpacity: 0.92,
      accentColor: "#ffd6f7",
      glowColor: "#ff92ea",
    });

    const firstHexEdge = assets.createHexEdgeMesh();
    const secondHexEdge = assets.createHexEdgeMesh();
    const firstArmyMarker = assets.createArmyMarkerMesh();
    const secondArmyMarker = assets.createArmyMarkerMesh();

    expect(firstHexEdge.geometry).toBe(secondHexEdge.geometry);
    expect(firstHexEdge.material).toBe(secondHexEdge.material);
    expect(firstArmyMarker.geometry).toBe(secondArmyMarker.geometry);
    expect(firstArmyMarker.material).toBe(secondArmyMarker.material);

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
});
