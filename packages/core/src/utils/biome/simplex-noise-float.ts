const ONE_64X64 = 1n << 64n;
const GRADIENT_STEP = 5270498306774157605n;
const GRADIENT_START = -17129119497016012214n;

const gradientAt = (index: number): bigint => BigInt(index) * GRADIENT_STEP + GRADIENT_START;
const magnitude = (value: bigint): bigint => (value < 0n ? -value : value);
const GRADIENT = Array.from({ length: 7 }, (_, index) => Number(gradientAt(index)) / 2 ** 64);
const HEIGHT = Array.from({ length: 49 }, (_, cell) => {
  const x = Math.floor(cell / 7);
  return ONE_64X64 - magnitude(gradientAt(x)) - magnitude(gradientAt(cell - x * 7));
});
const HEIGHT_VALUE = Float64Array.from(HEIGHT, (value) => Number(value) / 2 ** 64);
const FOLDED = Uint8Array.from(HEIGHT, (value) => (value <= 0n ? 1 : 0));

const mod289 = (value: number): number => value - Math.floor(value / 289) * 289;
const permute = (value: number): number => mod289((value * 34 + 1) * value);

function cornerOf(value: number, skew: number, sum: number): number {
  const skewed = value + skew;
  return Math.floor(skewed) - (sum > 0 && Number.isInteger(skewed) ? 1 : 0);
}

function contribution(hash: number, dx: number, dy: number, dz: number): number {
  const falloff = 0.5 - (dx * dx + dy * dy + dz * dz);
  if (falloff <= 0) return 0;
  const j = hash - Math.floor(hash / 49) * 49;
  const column = Math.floor(j / 7);
  const row = Math.floor(j - 7 * column);
  const cell = column * 7 + row;
  const fold = FOLDED[cell];
  const gx = GRADIENT[column] - fold * (Math.floor(GRADIENT[column]) * 2 + 1);
  const gy = GRADIENT[row] - fold * (Math.floor(GRADIENT[row]) * 2 + 1);
  const gz = HEIGHT_VALUE[cell];
  const norm = 1.79284291400159 - 0.85373472095314 * (gx * gx + gy * gy + gz * gz);
  const squared = falloff * falloff;
  return squared * squared * norm * (gx * dx + gy * dy + gz * dz);
}

export function noiseFloat(vx: number, vy: number, vz: number): number {
  const sum = vx + vy + vz;
  const skew = sum / 3;
  const ix = cornerOf(vx, skew, sum);
  const iy = cornerOf(vy, skew, sum);
  const iz = cornerOf(vz, skew, sum);
  const unskew = (ix + iy + iz) / 6;
  const x0 = vx - ix + unskew;
  const y0 = vy - iy + unskew;
  const z0 = vz - iz + unskew;
  const gx = x0 >= y0 ? 1 : 0;
  const gy = y0 >= z0 ? 1 : 0;
  const gz = z0 >= x0 ? 1 : 0;
  const i1x = Math.min(gx, 1 - gz);
  const i1y = Math.min(gy, 1 - gx);
  const i1z = Math.min(gz, 1 - gy);
  const i2x = Math.max(gx, 1 - gz);
  const i2y = Math.max(gy, 1 - gx);
  const i2z = Math.max(gz, 1 - gy);
  const cx = mod289(ix);
  const cy = mod289(iy);
  const cz = mod289(iz);
  const hash = (ox: number, oy: number, oz: number) => permute(permute(permute(cz + oz) + cy + oy) + cx + ox);
  return (
    105 *
    (contribution(hash(0, 0, 0), x0, y0, z0) +
      contribution(hash(i1x, i1y, i1z), x0 - i1x + 1 / 6, y0 - i1y + 1 / 6, z0 - i1z + 1 / 6) +
      contribution(hash(i2x, i2y, i2z), x0 - i2x + 1 / 3, y0 - i2y + 1 / 3, z0 - i2z + 1 / 3) +
      contribution(hash(1, 1, 1), x0 - 0.5, y0 - 0.5, z0 - 0.5))
  );
}
