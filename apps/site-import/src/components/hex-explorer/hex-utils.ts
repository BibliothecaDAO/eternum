import type { HexCoord, HexDirection, PixelCoord } from "./types";

const SQRT3 = Math.sqrt(3);

/**
 * Direction offsets for pointy-top hex orientation (axial coordinates).
 *
 * 0: East      (+1,  0)
 * 1: NE        (+1, -1)
 * 2: NW        ( 0, -1)
 * 3: West      (-1,  0)
 * 4: SW        (-1, +1)
 * 5: SE        ( 0, +1)
 */
const DIRECTION_OFFSETS: readonly [number, number][] = [
  [+1, 0], // 0 East
  [+1, -1], // 1 NE
  [0, -1], // 2 NW
  [-1, 0], // 3 West
  [-1, +1], // 4 SW
  [0, +1], // 5 SE
];

/** Convert axial hex coordinate to pixel center (pointy-top). */
export function hexToPixel(hex: HexCoord, size: number): PixelCoord {
  return {
    x: size * (SQRT3 * hex.q + (SQRT3 / 2) * hex.r),
    y: size * ((3 / 2) * hex.r),
  };
}

/** Convert pixel position to the nearest axial hex coordinate (pointy-top). */
export function pixelToHex(pixel: PixelCoord, size: number): HexCoord {
  const q = ((SQRT3 / 3) * pixel.x - (1 / 3) * pixel.y) / size;
  const r = ((2 / 3) * pixel.y) / size;
  return hexRound({ q, r });
}

/** Get the neighbor hex in a given direction. */
export function hexNeighbor(hex: HexCoord, direction: HexDirection): HexCoord {
  const [dq, dr] = DIRECTION_OFFSETS[direction];
  return { q: hex.q + dq, r: hex.r + dr };
}

/** Manhattan-style hex distance between two hexes. */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

/** All hexes at exactly the given radius from center. */
export function hexRing(center: HexCoord, radius: number): HexCoord[] {
  if (radius === 0) return [center];

  const results: HexCoord[] = [];
  // Start at direction 4 (SW), walk radius steps
  let hex: HexCoord = { q: center.q, r: center.r };
  for (let i = 0; i < radius; i++) {
    hex = hexNeighbor(hex, 4);
  }

  for (let dir = 0; dir < 6; dir++) {
    for (let step = 0; step < radius; step++) {
      results.push(hex);
      hex = hexNeighbor(hex, dir as HexDirection);
    }
  }

  return results;
}

/** All hexes within the given radius (inclusive) from center. */
export function hexesInRange(center: HexCoord, radius: number): HexCoord[] {
  const results: HexCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      results.push({ q: center.q + q, r: center.r + r });
    }
  }
  return results;
}

/** Get the 6 corner pixel positions of a hex (pointy-top). */
export function hexCorners(center: PixelCoord, size: number): PixelCoord[] {
  const corners: PixelCoord[] = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i - 30; // pointy-top: first corner at -30 degrees
    const angleRad = (Math.PI / 180) * angleDeg;
    corners.push({
      x: center.x + size * Math.cos(angleRad),
      y: center.y + size * Math.sin(angleRad),
    });
  }
  return corners;
}

/** String key for using hex coords in Maps / Sets. */
export function hexKey(hex: HexCoord): string {
  return `${hex.q},${hex.r}`;
}

/** Round fractional axial coords to the nearest hex. */
function hexRound(hex: { q: number; r: number }): HexCoord {
  const s = -hex.q - hex.r;
  let rq = Math.round(hex.q);
  let rr = Math.round(hex.r);
  const rs = Math.round(s);

  const dq = Math.abs(rq - hex.q);
  const dr = Math.abs(rr - hex.r);
  const ds = Math.abs(rs - s);

  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }
  // else rs gets adjusted but we don't need it

  return { q: rq, r: rr };
}
