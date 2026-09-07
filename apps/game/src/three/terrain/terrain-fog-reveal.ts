import { DataTexture, FloatType, NearestFilter, RGBAFormat, Vector4 } from "three";
import {
  Fn,
  If,
  float,
  mx_noise_float,
  normalWorldGeometry,
  positionWorld,
  step,
  texture,
  uniform,
  vec2,
} from "three/tsl";
import type Node from "three/src/nodes/core/Node.js";
import type NodeMaterial from "three/src/materials/nodes/NodeMaterial.js";

import { terrainCellKey, terrainHexToWorld } from "./terrain-coordinates";
import { nearestHexLocalPosition } from "./terrain-hex-node";

export const TERRAIN_FOG_REVEAL_DURATION_SECONDS = 0.3;

interface Reveal {
  col: number;
  row: number;
  start: number;
  direction: readonly [number, number];
}

/** Transient presentation only: one record per newly explored hex, uploaded on start/end, never each frame. */
export class TerrainFogReveal {
  private readonly reveals = new Map<string, Reveal>();
  private readonly clock = uniform(0);
  private readonly count = uniform(0);
  private readonly bounds = uniform(new Vector4(0, 0, 1, 1));
  private readonly map = new DataTexture(new Float32Array(4), 1, 1, RGBAFormat, FloatType);
  private reducedMotion = false;

  constructor() {
    this.map.name = "terrain-exploration-reveals";
    this.map.minFilter = this.map.magFilter = NearestFilter;
    this.map.generateMipmaps = false;
    this.map.needsUpdate = true;
  }

  get size(): number {
    return this.reveals.size;
  }

  start(col: number, row: number, direction: readonly [number, number]): void {
    if (this.reducedMotion) return;
    const key = terrainCellKey(col, row);
    if (this.reveals.has(key)) return;
    this.reveals.set(key, { col, row, direction, start: this.clock.value });
    this.upload();
  }

  update(deltaSeconds: number): void {
    this.clock.value += Math.max(0, deltaSeconds);
    let changed = false;
    this.reveals.forEach((reveal, key) => {
      if (this.clock.value - reveal.start < TERRAIN_FOG_REVEAL_DURATION_SECONDS) return;
      this.reveals.delete(key);
      changed = true;
    });
    if (changed) this.upload();
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    if (!reduced || this.reveals.size === 0) return;
    this.reveals.clear();
    this.upload();
  }

  applyToMaterial(material: NodeMaterial): void {
    const originalOpacity = (material.opacityNode as Node<"float"> | null) ?? float(material.opacity);
    const visibility = Fn(() => {
      const visible = float(1).toVar();
      If(this.count.greaterThan(0), () => {
        // Frontier walls sit exactly on a shared edge. Bias into their owning hex
        // so floating-point ties cannot expose wall fragments before the reveal.
        const wall = normalWorldGeometry.y.abs().lessThan(0.1).select(float(0.001), float(0));
        const samplePosition = positionWorld.xz.sub(normalWorldGeometry.xz.mul(wall));
        const local = nearestHexLocalPosition(samplePosition);
        const center = samplePosition.sub(local);
        const row = center.y.div(1.5).round();
        const col = center.x.div(Math.sqrt(3)).add(row.mod(2).abs().mul(0.5)).round();
        const mapUv = vec2(col, row).sub(this.bounds.xy).add(0.5).div(this.bounds.zw);
        const inside = mapUv.greaterThanEqual(0).all().and(mapUv.lessThan(1).all());
        If(inside, () => {
          const reveal = texture(this.map, mapUv).level(float(0));
          If(reveal.w.greaterThan(0), () => {
            const progress = this.clock.sub(reveal.x).div(TERRAIN_FOG_REVEAL_DURATION_SECONDS).clamp(0, 1);
            const arrival = createFogDissolveThreshold(samplePosition, local, reveal.yz);
            visible.assign(step(arrival, progress));
          });
        });
      });
      return visible;
    })();
    material.opacityNode = originalOpacity.mul(visibility);
    material.alphaTest = Math.max(material.alphaTest, 0.001);
  }

  clear(): void {
    this.reveals.clear();
    this.count.value = 0;
  }

  dispose(): void {
    this.clear();
    this.map.dispose();
  }

  private upload(): void {
    this.count.value = this.reveals.size;
    if (this.reveals.size === 0) return;
    const cells = [...this.reveals.values()];
    const minCol = Math.min(...cells.map((cell) => cell.col));
    const minRow = Math.min(...cells.map((cell) => cell.row));
    const width = Math.max(...cells.map((cell) => cell.col)) - minCol + 1;
    const height = Math.max(...cells.map((cell) => cell.row)) - minRow + 1;
    if (width > 1024 || height > 1024) throw new Error("Exploration reveal exceeds the resident terrain window");
    if (this.map.image.width !== width || this.map.image.height !== height) this.map.dispose();
    const data = new Float32Array(width * height * 4);
    for (const cell of cells) {
      const offset = ((cell.row - minRow) * width + cell.col - minCol) * 4;
      data.set([cell.start, cell.direction[0], cell.direction[1], 1], offset);
    }
    this.bounds.value.set(minCol, minRow, width, height);
    this.map.image = { data, width, height };
    this.map.needsUpdate = true;
  }
}

function createFogDissolveThreshold(
  worldXZ: Node<"vec2">,
  local: Node<"vec2">,
  direction: Node<"vec2">,
): Node<"float"> {
  const distance = local.dot(direction).add(1).mul(0.5).clamp(0, 1);
  // Fixed world-space noise gives each patch one arrival time: wisps disappear
  // monotonically instead of swimming back across already revealed ground.
  const billows = mx_noise_float(worldXZ.mul(3.2)).mul(0.5).add(0.5).clamp(0, 1);
  const wisps = mx_noise_float(worldXZ.mul(vec2(11, 5.5)).add(vec2(17.3, 8.9)))
    .mul(0.5)
    .add(0.5)
    .clamp(0, 1);
  // The bounded threshold (0.04..0.96) guarantees full coverage at the start
  // and no surviving fragments when the 300ms reveal record expires.
  return distance.mul(0.42).add(billows.mul(0.38)).add(wisps.mul(0.12)).add(0.04);
}

export function resolveFogRevealDirection(
  target: { col: number; row: number },
  source: { col: number; row: number } | undefined,
  frontierDirection: readonly [number, number],
): readonly [number, number] {
  const to = terrainHexToWorld(target.col, target.row);
  const from = source ? terrainHexToWorld(source.col, source.row) : null;
  const dx = from ? to.x - from.x : -frontierDirection[0];
  const dz = from ? to.z - from.z : -frontierDirection[1];
  const length = Math.hypot(dx, dz);
  return length > 0 ? [dx / length, dz / length] : [1, 0];
}
