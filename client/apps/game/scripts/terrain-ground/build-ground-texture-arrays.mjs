import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";

const REQUIRED_MAPS = Object.freeze(["albedo", "height", "normal", "roughness", "ao"]);
const TEXTURE_RESOLUTION = 512;

export async function buildGroundTextureCatalog({
  ktxBinary,
  manifestPath,
  outputDirectory,
  outputPrefix = "ground",
  sourceDirectory,
}) {
  if (!manifestPath) throw new Error("Ground texture build requires a source manifest");
  const manifest = readJson(manifestPath);
  validateInputs(manifest, sourceDirectory, ktxBinary);
  const scratchDirectory = mkdtempSync(join(tmpdir(), "eternum-ground-textures-"));

  try {
    const packedLayers = await packProofLayers(manifest.layers, sourceDirectory, scratchDirectory);
    mkdirSync(outputDirectory, { recursive: true });
    const albedoHeightPath = join(outputDirectory, `${outputPrefix}-albedo-height.ktx2`);
    const normalMaterialPath = join(outputDirectory, `${outputPrefix}-normal-material.ktx2`);
    createTextureArray({
      codecArguments: ["--encode", "basis-lz", "--qlevel", "196", "--clevel", "2"],
      format: "R8G8B8A8_SRGB",
      inputPaths: packedLayers.map(({ albedoHeightPath: path }) => path),
      ktxBinary,
      outputPath: albedoHeightPath,
      transferFunction: "srgb",
    });
    createTextureArray({
      codecArguments: [
        "--encode",
        "uastc",
        "--uastc-quality",
        "2",
        "--uastc-rdo",
        "--uastc-rdo-l",
        "0.5",
        "--zstd",
        "18",
      ],
      format: "R8G8B8A8_UNORM",
      inputPaths: packedLayers.map(({ normalMaterialPath: path }) => path),
      ktxBinary,
      outputPath: normalMaterialPath,
      transferFunction: "linear",
    });
    validateTextureArray(ktxBinary, albedoHeightPath);
    validateTextureArray(ktxBinary, normalMaterialPath);
    const runtimeManifest = createRuntimeManifest(manifest, albedoHeightPath, normalMaterialPath);
    writeFileSync(
      join(outputDirectory, `${outputPrefix}-materials.json`),
      `${JSON.stringify(runtimeManifest, null, 2)}\n`,
    );
    return runtimeManifest;
  } finally {
    rmSync(scratchDirectory, { force: true, recursive: true });
  }
}

async function packProofLayers(layers, sourceDirectory, scratchDirectory) {
  const packedLayers = [];
  for (const [index, layer] of layers.entries()) {
    const sourceRoot = join(sourceDirectory, layer.id);
    const albedoHeightPath = join(scratchDirectory, `${index}-${layer.id}-albedo-height.png`);
    const normalMaterialPath = join(scratchDirectory, `${index}-${layer.id}-normal-material.png`);
    await packAlbedoHeight(sourceRoot, layer, albedoHeightPath);
    await packNormalMaterial(sourceRoot, layer, normalMaterialPath);
    packedLayers.push({ albedoHeightPath, normalMaterialPath });
  }
  return packedLayers;
}

async function packAlbedoHeight(sourceRoot, layer, outputPath) {
  const albedoPath = join(sourceRoot, layer.maps.albedo.file);
  const red = await extractChannel(albedoPath, 0);
  const green = await extractChannel(albedoPath, 1);
  const blue = await extractChannel(albedoPath, 2);
  const height = await extractChannel(join(sourceRoot, layer.maps.height.file), 0);
  await writePackedRgba([red, green, blue, height], outputPath);
}

async function packNormalMaterial(sourceRoot, layer, outputPath) {
  const normalPath = join(sourceRoot, layer.maps.normal.file);
  const normalX = await extractChannel(normalPath, 0);
  const normalY = await extractChannel(normalPath, 1);
  const roughness = await extractChannel(join(sourceRoot, layer.maps.roughness.file), 0);
  const ao = await extractChannel(join(sourceRoot, layer.maps.ao.file), 0);
  await writePackedRgba([normalX, normalY, roughness, ao], outputPath);
}

async function writePackedRgba(channels, outputPath) {
  const pixelCount = TEXTURE_RESOLUTION * TEXTURE_RESOLUTION;
  const packed = Buffer.allocUnsafe(pixelCount * 4);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    for (let channel = 0; channel < 4; channel += 1) {
      packed[pixel * 4 + channel] = channels[channel][pixel];
    }
  }
  await sharp(packed, { raw: { channels: 4, height: TEXTURE_RESOLUTION, width: TEXTURE_RESOLUTION } })
    .png({ bitdepth: 8, compressionLevel: 9 })
    .toFile(outputPath);
}

async function extractChannel(path, channel) {
  return sharp(path)
    .resize(TEXTURE_RESOLUTION, TEXTURE_RESOLUTION, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .extractChannel(channel)
    .raw({ depth: "uchar" })
    .toBuffer();
}

function createTextureArray({ codecArguments, format, inputPaths, ktxBinary, outputPath, transferFunction }) {
  run(ktxBinary, [
    "create",
    "--format",
    format,
    "--layers",
    String(inputPaths.length),
    "--generate-mipmap",
    "--mipmap-filter",
    "lanczos4",
    "--mipmap-wrap",
    "wrap",
    "--assign-tf",
    transferFunction,
    "--assign-primaries",
    "bt709",
    ...codecArguments,
    ...inputPaths,
    outputPath,
  ]);
}

function validateTextureArray(ktxBinary, path) {
  run(ktxBinary, ["validate", "--warnings-as-errors", path]);
}

function validateInputs(manifest, sourceDirectory, ktxBinary) {
  if (!sourceDirectory) throw new Error("Ground texture build requires --source-dir");
  if (!ktxBinary) throw new Error("Ground texture build requires --ktx-bin");
  run(ktxBinary, ["--version"]);
  for (const layer of manifest.layers) {
    for (const mapName of REQUIRED_MAPS) {
      const map = layer.maps[mapName];
      if (!map) throw new Error(`${layer.id} is missing ${mapName} source metadata`);
      const path = join(sourceDirectory, layer.id, map.file);
      const actualHash = createHash("md5").update(readFileSync(path)).digest("hex");
      if (actualHash !== map.md5) throw new Error(`${layer.id}/${mapName} source hash mismatch`);
    }
  }
}

function createRuntimeManifest(sourceManifest, albedoHeightPath, normalMaterialPath) {
  return {
    version: 1,
    resolution: TEXTURE_RESOLUTION,
    layers: sourceManifest.layers.map(({ assetId, assetUrl, id }) => ({ assetId, assetUrl, id })),
    license: sourceManifest.license,
    textures: {
      albedoHeight: describeOutput(albedoHeightPath, "srgb", "RGB=albedo,A=height"),
      normalMaterial: describeOutput(normalMaterialPath, "linear", "RG=normalXY,B=roughness,A=ao"),
    },
  };
}

function describeOutput(path, colorSpace, packing) {
  return {
    bytes: statSync(path).size,
    colorSpace,
    file: path.split("/").at(-1),
    packing,
    sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
  };
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `${command} failed with ${String(result.status)}`);
  }
  return result.stdout.trim();
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
