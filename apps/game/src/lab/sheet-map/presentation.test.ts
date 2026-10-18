import { describe, expect, it } from "vitest";
import { Color, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene } from "three";
import { HUD_SHEET, MAP_SHEET, hudVariables, mapAgeAccent } from "@/tokens";
import type { ProceduralTerrain } from "@/three/terrain/procedural-terrain";
import { MapSheetPresentation } from "./presentation";
import { createMapSheetFixture } from "./fixture";

describe("map sheet comparison", () => {
  it("draws HUD ownership on sampled terrain, with contrast casings, and releases its scene and labels", () => {
    const terrain = { sampleSurface: () => ({ height: 0.7 }) } as unknown as ProceduralTerrain;
    const scene = new Scene(),
      overlay = document.createElement("div");
    const presentation = new MapSheetPresentation(scene, terrain, "ownership", overlay);
    const casedColours = new Set<number>();
    const colours = new Set<number>(),
      casedHeights: number[] = [];
    scene.traverse((object) => {
      if (!(object instanceof Mesh) || !(object.material instanceof MeshBasicMaterial)) return;
      colours.add(object.material.color.getHex());
      if (object.material.vertexColors) {
        const colour = object.geometry.getAttribute("color");
        expect(colour, "Cased rings retain their vertex colours after draping").toBeDefined();
        if (colour)
          for (let i = 0; i < colour.count; i++) casedColours.add(new Color().fromBufferAttribute(colour, i).getHex());
        const position = object.geometry.getAttribute("position");
        for (let i = 0; i < position.count; i++) casedHeights.push(position.getY(i));
      }
    });
    for (const role of [HUD_SHEET.own, HUD_SHEET.ally, HUD_SHEET.enemy, HUD_SHEET.neutral]) {
      expect(colours.has(new Color(role).getHex()), role).toBe(true);
    }
    for (const role of [MAP_SHEET.casing, HUD_SHEET.own, HUD_SHEET.ally, HUD_SHEET.enemy, HUD_SHEET.neutral]) {
      expect(casedColours.has(new Color(role).getHex()), role).toBe(true);
    }
    expect(MAP_SHEET.ownership.unowned).toBe(HUD_SHEET.neutral);
    expect(hudVariables()).toMatchObject({
      "--hud-map-explored": "rgb(var(--hud-ink) / 0.1)",
      "--hud-map-fog": "var(--hud-well)",
    });
    expect(casedHeights.length).toBeGreaterThan(100);
    expect(casedHeights.every((height) => Math.abs(height - 0.77) < 0.00001)).toBe(true);
    expect(overlay.querySelectorAll(".map-sheet-label")).toHaveLength(24);
    const camera = new PerspectiveCamera(36, 2, 0.1, 300);
    presentation.frame(camera, 2);
    camera.updateMatrixWorld();
    presentation.update(0.016, camera, 1920, 960);
    expect(overlay.querySelector<HTMLSpanElement>("span")!.style.transform).toMatch(/^translate\(/);
    presentation.dispose();
    expect(scene.children).toHaveLength(0);
    expect(overlay.children).toHaveLength(0);
  });

  it("keeps each age's fixture biomes and exploration identical to Today", () => {
    const fixture = createMapSheetFixture("sites");
    const strip = (index: number) =>
      fixture.cells
        .filter(({ col }) => Math.floor(col / 8) === index)
        .map(({ col, ...cell }) => ({ ...cell, col: col - index * 8 }));
    for (const index of [1, 2, 3]) expect(strip(index)).toEqual(strip(0));
    expect(strip(0).some(({ explored }) => !explored)).toBe(true);
    expect(strip(0).some(({ explored }) => explored)).toBe(true);
    expect([mapAgeAccent("blitz"), mapAgeAccent("frontier"), mapAgeAccent("eternum")]).toEqual([
      "#e8a65a",
      "#b49cf0",
      "#e6c27a",
    ]);
  });
});
