import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineSegments } from "three";
import { terrainHexCorners } from "@/three/terrain/terrain-coordinates";
import type { TerrainSurface } from "@/three/terrain/terrain-surface";
import type { TerrainPageRequest } from "@/three/terrain/terrain-types";

export class TerrainLabGrid {
  readonly object3d = new LineSegments(
    new BufferGeometry(),
    new LineBasicMaterial({ color: 0xb8d3c8, transparent: true, opacity: 0.35, depthWrite: false }),
  );

  constructor(
    private readonly terrain: TerrainSurface,
    private readonly localMode: boolean,
  ) {
    this.object3d.name = "lab-tile-grid";
    this.object3d.renderOrder = 40;
    this.object3d.raycast = () => {};
  }

  update(request: TerrainPageRequest): void {
    const positions: number[] = [];
    const edges = new Set<string>();
    for (const cell of request.cells) {
      if (this.localMode && !cell.occupied) continue;
      const corners = terrainHexCorners(cell.col, cell.row);
      for (let edge = 0; edge < 6; edge++) {
        const start = corners[edge];
        const end = corners[(edge + 1) % 6];
        const key = [`${start.x}:${start.z}`, `${end.x}:${end.z}`].sort().join("/");
        if (edges.has(key)) continue;
        edges.add(key);
        for (let step = 0; step < 6; step++) {
          for (const t of [step / 6, (step + 1) / 6]) {
            const x = start.x + (end.x - start.x) * t;
            const z = start.z + (end.z - start.z) * t;
            positions.push(x, this.terrain.sampleSurface(x, z).height + 0.035, z);
          }
        }
      }
    }
    this.object3d.geometry.dispose();
    this.object3d.geometry = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(positions, 3));
  }

  dispose(): void {
    this.object3d.removeFromParent();
    this.object3d.geometry.dispose();
    this.object3d.material.dispose();
  }
}
