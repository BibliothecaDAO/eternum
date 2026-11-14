import sharp from "sharp";

/** A colour as the model stores it (linear light), from the sRGB hex an artist reads. */
export function colour(hex) {
  return [1, 3, 5].map((start) => (parseInt(hex.slice(start, start + 2), 16) / 255) ** 2.2);
}

export const mix = (a, b, t) => a + (b - a) * t;
export const mixColour = (a, b, t) => a.map((value, channel) => mix(value, b[channel], t));
export const fract = (value) => value - Math.floor(value);
const clamp01 = (value) => Math.min(1, Math.max(0, value));

/** 0 below `from`, 1 above `to`, eased between; `from` may be the greater, for a falling edge. */
export function smoothstep(from, to, value) {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
}

/** A coat lit from above: its back colour where the skin faces the sky, its belly colour where it faces the ground. */
export function countershade(back, belly, normal) {
  return mixColour(belly, back, smoothstep(-0.75, 0.15, normal[1]));
}

/**
 * Where a vertex falls on the coat's painting: the animal seen from its flank, nose to the right. Both flanks share
 * the painting, and a marking runs unbroken over the back and under the belly, as stripes do.
 */
export function flankProjection(positions, bounds) {
  const [, lowY, lowZ, , highY, highZ] = bounds;
  const uvs = new Float32Array((positions.length / 3) * 2);
  for (let vertex = 0; vertex < positions.length / 3; vertex++) {
    uvs[vertex * 2] = (positions[vertex * 3 + 2] - lowZ) / (highZ - lowZ);
    uvs[vertex * 2 + 1] = (highY - positions[vertex * 3 + 1]) / (highY - lowY);
  }
  return uvs;
}

/** The species' markings as a function of the painting's coordinates, from its markings in the flank's (y, z). */
export function coatOnFlank(markings, bounds) {
  const [, lowY, lowZ, , highY, highZ] = bounds;
  return (u, v) => markings(highY - v * (highY - lowY), lowZ + u * (highZ - lowZ));
}

/** Paints the coat to a PNG the model carries as its base colour. */
export async function paintCoatImage(coat, size) {
  const pixels = Buffer.alloc(size * size * 3);
  for (let row = 0; row < size; row++)
    for (let column = 0; column < size; column++) {
      const linear = coat((column + 0.5) / size, (row + 0.5) / size);
      for (let channel = 0; channel < 3; channel++)
        pixels[(row * size + column) * 3 + channel] = Math.round(255 * clamp01(linear[channel]) ** (1 / 2.2));
    }
  return sharp(pixels, { raw: { width: size, height: size, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}
