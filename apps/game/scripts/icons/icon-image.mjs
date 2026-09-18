import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

import sharp from "sharp";

const EDGE_CLEARANCE = 3;

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

function requirePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
}
