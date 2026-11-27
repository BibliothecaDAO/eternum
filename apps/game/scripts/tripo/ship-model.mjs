import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import { MeshoptDecoder } from "meshoptimizer";
import { Matrix3, Matrix4, Vector3 } from "three";

import { BEAST_BUDGET } from "../frontier-beasts/beast-budget.mjs";
import { resolveTripoPbr } from "../../src/three/materials/tripo-pbr-rules.mjs";

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PUBLIC_MODELS_ROOT = resolve(APP_ROOT, "public/models");
const TRIPO_SOURCES_ROOT = resolve(APP_ROOT, "asset-sources/tripo");
const GLTF_TRANSFORM = resolve(APP_ROOT, "node_modules/.bin/gltf-transform");
const COMPRESS_MODELS = resolve(APP_ROOT, "scripts/compress-models.mjs");
const MATERIAL_SPEC = JSON.parse(
  readFileSync(resolve(APP_ROOT, "src/three/materials/tripo-model-material.json"), "utf8"),
);
const HEX_APOTHEM = Math.sqrt(3) / 2;
const HEX_TOLERANCE = 0.001;
const TECHNICAL_SLOTS = "{normalTexture,occlusionTexture,metallicRoughnessTexture}";
const COLOR_SLOTS = "{baseColorTexture,emissiveTexture}";

export const MODEL_BUDGETS = Object.freeze({
  building: {
    maxTriangles: 8_000,
    maxColorTexture: 1_024,
    maxTechnicalTexture: 512,
    maxBytes: 600_000,
    maxDraws: 5,
    maxBones: 0,
    minGroundY: -0.05,
    maxGroundY: 0.05,
  },
  troop: {
    maxTriangles: 4_500,
    maxColorTexture: 512,
    maxTechnicalTexture: 512,
    maxBytes: 325_000,
    maxDraws: 5,
    maxBones: 24,
    minGroundY: -0.05,
    maxGroundY: 0.2,
  },
  wonder: {
    maxTriangles: 24_000,
    maxColorTexture: 1_024,
    maxTechnicalTexture: 512,
    maxBytes: 600_000,
    maxDraws: 5,
    maxBones: 0,
    minGroundY: -0.05,
    maxGroundY: 0.05,
    maxHeight: 2.9,
  },
  beast: BEAST_BUDGET,
});

export function readHexFit(fitPath) {
  if (!fitPath || !existsSync(fitPath)) {
    throw new Error(`Missing hex fit file: ${fitPath ?? "(not provided)"}`);
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(fitPath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid JSON in hex fit file ${fitPath}: ${error.message}`);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Hex fit file ${fitPath} must contain a JSON object`);
  }
  if (Object.hasOwn(raw, "flags")) {
    throw new Error(`Hex fit file ${fitPath} must not declare unsupported key "flags"`);
  }
  const transform = raw.transform;
  if (!transform || typeof transform !== "object" || Array.isArray(transform)) {
    throw new Error(`Hex fit file ${fitPath} must contain a transform object`);
  }
  const { scale, offset_xyz: offset, yaw_deg_about_y: yaw = 0 } = transform;
  if (typeof scale !== "number" || !Number.isFinite(scale) || scale <= 0) {
    throw new Error(`Hex fit transform.scale must be a positive finite number in ${fitPath}`);
  }
  if (
    !Array.isArray(offset) ||
    offset.length !== 3 ||
    offset.some((value) => typeof value !== "number" || !Number.isFinite(value))
  ) {
    throw new Error(`Hex fit transform.offset_xyz must be a 3-number array [x, y, z] in ${fitPath}`);
  }
  if (typeof yaw !== "number" || !Number.isFinite(yaw)) {
    throw new Error(`Hex fit transform.yaw_deg_about_y must be a finite number of degrees in ${fitPath}`);
  }
  return { scale, offset: [offset[0], offset[1], offset[2]], yaw };
}

export async function shipTripoModel(options) {
  const inputPath = resolve(options.input);
  const fitPath = resolve(options.fit ?? join(dirname(inputPath), "fit.json"));
  const outPath = resolve(options.out);
  const kind = options.kind;
  const budget = MODEL_BUDGETS[kind];

  if (!existsSync(inputPath)) {
    throw new Error(`Missing input model: ${inputPath}`);
  }
  if (!budget) {
    throw new Error(`Unknown model kind "${kind}". Expected one of: ${Object.keys(MODEL_BUDGETS).join(", ")}`);
  }
  if (inputPath === outPath) {
    throw new Error(`Refusing to overwrite input model in place: ${inputPath}`);
  }

  const fit = readHexFit(fitPath);
  const sourceSha256 = sha256File(inputPath);
  const fitSha256 = sha256File(fitPath);
  const io = await createGltfIO();
  const document = await io.read(inputPath);

  const metrics = assertSourceBudget(document, kind, budget);
  bakeHexFit(document, fit, {
    assetKind: kind,
    fitSha256,
    sourceSha256,
  });
  normalizeTripoMaterials(document, kind);
  const bounds = assertHexFootprint(document, kind, budget);
  stripGeometryCompressionExtensions(document);

  const workDir = mkdtempSync(join(tmpdir(), "eternum-tripo-ship-"));
  try {
    const fittedPath = join(workDir, "fitted.glb");
    const compressedPath = join(workDir, "compressed.glb");
    await io.write(fittedPath, document);
    compressAsset(fittedPath, compressedPath, workDir);
    const delivered = await assertDeliveredAsset(io, compressedPath, kind, budget);
    writeAtomically(compressedPath, outPath);
    return {
      input: inputPath,
      fit: fitPath,
      kind,
      out: outPath,
      bytes: delivered.bytes,
      triangles: metrics.triangles,
      draws: metrics.draws,
      bones: metrics.bones,
      textures: delivered.textures,
      bounds,
      sourceSha256,
      fitSha256,
    };
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

function parseCliArgs(argv) {
  const readOption = (flag) => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const input = readOption("--input");
  const fit = readOption("--fit");
  const kind = readOption("--kind");
  const out = readOption("--out");
  if (!input || !kind || !out) {
    throw new Error("Usage: ship-model.mjs --input <tripo.glb> [--fit <fit.json>] --kind <kind> --out <shipped.glb>");
  }
  return { input, fit, kind, out };
}

async function createGltfIO() {
  await MeshoptDecoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "meshopt.decoder": MeshoptDecoder,
  });
}

function assertSourceBudget(document, kind, budget) {
  const root = document.getRoot();
  const primitives = root.listMeshes().flatMap((mesh) => mesh.listPrimitives());
  if (primitives.length === 0) {
    throw new Error(`Model has no mesh primitives (${kind})`);
  }
  if (primitives.length > budget.maxDraws) {
    throw new Error(`Model draw count ${primitives.length} exceeds ${kind} budget of ${budget.maxDraws}`);
  }
  const triangles = countPrimitivesTriangles(primitives);
  if (triangles === 0) {
    throw new Error(`Model has zero triangles (${kind})`);
  }
  if (triangles > budget.maxTriangles) {
    throw new Error(`Model triangle count ${triangles} exceeds ${kind} budget of ${budget.maxTriangles}`);
  }
  const bones = countSkeletonBones(root);
  if (bones > budget.maxBones) {
    throw new Error(`Model bone count ${bones} exceeds ${kind} budget of ${budget.maxBones}`);
  }
  assertTextureBudgets(root, kind, budget);
  return { triangles, draws: primitives.length, bones };
}

function countPrimitivesTriangles(primitives) {
  let total = 0;
  for (const primitive of primitives) {
    if (primitive.getMode() !== 4) continue;
    const indices = primitive.getIndices();
    const count = indices ? indices.getCount() : (primitive.getAttribute("POSITION")?.getCount() ?? 0);
    total += Math.floor(count / 3);
  }
  return total;
}

function countSkeletonBones(root) {
  const joints = new Set();
  for (const skin of root.listSkins()) {
    for (const joint of skin.listJoints()) joints.add(joint);
  }
  return joints.size;
}

function assertTextureBudgets(root, kind, budget) {
  const slotLimits = collectTextureLimits(root, budget);
  for (const texture of root.listTextures()) {
    const size = readTextureSize(texture);
    if (!size) {
      throw new Error(`Unreadable texture dimensions for "${texture.getName() || "unnamed"}" (${kind})`);
    }
    const [width, height] = size;
    const limit = slotLimits.get(texture) ?? budget.maxColorTexture;
    if (width > limit || height > limit) {
      throw new Error(
        `Texture "${texture.getName() || "unnamed"}" is ${width}x${height}, exceeding ${kind} limit of ${limit}px`,
      );
    }
  }
}

function collectTextureLimits(root, budget) {
  const limits = new Map();
  const assign = (texture, maxDim) => {
    if (!texture) return;
    const previous = limits.get(texture);
    limits.set(texture, previous === undefined ? maxDim : Math.min(previous, maxDim));
  };
  for (const material of root.listMaterials()) {
    assign(material.getBaseColorTexture(), budget.maxColorTexture);
    assign(material.getEmissiveTexture(), budget.maxColorTexture);
    assign(material.getNormalTexture(), budget.maxTechnicalTexture);
    assign(material.getOcclusionTexture(), budget.maxTechnicalTexture);
    assign(material.getMetallicRoughnessTexture(), budget.maxTechnicalTexture);
  }
  return limits;
}

function readTextureSize(texture) {
  if (texture.getMimeType() === "image/ktx2") {
    const image = texture.getImage();
    if (!image || image.byteLength < 28) return null;
    const view = new DataView(image.buffer, image.byteOffset, image.byteLength);
    return [view.getUint32(20, true), view.getUint32(24, true)];
  }
  return texture.getSize();
}

function bakeHexFit(document, fit, metadata) {
  const root = document.getRoot();
  detachSharedMeshes(root);
  const fitMatrix = buildFitMatrix(fit);
  const bakedNodes = root.listNodes().filter((node) => node.getMesh());
  for (const node of bakedNodes) {
    const worldMatrix = new Matrix4().fromArray(node.getWorldMatrix());
    const totalMatrix = fitMatrix.clone().multiply(worldMatrix);
    bakeMeshTransform(node.getMesh(), totalMatrix);
    node.setExtras({ ...node.getExtras(), ...metadata });
  }
  for (const node of root.listNodes()) {
    node.setTranslation([0, 0, 0]);
    node.setRotation([0, 0, 0, 1]);
    node.setScale([1, 1, 1]);
  }
}

function detachSharedMeshes(root) {
  const seen = new Set();
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    if (seen.has(mesh)) {
      node.setMesh(cloneMeshGeometry(mesh));
    } else {
      seen.add(mesh);
    }
  }
}

function cloneMeshGeometry(mesh) {
  const cloned = mesh.clone();
  for (const primitive of cloned.listPrimitives()) {
    for (const semantic of primitive.listSemantics()) {
      const attribute = primitive.getAttribute(semantic);
      if (attribute) primitive.setAttribute(semantic, attribute.clone());
    }
    const indices = primitive.getIndices();
    if (indices) primitive.setIndices(indices.clone());
    for (const target of primitive.listTargets()) {
      for (const semantic of target.listSemantics()) {
        const attribute = target.getAttribute(semantic);
        if (attribute) target.setAttribute(semantic, attribute.clone());
      }
    }
  }
  return cloned;
}

function buildFitMatrix(fit) {
  const rotation = new Matrix4().makeRotationY((fit.yaw * Math.PI) / 180);
  const scale = new Matrix4().makeScale(fit.scale, fit.scale, fit.scale);
  const translation = new Matrix4().makeTranslation(fit.offset[0], fit.offset[1], fit.offset[2]);
  return translation.multiply(scale).multiply(rotation);
}

function bakeMeshTransform(mesh, totalMatrix) {
  const linearMatrix = new Matrix3().setFromMatrix4(totalMatrix);
  const normalMatrix = new Matrix3().getNormalMatrix(totalMatrix);
  const flipped = totalMatrix.determinant() < 0;
  const vec = new Vector3();

  for (const primitive of mesh.listPrimitives()) {
    transformPositionAccessor(primitive.getAttribute("POSITION"), totalMatrix, vec);
    transformNormalAccessor(primitive.getAttribute("NORMAL"), normalMatrix, vec);
    transformTangentAccessor(primitive.getAttribute("TANGENT"), linearMatrix, flipped, vec);
    for (const target of primitive.listTargets()) {
      transformDeltaAccessor(target.getAttribute("POSITION"), linearMatrix, vec);
      transformNormalAccessor(target.getAttribute("NORMAL"), normalMatrix, vec);
    }
    if (flipped) flipPrimitiveWinding(primitive);
  }
}

function transformPositionAccessor(accessor, matrix, vec) {
  if (!accessor) return;
  for (let i = 0; i < accessor.getCount(); i++) {
    const [x, y, z] = accessor.getElement(i, [0, 0, 0]);
    vec.set(x, y, z).applyMatrix4(matrix);
    accessor.setElement(i, [vec.x, vec.y, vec.z]);
  }
}

function transformDeltaAccessor(accessor, linearMatrix, vec) {
  if (!accessor) return;
  for (let i = 0; i < accessor.getCount(); i++) {
    const [x, y, z] = accessor.getElement(i, [0, 0, 0]);
    vec.set(x, y, z).applyMatrix3(linearMatrix);
    accessor.setElement(i, [vec.x, vec.y, vec.z]);
  }
}

function transformNormalAccessor(accessor, normalMatrix, vec) {
  if (!accessor) return;
  for (let i = 0; i < accessor.getCount(); i++) {
    const [x, y, z] = accessor.getElement(i, [0, 0, 0]);
    vec.set(x, y, z).applyMatrix3(normalMatrix);
    if (vec.lengthSq() > 0) vec.normalize();
    accessor.setElement(i, [vec.x, vec.y, vec.z]);
  }
}

function transformTangentAccessor(accessor, linearMatrix, flipped, vec) {
  if (!accessor) return;
  for (let i = 0; i < accessor.getCount(); i++) {
    const [x, y, z, w] = accessor.getElement(i, [0, 0, 0, 1]);
    vec.set(x, y, z).applyMatrix3(linearMatrix);
    if (vec.lengthSq() > 0) vec.normalize();
    accessor.setElement(i, [vec.x, vec.y, vec.z, flipped ? -w : w]);
  }
}

function flipPrimitiveWinding(primitive) {
  if (primitive.getMode() !== 4) return;
  const indices = primitive.getIndices();
  if (indices) {
    for (let i = 0; i + 2 < indices.getCount(); i += 3) {
      const b = indices.getScalar(i + 1);
      const c = indices.getScalar(i + 2);
      indices.setScalar(i + 1, c);
      indices.setScalar(i + 2, b);
    }
    return;
  }
  for (const semantic of primitive.listSemantics()) {
    const accessor = primitive.getAttribute(semantic);
    if (!accessor) continue;
    for (let i = 0; i + 2 < accessor.getCount(); i += 3) {
      const b = accessor.getElement(i + 1, []);
      const c = accessor.getElement(i + 2, []);
      accessor.setElement(i + 1, c);
      accessor.setElement(i + 2, b);
    }
  }
}

function assertHexFootprint(document, kind, budget) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const positions = primitive.getAttribute("POSITION");
      if (!positions) continue;
      for (let i = 0; i < positions.getCount(); i++) {
        const [x, y, z] = positions.getElement(i, [0, 0, 0]);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
          throw new Error(`Model contains non-finite vertex position (${kind})`);
        }
        if (!isInsideHex(x, z)) {
          throw new Error(
            `Fitted ${kind} vertex (${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)}) leaves the unit pointy hex`,
          );
        }
        min[0] = Math.min(min[0], x);
        min[1] = Math.min(min[1], y);
        min[2] = Math.min(min[2], z);
        max[0] = Math.max(max[0], x);
        max[1] = Math.max(max[1], y);
        max[2] = Math.max(max[2], z);
      }
    }
  }
  if (min[1] < budget.minGroundY || min[1] > budget.maxGroundY) {
    throw new Error(
      `Fitted ${kind} minY=${min[1].toFixed(4)} is outside ground range [${budget.minGroundY}, ${budget.maxGroundY}]`,
    );
  }
  if (budget.maxHeight !== undefined && max[1] > budget.maxHeight) {
    throw new Error(`Fitted ${kind} maxY=${max[1].toFixed(4)} exceeds height limit ${budget.maxHeight}`);
  }
  return {
    min: min.map(round3),
    max: max.map(round3),
    size: [round3(max[0] - min[0]), round3(max[1] - min[1]), round3(max[2] - min[2])],
  };
}

function isInsideHex(x, z) {
  for (let side = 0; side < 6; side++) {
    const angle = (side * Math.PI) / 3;
    if (x * Math.cos(angle) + z * Math.sin(angle) > HEX_APOTHEM + HEX_TOLERANCE) return false;
  }
  return true;
}

function normalizeTripoMaterials(document, kind) {
  for (const material of document.getRoot().listMaterials()) {
    const hasMrMap = Boolean(material.getMetallicRoughnessTexture());
    const emissive = material.getEmissiveFactor();
    const resolved = resolveTripoPbr(
      {
        roughness: material.getRoughnessFactor(),
        metalness: material.getMetallicFactor(),
        hasRoughnessMap: hasMrMap,
        hasMetalnessMap: hasMrMap,
        hasNormalMap: Boolean(material.getNormalTexture()),
        normalScaleX: material.getNormalScale(),
        normalScaleY: material.getNormalScale(),
        hasEmissiveMap: Boolean(material.getEmissiveTexture()),
        emissivePeak: Math.max(emissive[0], emissive[1], emissive[2]),
        emissiveIntensity: 1,
      },
      MATERIAL_SPEC,
    );
    material.setRoughnessFactor(resolved.roughness);
    material.setMetallicFactor(resolved.metalness);
    if (resolved.normalScaleX !== null) {
      material.setNormalScale(resolved.normalScaleX);
    }
    if (material.getOcclusionTexture()) {
      material.setOcclusionStrength(resolved.aoMapIntensity);
    }
    if (!resolved.hasEmissiveAccent) {
      material.setEmissiveFactor([0, 0, 0]);
    }
    material.setDoubleSided(resolved.doubleSided);
    material.setExtras({
      ...material.getExtras(),
      tripoMaterial: true,
      ...(kind === "troop" ? { ownershipCloth: true } : {}),
    });
  }
}

function stripGeometryCompressionExtensions(document) {
  for (const extension of document.getRoot().listExtensionsUsed()) {
    if (
      extension.extensionName === "KHR_draco_mesh_compression" ||
      extension.extensionName === "EXT_meshopt_compression"
    ) {
      extension.dispose();
    }
  }
}

function compressAsset(fittedPath, compressedPath, workDir) {
  requireTool(GLTF_TRANSFORM, "Install workspace dependencies before shipping models.");
  const profile = inspectGlbTextureProfile(fittedPath);
  let currentPath = fittedPath;

  if (profile.needsKtxEncoding) {
    requireCommand("ktx", "Install Khronos KTX-Software and put `ktx` on PATH to compress textures.");
    if (profile.hasWebp) {
      const pngPath = join(workDir, "normalized.glb");
      runGltfTransform(["png", currentPath, pngPath, "--formats", "webp", "--slots", "*"]);
      currentPath = pngPath;
    }
    if (profile.hasUncompressedTechnical) {
      const technicalPath = join(workDir, "uastc.glb");
      runGltfTransform([
        "uastc",
        currentPath,
        technicalPath,
        "--slots",
        TECHNICAL_SLOTS,
        "--level",
        "2",
        "--rdo",
        "--rdo-lambda",
        "0.5",
        "--zstd",
        "18",
        "--jobs",
        "2",
      ]);
      currentPath = technicalPath;
    }
    if (profile.hasUncompressedColor) {
      const colorPath = join(workDir, "etc1s.glb");
      runGltfTransform(["etc1s", currentPath, colorPath, "--slots", COLOR_SLOTS, "--quality", "180", "--jobs", "2"]);
      currentPath = colorPath;
    }
  }

  runGltfTransform(["draco", currentPath, compressedPath, "--method", "edgebreaker", "--quantize-position", "20"]);
  execFileSync(process.execPath, [COMPRESS_MODELS, "--stamp-only", "--only", compressedPath], {
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function inspectGlbTextureProfile(glbPath) {
  const bytes = readFileSync(glbPath);
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));
  const images = json.images ?? [];
  const textures = json.textures ?? [];
  const imageOfTexture = (textureIndex) => {
    const texture = textures[textureIndex];
    const imageIndex =
      texture?.source ??
      texture?.extensions?.EXT_texture_webp?.source ??
      texture?.extensions?.KHR_texture_basisu?.source;
    return Number.isInteger(imageIndex) ? images[imageIndex] : undefined;
  };
  let hasWebp = false;
  let hasUncompressedTechnical = false;
  let hasUncompressedColor = false;
  for (const image of images) {
    if (image.mimeType === "image/webp") hasWebp = true;
  }
  for (const material of json.materials ?? []) {
    const pbr = material.pbrMetallicRoughness ?? {};
    for (const ref of [pbr.baseColorTexture, material.emissiveTexture]) {
      if (!ref) continue;
      const image = imageOfTexture(ref.index);
      if (image && image.mimeType !== "image/ktx2") hasUncompressedColor = true;
    }
    for (const ref of [material.normalTexture, material.occlusionTexture, pbr.metallicRoughnessTexture]) {
      if (!ref) continue;
      const image = imageOfTexture(ref.index);
      if (image && image.mimeType !== "image/ktx2") hasUncompressedTechnical = true;
    }
  }
  return {
    hasWebp,
    hasUncompressedTechnical,
    hasUncompressedColor,
    needsKtxEncoding: hasUncompressedTechnical || hasUncompressedColor,
  };
}

function resolveTripoSourcePaths(deliveredPath) {
  const rel = relative(PUBLIC_MODELS_ROOT, resolve(deliveredPath));
  if (!rel || rel.startsWith("..") || !rel.endsWith(".glb")) return null;
  const stem = rel.slice(0, -4);
  return {
    sourceGlb: resolve(TRIPO_SOURCES_ROOT, stem, "source.glb"),
    fitJson: resolve(TRIPO_SOURCES_ROOT, stem, "fit.json"),
  };
}

export async function assertDeliveredAsset(io, deliveredPath, kind, budget = MODEL_BUDGETS[kind]) {
  if (!budget) {
    throw new Error(`Unknown model kind "${kind}". Expected one of: ${Object.keys(MODEL_BUDGETS).join(", ")}`);
  }
  const bytes = statSync(deliveredPath).size;
  if (bytes > budget.maxBytes) {
    throw new Error(`Compressed ${kind} model is ${bytes} bytes, exceeding budget of ${budget.maxBytes} bytes`);
  }
  const document = await io.read(deliveredPath);
  const root = document.getRoot();
  const extensions = root.listExtensionsUsed().map((extension) => extension.extensionName);
  if (!extensions.includes("KHR_draco_mesh_compression")) {
    throw new Error(`Compressed ${kind} model is missing KHR_draco_mesh_compression`);
  }
  const textures = root.listTextures();
  if (textures.length > 0 && !extensions.includes("KHR_texture_basisu")) {
    throw new Error(`Compressed ${kind} model is missing KHR_texture_basisu`);
  }
  for (const texture of textures) {
    if (texture.getMimeType() !== "image/ktx2") {
      throw new Error(`Delivered ${kind} model contains non-KTX2 texture (${texture.getMimeType()})`);
    }
  }
  const metrics = assertSourceBudget(document, kind, budget);
  const meshNodes = root.listNodes().filter((node) => node.getMesh());
  if (meshNodes.length === 0 || !meshNodes.every((node) => node.getExtras()?.assetKind === kind)) {
    throw new Error(`Delivered ${kind} model is missing assetKind="${kind}" on its mesh node`);
  }
  const sourcePaths = resolveTripoSourcePaths(deliveredPath);
  if (sourcePaths) {
    if (!existsSync(sourcePaths.sourceGlb)) {
      throw new Error(`Missing committed source GLB for ${deliveredPath}: ${sourcePaths.sourceGlb}`);
    }
    if (!existsSync(sourcePaths.fitJson)) {
      throw new Error(`Missing committed fit.json for ${deliveredPath}: ${sourcePaths.fitJson}`);
    }
    const expectedSourceSha = sha256File(sourcePaths.sourceGlb);
    const expectedFitSha = sha256File(sourcePaths.fitJson);
    for (const node of meshNodes) {
      if (node.getExtras()?.sourceSha256 !== expectedSourceSha) {
        throw new Error(`Delivered ${kind} model sourceSha256 does not match ${sourcePaths.sourceGlb}`);
      }
      if (node.getExtras()?.fitSha256 !== expectedFitSha) {
        throw new Error(`Delivered ${kind} model fitSha256 does not match ${sourcePaths.fitJson}`);
      }
    }
  }
  for (const material of root.listMaterials()) {
    if (!material.getDoubleSided()) {
      throw new Error(`Delivered ${kind} material "${material.getName() || "unnamed"}" is not double-sided`);
    }
    if (material.getExtras()?.tripoMaterial !== true) {
      throw new Error(`Delivered ${kind} material "${material.getName() || "unnamed"}" is missing tripoMaterial tag`);
    }
  }
  for (const node of root.listNodes()) {
    const t = node.getTranslation();
    const r = node.getRotation();
    const s = node.getScale();
    if (
      t.some((value) => Math.abs(value) > 1e-6) ||
      r.some((value, index) => Math.abs(value - (index === 3 ? 1 : 0)) > 1e-6) ||
      s.some((value) => Math.abs(value - 1) > 1e-6)
    ) {
      throw new Error(`Delivered ${kind} model retains non-identity node transform on "${node.getName()}"`);
    }
  }
  const bounds = assertHexFootprint(document, kind, budget);
  return {
    bytes,
    document,
    root,
    bounds,
    ...metrics,
    textures: textures.map((texture) => ({
      name: texture.getName(),
      mimeType: texture.getMimeType(),
      size: readTextureSize(texture),
    })),
  };
}

function writeAtomically(sourcePath, destinationPath) {
  mkdirSync(dirname(destinationPath), { recursive: true });
  const tempPath = join(dirname(destinationPath), `.ship-model-${process.pid}-${Date.now()}.tmp.glb`);
  try {
    copyFileSync(sourcePath, tempPath);
    renameSync(tempPath, destinationPath);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}

function runGltfTransform(args) {
  const result = spawnSync(GLTF_TRANSFORM, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) {
    throw new Error(`gltf-transform ${args[0]} failed:\n${result.stdout}${result.stderr}`);
  }
}

function requireTool(path, message) {
  if (!existsSync(path)) throw new Error(message);
}

function requireCommand(command, message) {
  const result = spawnSync(command, ["--version"], { stdio: "ignore" });
  if (result.status !== 0) throw new Error(message);
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const summary = await shipTripoModel(parseCliArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}
