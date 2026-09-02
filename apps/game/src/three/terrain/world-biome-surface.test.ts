import { BiomeType } from "@bibliothecadao/types";
import { Color, InstancedMesh, type Material, Mesh, MeshBasicMaterial, type PlaneGeometry, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { terrainHexCorners, terrainHexToWorld } from "./terrain-coordinates";
import { TERRAIN_DEEP_FOG_COLOR } from "./terrain-fog-style";
import { TERRAIN_BIOME_DESCRIPTORS } from "./terrain-palette";
import {
  WORLD_BIOME_SHROUD_HEIGHT,
  WORLD_BIOME_SHROUD_MARGIN_HEXES,
  WORLD_BIOME_SURFACE_CAPACITY,
  WORLD_BIOME_SURFACE_HEIGHT,
  WorldBiomeSurface,
} from "./world-biome-surface";

describe("WorldBiomeSurface", () => {
  it("places each tile's flat hex where the detailed pages place the hex", () => {
    const surface = new WorldBiomeSurface();
    surface.setTile(3, 5, BiomeType.Grassland);
    surface.setTile(-4, -7, BiomeType.Ocean);
    surface.commit();

    expect(slotPosition(surface, 0)).toEqual(expectedPosition(3, 5));
    expect(slotPosition(surface, 1)).toEqual(expectedPosition(-4, -7));
    expect(hexMesh(surface).count).toBe(2);
    surface.dispose();
  });

  it("colours each hex with its biome's palette ground colour", () => {
    const surface = new WorldBiomeSurface();
    surface.setTile(0, 0, BiomeType.Grassland);
    surface.setTile(1, 0, BiomeType.DeepOcean);
    surface.commit();

    expect(slotColor(surface, 0)).toEqual(paletteColor(BiomeType.Grassland));
    expect(slotColor(surface, 1)).toEqual(paletteColor(BiomeType.DeepOcean));
    surface.dispose();
  });

  it("recolours a tile in place when its biome changes", () => {
    const surface = new WorldBiomeSurface();
    surface.setTile(0, 0, BiomeType.Grassland);
    surface.setTile(0, 0, BiomeType.Snow);
    surface.commit();

    expect(surface.metrics.instanceCount).toBe(1);
    expect(slotColor(surface, 0)).toEqual(paletteColor(BiomeType.Snow));
    surface.dispose();
  });

  it("removes a tile by swapping the last slot into its place", () => {
    const surface = new WorldBiomeSurface();
    surface.setTile(0, 0, BiomeType.Grassland);
    surface.setTile(1, 0, BiomeType.Ocean);
    surface.setTile(2, 0, BiomeType.Snow);
    surface.setTile(0, 0, null);
    surface.commit();

    expect(hexMesh(surface).count).toBe(2);
    expect(slotPosition(surface, 0)).toEqual(expectedPosition(2, 0));
    expect(slotColor(surface, 0)).toEqual(paletteColor(BiomeType.Snow));
    expect(slotPosition(surface, 1)).toEqual(expectedPosition(1, 0));

    surface.setTile(2, 0, null);
    surface.commit();
    expect(hexMesh(surface).count).toBe(1);
    expect(slotPosition(surface, 0)).toEqual(expectedPosition(1, 0));
    surface.dispose();
  });

  it("ignores removal of a tile it never held", () => {
    const surface = new WorldBiomeSurface();
    surface.setTile(9, 9, null);
    surface.commit();

    expect(surface.metrics.instanceCount).toBe(0);
    expect(hexMesh(surface).visible).toBe(false);
    surface.dispose();
  });

  it("uploads only the touched slot range on commit and clears the pending count", () => {
    const surface = new WorldBiomeSurface();
    surface.setTile(0, 0, BiomeType.Grassland);
    surface.setTile(1, 0, BiomeType.Grassland);
    surface.setTile(2, 0, BiomeType.Grassland);
    expect(surface.metrics.pendingWrites).toBe(3);
    surface.commit();

    expect(hexMesh(surface).instanceMatrix.updateRanges).toEqual([{ start: 0, count: 48 }]);
    expect(instanceColors(surface).updateRanges).toEqual([{ start: 0, count: 9 }]);
    expect(surface.metrics).toMatchObject({ commits: 1, pendingWrites: 0, uploadedInstances: 3 });

    simulateRendererUpload(surface);
    surface.setTile(1, 0, BiomeType.Snow);
    surface.commit();

    expect(hexMesh(surface).instanceMatrix.updateRanges).toEqual([{ start: 16, count: 16 }]);
    expect(instanceColors(surface).updateRanges).toEqual([{ start: 3, count: 3 }]);
    expect(surface.metrics).toMatchObject({ commits: 2, pendingWrites: 0, uploadedInstances: 4 });
    surface.dispose();
  });

  it("widens an update range the renderer has not consumed instead of replacing it", () => {
    const surface = new WorldBiomeSurface();
    surface.setTile(0, 0, BiomeType.Grassland);
    surface.setTile(1, 0, BiomeType.Grassland);
    surface.setTile(2, 0, BiomeType.Grassland);
    surface.commit();
    simulateRendererUpload(surface);

    surface.setTile(0, 0, BiomeType.Snow);
    surface.commit();
    surface.setTile(2, 0, BiomeType.Snow);
    surface.commit();

    expect(hexMesh(surface).instanceMatrix.updateRanges).toEqual([{ start: 0, count: 48 }]);
    expect(instanceColors(surface).updateRanges).toEqual([{ start: 0, count: 9 }]);
    surface.dispose();
  });

  it("commits without touching GPU ranges when nothing changed", () => {
    const surface = new WorldBiomeSurface();
    surface.commit();

    expect(hexMesh(surface).instanceMatrix.updateRanges).toEqual([]);
    expect(surface.metrics).toMatchObject({ commits: 1, uploadedInstances: 0 });
    surface.dispose();
  });

  it("throws loudly when the fixed capacity overflows", () => {
    const surface = new WorldBiomeSurface();
    for (let index = 0; index < WORLD_BIOME_SURFACE_CAPACITY; index += 1) {
      surface.setTile(index % 256, Math.floor(index / 256), BiomeType.Grassland);
    }

    expect(() => surface.setTile(256, 0, BiomeType.Grassland)).toThrow(/exceeded 65536 tiles/);
    expect(surface.metrics.instanceCount).toBe(WORLD_BIOME_SURFACE_CAPACITY);
    surface.dispose();
  });

  it("covers the origin with shroud before any tile arrives", () => {
    const surface = new WorldBiomeSurface();
    const shroud = shroudMesh(surface);

    expect(shroud.visible).toBe(true);
    expect(shroud.position.y).toBe(WORLD_BIOME_SHROUD_HEIGHT);
    expect(shroudBounds(surface)).toEqual(expectedShroudBounds(0, 0, 0, 0));
    expect(shroud.material.color.getHexString()).toBe(new Color(TERRAIN_DEEP_FOG_COLOR).getHexString());
    expect(shroud.material.toneMapped).toBe(false);
    surface.dispose();
  });

  it("grows the shroud plane to cover every tile plus the margin", () => {
    const surface = new WorldBiomeSurface();
    surface.setTile(100, 50, BiomeType.Grassland);
    surface.setTile(-30, -20, BiomeType.Grassland);
    surface.commit();
    expect(shroudBounds(surface)).toEqual(expectedShroudBounds(-30, 100, -20, 50));

    surface.setTile(100, 50, null);
    surface.setTile(0, 0, BiomeType.Grassland);
    surface.commit();
    expect(shroudBounds(surface)).toEqual(expectedShroudBounds(-30, 100, -20, 50));
    surface.dispose();
  });

  it("never draws more than two meshes", () => {
    const surface = new WorldBiomeSurface();
    expect(drawnMeshes(surface)).toBe(1);
    expect(surface.metrics.drawCalls).toBe(1);

    surface.setTile(0, 0, BiomeType.Grassland);
    surface.commit();
    expect(drawnMeshes(surface)).toBe(2);
    expect(surface.metrics.drawCalls).toBe(2);

    surface.setTile(0, 0, null);
    surface.commit();
    expect(drawnMeshes(surface)).toBe(1);
    expect(surface.metrics.drawCalls).toBe(1);
    surface.dispose();
  });

  it("builds each hex as a six-corner fan of four upward triangles matching the page corners", () => {
    const surface = new WorldBiomeSurface();
    const geometry = hexMesh(surface).geometry;
    const positions = geometry.getAttribute("position");
    const index = geometry.getIndex();
    if (!index) throw new Error("hex geometry must be indexed");

    expect(positions.count).toBe(6);
    expect(index.count).toBe(12);
    terrainHexCorners(0, 0).forEach((corner, cornerIndex) => {
      expect(positions.getX(cornerIndex)).toBeCloseTo(corner.x, 6);
      expect(positions.getY(cornerIndex)).toBe(0);
      expect(positions.getZ(cornerIndex)).toBeCloseTo(corner.z, 6);
    });
    for (let triangle = 0; triangle < 4; triangle += 1) {
      expect(faceNormalY(geometry, triangle)).toBeGreaterThan(0);
    }
    surface.dispose();
  });

  it("only turns the materials transparent while fading", () => {
    const surface = new WorldBiomeSurface();
    const materials = [singleMaterial(hexMesh(surface)), singleMaterial(shroudMesh(surface))];
    expect(materials.map((material) => material.transparent)).toEqual([false, false]);

    surface.setOpacity(0.4);
    expect(materials.map((material) => [material.transparent, material.opacity])).toEqual([
      [true, 0.4],
      [true, 0.4],
    ]);

    surface.setOpacity(1.5);
    expect(materials.map((material) => [material.transparent, material.opacity])).toEqual([
      [false, 1],
      [false, 1],
    ]);
    surface.dispose();
  });

  it("keeps the whole surface under the lowest detailed page vertex", () => {
    expect(WORLD_BIOME_SURFACE_HEIGHT).toBeLessThan(-0.63);
    expect(WORLD_BIOME_SHROUD_HEIGHT).toBeLessThan(WORLD_BIOME_SURFACE_HEIGHT);
  });

  it("toggles visibility through the root object", () => {
    const surface = new WorldBiomeSurface();
    surface.setVisible(false);
    expect(surface.object3d.visible).toBe(false);
    surface.setVisible(true);
    expect(surface.object3d.visible).toBe(true);
    surface.dispose();
  });
});

function hexMesh(surface: WorldBiomeSurface): InstancedMesh {
  const mesh = surface.object3d.getObjectByName("world-biome-surface-hexes");
  if (!(mesh instanceof InstancedMesh)) throw new Error("hex mesh missing");
  return mesh;
}

function shroudMesh(surface: WorldBiomeSurface): Mesh<PlaneGeometry, MeshBasicMaterial> {
  const mesh = surface.object3d.getObjectByName("world-biome-surface-shroud");
  if (!(mesh instanceof Mesh) || !(mesh.material instanceof MeshBasicMaterial)) throw new Error("shroud mesh missing");
  return mesh as Mesh<PlaneGeometry, MeshBasicMaterial>;
}

function singleMaterial(mesh: Mesh): Material {
  if (Array.isArray(mesh.material)) throw new Error("surface meshes carry one material each");
  return mesh.material;
}

function instanceColors(surface: WorldBiomeSurface): NonNullable<InstancedMesh["instanceColor"]> {
  const colors = hexMesh(surface).instanceColor;
  if (!colors) throw new Error("instance colours missing");
  return colors;
}

function slotPosition(surface: WorldBiomeSurface, slot: number): [number, number, number] {
  const elements = hexMesh(surface).instanceMatrix.array;
  const offset = slot * 16;
  return [elements[offset + 12], elements[offset + 13], elements[offset + 14]];
}

function expectedPosition(col: number, row: number): [number, number, number] {
  const { x, z } = terrainHexToWorld(col, row);
  return [Math.fround(x), Math.fround(WORLD_BIOME_SURFACE_HEIGHT), Math.fround(z)];
}

function slotColor(surface: WorldBiomeSurface, slot: number): [number, number, number] {
  const colors = instanceColors(surface);
  return [colors.getX(slot), colors.getY(slot), colors.getZ(slot)];
}

function paletteColor(biome: BiomeType): [number, number, number] {
  const color = new Color(TERRAIN_BIOME_DESCRIPTORS[biome].primary);
  return [Math.fround(color.r), Math.fround(color.g), Math.fround(color.b)];
}

function simulateRendererUpload(surface: WorldBiomeSurface): void {
  hexMesh(surface).instanceMatrix.clearUpdateRanges();
  instanceColors(surface).clearUpdateRanges();
}

function shroudBounds(surface: WorldBiomeSurface): { maxX: number; maxZ: number; minX: number; minZ: number } {
  const { position, scale } = shroudMesh(surface);
  return {
    maxX: round(position.x + scale.x / 2),
    maxZ: round(position.z + scale.z / 2),
    minX: round(position.x - scale.x / 2),
    minZ: round(position.z - scale.z / 2),
  };
}

function expectedShroudBounds(
  minCol: number,
  maxCol: number,
  minRow: number,
  maxRow: number,
): { maxX: number; maxZ: number; minX: number; minZ: number } {
  const low = terrainHexToWorld(minCol - WORLD_BIOME_SHROUD_MARGIN_HEXES, minRow - WORLD_BIOME_SHROUD_MARGIN_HEXES);
  const high = terrainHexToWorld(maxCol + WORLD_BIOME_SHROUD_MARGIN_HEXES, maxRow + WORLD_BIOME_SHROUD_MARGIN_HEXES);
  return { maxX: round(high.x), maxZ: round(high.z), minX: round(low.x), minZ: round(low.z) };
}

function drawnMeshes(surface: WorldBiomeSurface): number {
  let drawn = 0;
  surface.object3d.traverseVisible((object) => {
    if (!(object instanceof Mesh)) return;
    if (object instanceof InstancedMesh && object.count === 0) return;
    drawn += 1;
  });
  return drawn;
}

function faceNormalY(geometry: InstancedMesh["geometry"], triangle: number): number {
  const index = geometry.getIndex();
  const positions = geometry.getAttribute("position");
  if (!index) throw new Error("hex geometry must be indexed");
  const corner = (vertex: number) => new Vector3().fromBufferAttribute(positions, index.getX(triangle * 3 + vertex));
  const a = corner(0);
  const b = corner(1).sub(a);
  const c = corner(2).sub(a);
  return b.cross(c).y;
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
