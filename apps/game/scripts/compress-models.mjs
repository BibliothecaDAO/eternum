import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modelsRoot = resolve(appRoot, "public/models");
const gltfTransform = resolve(appRoot, "node_modules/.bin/gltf-transform");
const heroModels = new Set([
  "new-buildings-opt/castle0.glb",
  "new-buildings-opt/castle1.glb",
  "new-buildings-opt/castle2.glb",
  "new-buildings-opt/castle3.glb",
  "new-buildings-opt/hyperstructure.glb",
  "new-buildings-opt/hyperstructure_finish.glb",
  "new-buildings-opt/hyperstructure_half.glb",
  "new-buildings-opt/hyperstructure_init.glb",
  "new-buildings-opt/wonder.glb",
  "new-buildings-opt/wonder2.glb",
]);
const precompressedTextureSizeLimits = new Map([
  ["cosmetics/low-res/0x1011401.glb", 1_024],
  ["cosmetics/low-res/0x305011501.glb", 1_024],
  ["cosmetics/low-res/0x4040d01.glb", 1_024],
]);
const technicalTextureSlots = "{normalTexture,occlusionTexture,metallicRoughnessTexture}";
const colorTextureSlots = "{baseColorTexture,emissiveTexture}";
const maxTextureSize = 480;
const heroTextureSize = 768;
const maxModelPayloadBytes = 80 * 1_024 * 1_024;

main();

function main() {
  const args = process.argv.slice(2);
  const requestedModel = readRequestedModel(args);
  const modelPaths = listModelPaths(requestedModel);
  if (args.includes("--stamp-only")) {
    const summary = modelPaths.reduce(
      (result, modelPath) => {
        const stamp = stampTextureContentHashes(modelPath);
        result.stampedTextureCount += stamp.textureCount;
        if (stamp.changed) result.changedModelCount += 1;
        return result;
      },
      { changedModelCount: 0, stampedTextureCount: 0 },
    );
    process.stdout.write(`${JSON.stringify({ modelCount: modelPaths.length, ...summary })}\n`);
    return;
  }

  requireTool(gltfTransform, "Install workspace dependencies before compressing models.");
  requireCommand("ktx", "Install Khronos KTX-Software and put `ktx` on PATH.");

  const beforeBytes = sumFileSizes(modelPaths);
  // Keep the completed output beside the source tree so each final rename is
  // atomic and cannot fail at the cross-filesystem boundary of the OS temp dir.
  const outputRoot = mkdtempSync(join(dirname(modelsRoot), ".model-compression-"));
  const unregisterSignalCleanup = registerSignalCleanup(outputRoot);
  const transformed = [];

  try {
    for (const [index, modelPath] of modelPaths.entries()) {
      const relativePath = relative(modelsRoot, modelPath);
      const outputPath = join(outputRoot, relativePath);
      mkdirSync(dirname(outputPath), { recursive: true });
      process.stdout.write(`[models ${index + 1}/${modelPaths.length}] ${relativePath}\n`);
      transformModel(modelPath, outputPath, relativePath);
      stampTextureContentHashes(outputPath);
      assertCompressedTextures(outputPath, relativePath, resolveTextureSizeLimit(relativePath));
      transformed.push({ outputPath, modelPath });
    }

    if (!requestedModel) {
      assertModelPayloadTarget(transformed.map(({ outputPath }) => outputPath));
    }

    for (const { outputPath, modelPath } of transformed) {
      renameSync(outputPath, modelPath);
    }

    const afterBytes = sumFileSizes(modelPaths);
    process.stdout.write(
      `${JSON.stringify({
        afterBytes,
        beforeBytes,
        modelCount: modelPaths.length,
        reductionPercent: Number((((beforeBytes - afterBytes) / beforeBytes) * 100).toFixed(2)),
      })}\n`,
    );
  } finally {
    unregisterSignalCleanup();
    rmSync(outputRoot, { recursive: true, force: true });
  }
}

function stampTextureContentHashes(modelPath) {
  const glb = readGlb(modelPath);
  const binaryChunk = glb.chunks.find((chunk) => chunk.type === 0x004e4942)?.data;
  if (!binaryChunk) return { changed: false, textureCount: 0 };

  let changed = false;
  let stampedTextureCount = 0;
  for (const image of glb.json.images ?? []) {
    if (!Number.isInteger(image.bufferView)) continue;
    const bufferView = glb.json.bufferViews?.[image.bufferView];
    if (!bufferView) continue;

    const byteOffset = bufferView.byteOffset ?? 0;
    const content = binaryChunk.subarray(byteOffset, byteOffset + bufferView.byteLength);
    const contentHash = createHash("sha256").update(content).digest("hex");
    stampedTextureCount += 1;
    if (image.extras?.eternumContentHash === contentHash) continue;
    image.extras = { ...image.extras, eternumContentHash: contentHash };
    changed = true;
  }

  if (changed) writeGlb(modelPath, glb);
  return { changed, textureCount: stampedTextureCount };
}

function registerSignalCleanup(outputRoot) {
  const handleInterrupt = () => {
    rmSync(outputRoot, { recursive: true, force: true });
    process.exit(130);
  };
  process.once("SIGINT", handleInterrupt);
  process.once("SIGTERM", handleInterrupt);

  return () => {
    process.off("SIGINT", handleInterrupt);
    process.off("SIGTERM", handleInterrupt);
  };
}

function transformModel(modelPath, outputPath, relativePath) {
  const workspace = mkdtempSync(join(tmpdir(), "eternum-model-"));
  try {
    const sourcePath = repairDanglingTextureReferences(modelPath, join(workspace, "repaired.glb"));
    const modelProfile = inspectModelProfile(sourcePath);
    if (modelProfile.isFullyCompressed || modelProfile.textureSlots.size === 0) {
      copyFileSync(sourcePath, outputPath);
      return;
    }

    const normalizedPath = normalizeTextureInput(sourcePath, workspace, modelProfile);
    const resizedPath = resizeTextureInput(normalizedPath, workspace, resolveTextureSizeLimit(relativePath));
    const technicalPath = compressTechnicalTextures(resizedPath, workspace, modelProfile);
    const textureOutputPath = join(workspace, "compressed-textures.glb");
    compressColorTextures(technicalPath, textureOutputPath, modelProfile);
    restoreGeometryCompression(textureOutputPath, outputPath, modelProfile);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

function normalizeTextureInput(sourcePath, workspace, modelProfile) {
  if (!modelProfile.hasWebpTextures) {
    return sourcePath;
  }

  // KTX-Software accepts PNG/JPEG inputs, while much of the current corpus
  // embeds WebP. Normalize before resizing because gltf-transform's resize
  // command intentionally ignores WebP inputs.
  const normalizedPath = join(workspace, "normalized.glb");
  runGltfTransform(["png", sourcePath, normalizedPath, "--formats", "webp", "--slots", "*"]);
  return normalizedPath;
}

function resizeTextureInput(inputPath, workspace, textureSizeLimit) {
  const resizedPath = join(workspace, "texture-input.glb");
  runGltfTransform([
    "resize",
    inputPath,
    resizedPath,
    "--width",
    `${textureSizeLimit}`,
    "--height",
    `${textureSizeLimit}`,
  ]);
  return resizedPath;
}

function compressTechnicalTextures(inputPath, workspace, modelProfile) {
  if (!hasAnyTextureSlot(modelProfile, ["normalTexture", "occlusionTexture", "metallicRoughnessTexture"])) {
    return inputPath;
  }

  const compressedPath = join(workspace, "uastc.glb");
  runGltfTransform([
    "uastc",
    inputPath,
    compressedPath,
    "--slots",
    technicalTextureSlots,
    "--level",
    "2",
    "--rdo",
    "--rdo-lambda",
    "0.5",
    "--zstd",
    "18",
    "--jobs",
    "8",
  ]);
  return compressedPath;
}

function compressColorTextures(inputPath, outputPath, modelProfile) {
  if (!hasAnyTextureSlot(modelProfile, ["baseColorTexture", "emissiveTexture"])) {
    copyFileSync(inputPath, outputPath);
    return;
  }

  runGltfTransform(["etc1s", inputPath, outputPath, "--slots", colorTextureSlots, "--quality", "180", "--jobs", "8"]);
}

function hasAnyTextureSlot(modelProfile, candidates) {
  return candidates.some((slot) => modelProfile.textureSlots.has(slot));
}

function restoreGeometryCompression(inputPath, outputPath, modelProfile) {
  if (modelProfile.hasDracoCompression) {
    runGltfTransform(["draco", inputPath, outputPath]);
    return;
  }

  copyFileSync(inputPath, outputPath);
}

function resolveTextureSizeLimit(relativePath) {
  return (
    precompressedTextureSizeLimits.get(relativePath) ??
    (heroModels.has(relativePath) ? heroTextureSize : maxTextureSize)
  );
}

function repairDanglingTextureReferences(inputPath, repairedPath) {
  const glb = readGlb(inputPath);
  const textures = glb.json.textures ?? [];
  const images = glb.json.images ?? [];
  const validTextureIndices = new Map();
  const validTextures = [];

  textures.forEach((texture, textureIndex) => {
    const imageIndex =
      texture.source ?? texture.extensions?.EXT_texture_webp?.source ?? texture.extensions?.KHR_texture_basisu?.source;
    if (!Number.isInteger(imageIndex) || !images[imageIndex]) {
      return;
    }
    validTextureIndices.set(textureIndex, validTextures.length);
    validTextures.push(texture);
  });

  if (validTextures.length === textures.length) {
    return inputPath;
  }

  glb.json.textures = validTextures;
  rewriteTextureInfoIndices(glb.json.materials, validTextureIndices);
  writeGlb(repairedPath, glb);
  return repairedPath;
}

function rewriteTextureInfoIndices(value, validTextureIndices) {
  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key.endsWith("Texture") && child && typeof child === "object" && Number.isInteger(child.index)) {
      const remappedIndex = validTextureIndices.get(child.index);
      if (remappedIndex === undefined) {
        delete value[key];
        continue;
      }
      child.index = remappedIndex;
    }
    rewriteTextureInfoIndices(child, validTextureIndices);
  }
}

function inspectModelProfile(modelPath) {
  const { json } = readGlb(modelPath);
  const textureSlots = new Set();
  collectTextureSlots(json.materials, textureSlots);
  const images = json.images ?? [];
  return {
    hasDracoCompression: (json.extensionsUsed ?? []).includes("KHR_draco_mesh_compression"),
    hasWebpTextures: images.some((image) => image.mimeType === "image/webp"),
    isFullyCompressed: images.length > 0 && images.every((image) => image.mimeType === "image/ktx2"),
    textureSlots,
  };
}

function assertModelPayloadTarget(outputPaths) {
  const outputBytes = sumFileSizes(outputPaths) + sumNonGlbModelFileSizes(modelsRoot);
  if (outputBytes > maxModelPayloadBytes) {
    throw new Error(
      `Compressed model payload exceeds ${maxModelPayloadBytes} bytes: ${outputBytes} bytes. Sources were not replaced.`,
    );
  }
}

function assertCompressedTextures(modelPath, relativePath, textureSizeLimit) {
  const glb = readGlb(modelPath);
  const profile = inspectModelProfile(modelPath);
  if (profile.textureSlots.size > 0 && !profile.isFullyCompressed) {
    throw new Error(`Model still contains non-KTX2 material textures after conversion: ${relativePath}`);
  }
  if (textureSizeLimit) {
    assertKtxTextureDimensions(glb, relativePath, textureSizeLimit);
  }
}

function assertKtxTextureDimensions(glb, relativePath, textureSizeLimit) {
  const binaryChunk = glb.chunks.find((chunk) => chunk.type === 0x004e4942)?.data;
  if (!binaryChunk) {
    return;
  }

  for (const [imageIndex, image] of (glb.json.images ?? []).entries()) {
    if (image.mimeType !== "image/ktx2" || !Number.isInteger(image.bufferView)) {
      continue;
    }
    const bufferView = glb.json.bufferViews?.[image.bufferView];
    if (!bufferView) {
      throw new Error(`KTX2 image ${imageIndex} has no buffer view in ${relativePath}`);
    }
    const imageOffset = bufferView.byteOffset ?? 0;
    const width = binaryChunk.readUInt32LE(imageOffset + 20);
    const height = binaryChunk.readUInt32LE(imageOffset + 24);
    if (width > textureSizeLimit || height > textureSizeLimit) {
      throw new Error(`KTX2 image ${imageIndex} exceeds ${textureSizeLimit}px in ${relativePath}: ${width}x${height}`);
    }
  }
}

function collectTextureSlots(value, slots) {
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key.endsWith("Texture") && child && typeof child === "object" && Number.isInteger(child.index)) {
      slots.add(key);
    }
    collectTextureSlots(child, slots);
  }
}

function readGlb(modelPath) {
  const buffer = readFileSync(modelPath);
  if (buffer.readUInt32LE(0) !== 0x46546c67 || buffer.readUInt32LE(4) !== 2) {
    throw new Error(`Expected a glTF 2.0 binary: ${modelPath}`);
  }

  const chunks = [];
  let offset = 12;
  let json;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) {
      json = JSON.parse(data.toString("utf8"));
    } else {
      chunks.push({ data, type });
    }
    offset += 8 + length;
  }
  if (!json) {
    throw new Error(`GLB has no JSON chunk: ${modelPath}`);
  }
  return { chunks, json };
}

function writeGlb(modelPath, glb) {
  const jsonContent = Buffer.from(JSON.stringify(glb.json), "utf8");
  const jsonPadding = Buffer.alloc((4 - (jsonContent.length % 4)) % 4, 0x20);
  const jsonChunk = Buffer.concat([jsonContent, jsonPadding]);
  const chunks = [{ data: jsonChunk, type: 0x4e4f534a }, ...glb.chunks];
  const totalLength = 12 + chunks.reduce((sum, chunk) => sum + 8 + chunk.data.length, 0);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const output = [header];
  for (const chunk of chunks) {
    const chunkHeader = Buffer.alloc(8);
    chunkHeader.writeUInt32LE(chunk.data.length, 0);
    chunkHeader.writeUInt32LE(chunk.type, 4);
    output.push(chunkHeader, chunk.data);
  }
  writeFileSync(modelPath, Buffer.concat(output));
}

function runGltfTransform(args) {
  const result = spawnSync(gltfTransform, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status === 0) {
    return;
  }
  throw new Error(`gltf-transform ${args[0]} failed:\n${result.stdout}${result.stderr}`);
}

function listModelPaths(requestedModel) {
  if (requestedModel) {
    const requestedPath = resolve(modelsRoot, requestedModel);
    if (!requestedPath.startsWith(`${modelsRoot}/`) || !existsSync(requestedPath)) {
      throw new Error(`Unknown model path: ${requestedModel}`);
    }
    return [requestedPath];
  }

  const paths = [];
  visitDirectory(modelsRoot, paths);
  return paths.sort((left, right) => statSync(right).size - statSync(left).size);
}

function visitDirectory(directory, paths) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      visitDirectory(entryPath, paths);
    } else if (entry.name.endsWith(".glb")) {
      paths.push(entryPath);
    }
  }
}

function readRequestedModel(args) {
  const onlyIndex = args.indexOf("--only");
  if (onlyIndex === -1) {
    return undefined;
  }
  if (!args[onlyIndex + 1]) {
    throw new Error("--only requires a path relative to apps/game/public/models");
  }
  return args[onlyIndex + 1];
}

function sumFileSizes(paths) {
  return paths.reduce((sum, path) => sum + statSync(path).size, 0);
}

function sumNonGlbModelFileSizes(directory) {
  let totalBytes = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      totalBytes += sumNonGlbModelFileSizes(entryPath);
    } else if (!entry.name.endsWith(".glb")) {
      totalBytes += statSync(entryPath).size;
    }
  }
  return totalBytes;
}

function requireTool(path, message) {
  if (!existsSync(path)) {
    throw new Error(message);
  }
}

function requireCommand(command, message) {
  const result = spawnSync(command, ["--version"], { stdio: "ignore" });
  if (result.status !== 0) {
    throw new Error(message);
  }
}
