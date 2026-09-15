import { Color } from "three";
import { findNearestTerrainHex, terrainHexCorners, terrainHexToWorld } from "./terrain-coordinates";

const ETHEREAL_BORDER_COLORS = ["#ff163c", "#ff6508", "#ffc42b", "#147aff", "#ff2ccd"] as const;
const BORDER_HEIGHT = 0.138;
const BORDER_WIDTH = 0.028;

/** Each hex owns its inward half of the border. Shared edges meet without overlapping glow or page ownership gaps. */
export function buildEtherealBorderCell(col: number, row: number) {
  const corners = terrainHexCorners(col, row);
  const center = terrainHexToWorld(col, row);
  const positions: number[] = [],
    normals: number[] = [],
    colors: number[] = [],
    indices: number[] = [],
    uvs: number[] = [];
  for (let edge = 0; edge < 6; edge += 1) {
    const a = corners[edge],
      b = corners[(edge + 1) % 6];
    const midX = (a.x + b.x) / 2,
      midZ = (a.z + b.z) / 2;
    const neighbor = findNearestTerrainHex(midX + (midX - center.x) * 0.01, midZ + (midZ - center.z) * 0.01);
    const first = col < neighbor.col || (col === neighbor.col && row < neighbor.row) ? { col, row } : neighbor;
    const last = first === neighbor ? { col, row } : neighbor;
    const firstCenter = terrainHexToWorld(first.col, first.row),
      lastCenter = terrainHexToWorld(last.col, last.row);
    const forward = (b.x - a.x) * (lastCenter.z - firstCenter.z) - (b.z - a.z) * (lastCenter.x - firstCenter.x) > 0;
    const key = `${first.col},${first.row}:${last.col},${last.row}`;
    let hash = 2166136261;
    for (const character of key) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
    const tint = new Color(ETHEREAL_BORDER_COLORS[hash % ETHEREAL_BORDER_COLORS.length]);
    const inset = 1 - BORDER_WIDTH / (Math.sqrt(3) / 2);
    const innerA = { x: center.x + (a.x - center.x) * inset, z: center.z + (a.z - center.z) * inset };
    const innerB = { x: center.x + (b.x - center.x) * inset, z: center.z + (b.z - center.z) * inset };
    const start = positions.length / 3;
    for (const point of [a, b, innerB, innerA]) {
      positions.push(point.x, BORDER_HEIGHT, point.z);
      normals.push(0, 1, 0);
      colors.push(tint.r, tint.g, tint.b);
    }
    const phase = (hash % 101) / 101;
    uvs.push(
      (forward ? 0 : 1) + phase,
      0,
      (forward ? 1 : 0) + phase,
      0,
      (forward ? 1 : 0) + phase,
      1,
      (forward ? 0 : 1) + phase,
      1,
    );
    indices.push(start, start + 2, start + 1, start, start + 3, start + 2);
  }
  return { positions, normals, colors, indices, uvs };
}
