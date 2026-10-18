import { expect, it } from "vitest";
import { Mesh, MeshBasicMaterial, Scene } from "three";
import { MAP_SHEET } from "@/tokens";
import type { ProceduralTerrain } from "@/three/terrain/procedural-terrain";
import { MapSheetPresentation } from "./presentation";

function proposedRings() {
  const scene = new Scene();
  const view = new MapSheetPresentation(
    scene,
    { sampleSurface: () => ({ height: 0 }) } as unknown as ProceduralTerrain,
    "ownership",
    document.createElement("div"),
  );
  const rings: { positions: number[]; opacity: number }[] = [];
  try {
    scene.traverse((object) => {
      if (!(object instanceof Mesh) || !(object.material instanceof MeshBasicMaterial) || !object.material.vertexColors)
        return;
      rings.push({
        positions: Array.from(object.geometry.getAttribute("position").array),
        opacity: object.material.opacity,
      });
    });
    return rings;
  } finally {
    view.dispose();
  }
}

it.each([
  ["outerRadius", 1.2],
  ["innerRadius", 0.8],
  ["casingWidth", 0.04],
  ["opacity", 0.5],
] as const)("changing ring.%s changes the proposed ownership specimen", (token, value) => {
  const ring = MAP_SHEET.ring as { -readonly [Key in keyof typeof MAP_SHEET.ring]: number };
  const original = ring[token];
  const before = proposedRings();
  try {
    ring[token] = value;
    const after = proposedRings();
    expect(before).toHaveLength(21);
    expect(after).toHaveLength(21);
    expect(after).not.toEqual(before);
    expect(after[0].opacity).toBe(ring.opacity);

    const positions = after[0].positions;
    const xs = positions.filter((_, i) => i % 3 === 0);
    const zs = positions.filter((_, i) => i % 3 === 2);
    const centreX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centreZ = (Math.min(...zs) + Math.max(...zs)) / 2;
    const radii = [...new Set(xs.map((x, i) => Math.hypot(x - centreX, zs[i] - centreZ).toFixed(5)))].sort();
    expect(radii).toHaveLength(4);
    const expected = [
      ring.innerRadius - ring.casingWidth,
      ring.innerRadius,
      ring.outerRadius,
      ring.outerRadius + ring.casingWidth,
    ].sort();
    radii.forEach((radius, i) => expect(Number(radius)).toBeCloseTo(expected[i], 4));
  } finally {
    ring[token] = original;
  }
});
