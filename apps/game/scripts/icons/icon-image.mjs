import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

import sharp from "sharp";

const EDGE_CLEARANCE = 3;
const APPEARANCE_GRID_CELLS = 32;

export function validateIconOutputContract(outputContract) {
  requirePositiveInteger(outputContract?.size, "output.size");
  requirePositiveInteger(outputContract?.subjectSize, "output.subjectSize");
  requirePositiveInteger(outputContract?.maxBytes, "output.maxBytes");
  if (outputContract.subjectSize >= outputContract.size)
    throw new Error("subjectSize must be smaller than output size");
  if (outputContract.format !== "png") throw new Error("the icon compatibility format must be png");
}

export async function normalizeIconImage(inputPath, outputPath, outputContract) {
  await requireTransparentMaster(inputPath);
  const trimmed = await createTrimmedIcon(inputPath, outputContract.subjectSize);
  const metadata = await sharp(trimmed).metadata();
  const left = Math.floor((outputContract.size - metadata.width) / 2);
  const top = Math.floor((outputContract.size - metadata.height) / 2);
  const result = await createIconCanvas(outputContract.size)
    .composite([{ input: trimmed, left, top }])
    .png({ adaptiveFiltering: true, compressionLevel: 9, effort: 10 })
    .toFile(outputPath);
  return { bytes: result.size, output: outputPath, source: inputPath };
}

export async function requireTransparentMaster(path) {
  const metadata = await sharp(path).metadata();
  if (!metadata.hasAlpha) throw new Error(`${path}: master has no alpha channel; do not use a simulated checkerboard`);
  const { channels } = await sharp(path).stats();
  if (channels[3]?.min !== 0) {
    throw new Error(`${path}: master has no fully transparent pixels; do not use a simulated checkerboard`);
  }
}

/**
 * Lanczos resampling differs between CPU architectures and libvips builds, so "the rebuild is
 * pixel-identical to the file we published" is not a portable claim: masters that reproduce exactly
 * on macOS/arm64 drift by an RMSE of 6 on the linux/x64 CI runner. Averaging premultiplied colour
 * over a 32x32 grid keeps the claim that matters - same artwork, same scale, same placement - and
 * holds resampler noise under 0.4 on every platform measured, while a one-pixel shift still scores
 * 5 and an unrelated icon 57.
 */
export async function readIconAppearanceSignature(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  requireUniformAppearanceGrid(path, info);
  return averagePremultipliedCells(data, info);
}

export function measureAppearanceDistance(actual, expected) {
  if (actual.length !== expected.length) throw new Error("appearance signatures must describe the same grid");
  let squaredError = 0;
  for (let index = 0; index < actual.length; index += 1) {
    const difference = actual[index] - expected[index];
    squaredError += difference * difference;
  }
  return Math.sqrt(squaredError / actual.length);
}

export async function verifyIconImage(path, outputContract) {
  const [metadata, fileStats, bytes] = await Promise.all([sharp(path).metadata(), stat(path), readFile(path)]);
  if (metadata.format !== outputContract.format) throw new Error(`${path}: expected ${outputContract.format}`);
  if (metadata.width !== outputContract.size || metadata.height !== outputContract.size) {
    throw new Error(`${path}: expected ${outputContract.size}x${outputContract.size}`);
  }
  if (!metadata.hasAlpha) throw new Error(`${path}: expected an alpha channel`);
  if (fileStats.size > outputContract.maxBytes) {
    throw new Error(`${path}: ${fileStats.size} bytes exceeds ${outputContract.maxBytes}`);
  }
  await requireTransparentEdge(path, outputContract.size);
  return { bytes: fileStats.size, sha256: createHash("sha256").update(bytes).digest("hex") };
}

function createTrimmedIcon(path, subjectSize) {
  return sharp(path)
    .rotate()
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .resize({
      fit: "inside",
      height: subjectSize,
      kernel: sharp.kernel.lanczos3,
      width: subjectSize,
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();
}

function createIconCanvas(size) {
  return sharp({
    create: {
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      channels: 4,
      height: size,
      width: size,
    },
  });
}

async function requireTransparentEdge(path, size) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (isInsideSafetyEdge(x, y, size)) continue;
      const alpha = data[(y * info.width + x) * info.channels + 3];
      if (alpha !== 0) throw new Error(`${path}: visible pixels enter the ${EDGE_CLEARANCE}px safety edge`);
    }
  }
}

function isInsideSafetyEdge(x, y, size) {
  return x >= EDGE_CLEARANCE && x < size - EDGE_CLEARANCE && y >= EDGE_CLEARANCE && y < size - EDGE_CLEARANCE;
}

function averagePremultipliedCells(data, info) {
  const cellSize = info.width / APPEARANCE_GRID_CELLS;
  const signature = new Float64Array(APPEARANCE_GRID_CELLS * APPEARANCE_GRID_CELLS * 4);
  for (let cellY = 0; cellY < APPEARANCE_GRID_CELLS; cellY += 1) {
    for (let cellX = 0; cellX < APPEARANCE_GRID_CELLS; cellX += 1) {
      const totals = totalPremultipliedCell(data, info, cellX * cellSize, cellY * cellSize, cellSize);
      const offset = (cellY * APPEARANCE_GRID_CELLS + cellX) * totals.length;
      for (let channel = 0; channel < totals.length; channel += 1) {
        signature[offset + channel] = totals[channel] / (cellSize * cellSize);
      }
    }
  }
  return signature;
}

/** Colour is weighted by coverage so the near-transparent pixels that unpremultiplying amplifies cannot dominate. */
function totalPremultipliedCell(data, info, startX, startY, cellSize) {
  const totals = [0, 0, 0, 0];
  for (let y = startY; y < startY + cellSize; y += 1) {
    for (let x = startX; x < startX + cellSize; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const alpha = data[offset + 3];
      const coverage = alpha / 255;
      totals[0] += data[offset] * coverage;
      totals[1] += data[offset + 1] * coverage;
      totals[2] += data[offset + 2] * coverage;
      totals[3] += alpha;
    }
  }
  return totals;
}

function requireUniformAppearanceGrid(path, info) {
  if (info.width !== info.height || info.width % APPEARANCE_GRID_CELLS !== 0) {
    throw new Error(`${path}: an appearance signature needs a square image divisible by ${APPEARANCE_GRID_CELLS}`);
  }
}

function requirePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
}
