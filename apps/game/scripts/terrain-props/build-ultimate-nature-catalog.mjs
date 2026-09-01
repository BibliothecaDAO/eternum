import { Accessor, Document, NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  center,
  clearNodeParent,
  clearNodeTransform,
  dedup,
  flatten,
  join as joinMeshes,
  mergeDocuments,
  meshopt,
  normals,
  prune,
  simplify,
  unpartition,
  weld,
} from "@gltf-transform/functions";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

import {
  ULTIMATE_NATURE_ARCHIVE_ROOT,
  ULTIMATE_NATURE_ARCHIVE_URL,
  ULTIMATE_NATURE_CANOPY_IDS,
  ULTIMATE_NATURE_CATALOG_VERSION,
  ULTIMATE_NATURE_LICENSE,
  ULTIMATE_NATURE_MAX_GLB_BYTES,
  ULTIMATE_NATURE_PROPS,
  ULTIMATE_NATURE_SOURCE_PAGE,
  getUltimateNatureTriangleBudgets,
  validateUltimateNatureCatalog,
} from "./ultimate-nature-catalog.mjs";
import { assertCanopySilhouetteRetention, extractCanopyGeometry } from "./terrain-prop-silhouette.mjs";

const DEFAULT_OUTPUT_DIR = fileURLToPath(new URL("../../public/models/procedural-terrain/", import.meta.url));
const OUTPUT_GLB_NAME = "ultimate-nature-props.glb";
const OUTPUT_MANIFEST_NAME = "ultimate-nature-props.json";
const OUTPUT_LICENSE_NAME = "LICENSE-CC0.txt";
const IMPORTER_VERSION = 1;
const TRIANGLE_BUDGET_TOLERANCE = 1.1;

export async function buildUltimateNatureCatalog({ archivePath, outputDir = DEFAULT_OUTPUT_DIR }) {
  requireValidCatalog();
  requireFile(archivePath, "Ultimate Nature source archive");
  requireCommand("assimp", ["version"]);
  requireCommand("unzip", ["-v"]);

  const temporaryDirectory = mkdtempSync(join(tmpdir(), "eternum-ultimate-nature-"));
  const sourceDirectory = join(temporaryDirectory, "source");
  const convertedDirectory = join(temporaryDirectory, "converted");
  mkdirSync(sourceDirectory, { recursive: true });
  mkdirSync(convertedDirectory, { recursive: true });

  try {
    extractApprovedSources(archivePath, sourceDirectory);
    const io = createNodeIO();
    const outputDocument = createOutputDocument();
    const entries = [];

    for (const prop of ULTIMATE_NATURE_PROPS) {
      entries.push(await buildPropLods({ convertedDirectory, io, outputDocument, prop, sourceDirectory }));
    }

    await optimizeOutputDocument(outputDocument);
    mkdirSync(outputDir, { recursive: true });
    const outputGlbPath = join(outputDir, OUTPUT_GLB_NAME);
    await io.write(outputGlbPath, outputDocument);

    const outputGlbBytes = statSync(outputGlbPath).size;
    if (outputGlbBytes > ULTIMATE_NATURE_MAX_GLB_BYTES) {
      throw new Error(
        `Optimized prop catalog is ${outputGlbBytes} bytes, budget is ${ULTIMATE_NATURE_MAX_GLB_BYTES} bytes`,
      );
    }

    const licenseSourcePath = join(sourceDirectory, "License.txt");
    const outputLicensePath = join(outputDir, OUTPUT_LICENSE_NAME);
    copyFileSync(licenseSourcePath, outputLicensePath);

    const manifest = buildManifest({
      archivePath,
      entries,
      outputGlbBytes,
      outputGlbPath,
    });
    const outputManifestPath = join(outputDir, OUTPUT_MANIFEST_NAME);
    writeFileSync(outputManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    return {
      manifest,
      outputGlbPath,
      outputLicensePath,
      outputManifestPath,
    };
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

export function buildManifest({ archivePath, entries, outputGlbBytes, outputGlbPath }) {
  return {
    contractVersion: 1,
    catalog: {
      id: "quaternius-ultimate-nature",
      version: ULTIMATE_NATURE_CATALOG_VERSION,
      importerVersion: IMPORTER_VERSION,
    },
    source: {
      title: "Ultimate Nature Pack",
      author: "Quaternius",
      release: "2019-06",
      sourcePage: ULTIMATE_NATURE_SOURCE_PAGE,
      archiveUrl: ULTIMATE_NATURE_ARCHIVE_URL,
      archiveSha256: sha256File(archivePath),
      license: ULTIMATE_NATURE_LICENSE,
    },
    output: {
      file: OUTPUT_GLB_NAME,
      sha256: sha256File(outputGlbPath),
      bytes: outputGlbBytes,
      meshCompression: "EXT_meshopt_compression",
      textures: 0,
      triangleBudgets: getUltimateNatureTriangleBudgets(),
    },
    entries,
  };
}

async function buildPropLods({ convertedDirectory, io, outputDocument, prop, sourceDirectory }) {
  const sourcePath = join(sourceDirectory, prop.sourceFile);
  const convertedPath = join(convertedDirectory, `${prop.id}.glb`);
  convertFbxToGlb(sourcePath, convertedPath);
  const sourceHash = sha256File(sourcePath);
  const lods = {};
  const silhouetteGeometry = {};

  for (const lod of ["near", "far"]) {
    const document = await io.read(convertedPath);
    const targetTriangles = lod === "near" ? prop.nearTriangles : prop.farTriangles;
    const result = await preparePropDocument({ document, lod, prop, targetTriangles });
    appendDocument(outputDocument, document);
    silhouetteGeometry[lod] = result.silhouetteGeometry;
    const { silhouetteGeometry: _silhouetteGeometry, ...manifestResult } = result;
    lods[lod] = manifestResult;
  }

  if (ULTIMATE_NATURE_CANOPY_IDS.includes(prop.id)) {
    assertCanopySilhouetteRetention(prop.id, silhouetteGeometry.near, silhouetteGeometry.far);
  }

  return {
    id: prop.id,
    sourceFile: prop.sourceFile,
    sourceSha256: sourceHash,
    targetHeight: prop.targetHeight,
    windMaterialPattern: prop.windMaterialPattern,
    lods,
  };
}

async function preparePropDocument({ document, lod, prop, targetTriangles }) {
  const runtimeName = `${prop.id}-${lod}`;
  removeNonGeometryResources(document);
  scaleDocumentToHeight(document, prop.targetHeight);
  await document.transform(center({ pivot: "below" }), flatten());
  bakeMaterialsToVertexAttributes(document, prop);
  await document.transform(dedup(), joinMeshes({ keepMeshes: false, keepNamed: false }), prune(), weld());

  const sourceTriangles = countDocumentTriangles(document);
  if (targetTriangles < sourceTriangles) {
    await document.transform(
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: targetTriangles / sourceTriangles,
        error: 1,
      }),
      prune(),
    );
  }

  await document.transform(normals({ overwrite: false }), prune());
  const actualTriangles = countDocumentTriangles(document);
  if (actualTriangles > Math.ceil(targetTriangles * TRIANGLE_BUDGET_TOLERANCE)) {
    throw new Error(`${runtimeName} has ${actualTriangles} triangles, target is ${targetTriangles} (+10% tolerance)`);
  }

  nameSinglePropNode(document, runtimeName);
  const bounds = getDocumentBounds(document);
  return {
    name: runtimeName,
    triangles: actualTriangles,
    vertices: countDocumentVertices(document),
    bounds,
    silhouetteGeometry: extractCanopyGeometry(document.getRoot().listMeshes()[0]),
  };
}

function bakeMaterialsToVertexAttributes(document, prop) {
  const root = document.getRoot();
  const buffer = root.listBuffers()[0] ?? document.createBuffer("terrain-props-buffer");
  const sharedMaterial = document
    .createMaterial("terrain-props-vertex-color")
    .setBaseColorFactor([1, 1, 1, 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(1);
  const windPattern = prop.windMaterialPattern ? new RegExp(prop.windMaterialPattern, "i") : null;

  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute("POSITION");
      if (!position) throw new Error(`${prop.id} primitive is missing POSITION`);
      const sourceMaterial = primitive.getMaterial();
      const sourceColor = sourceMaterial?.getBaseColorFactor() ?? [1, 1, 1, 1];
      const windWeight = windPattern?.test(sourceMaterial?.getName() ?? "") ? 1 : 0;
      const colorArray = new Float32Array(position.getCount() * 4);
      const windArray = new Float32Array(position.getCount());

      for (let index = 0; index < position.getCount(); index += 1) {
        colorArray.set(sourceColor, index * 4);
        windArray[index] = windWeight;
      }

      const color = document
        .createAccessor(`${prop.id}-color`)
        .setBuffer(buffer)
        .setType(Accessor.Type.VEC4)
        .setArray(colorArray);
      const wind = document
        .createAccessor(`${prop.id}-wind`)
        .setBuffer(buffer)
        .setType(Accessor.Type.SCALAR)
        .setArray(windArray);

      for (const semantic of primitive.listSemantics()) {
        if (semantic !== "POSITION") primitive.setAttribute(semantic, null);
      }
      primitive.setAttribute("COLOR_0", color).setAttribute("_WIND_WEIGHT", wind).setMaterial(sharedMaterial);
    }
  }
}

function scaleDocumentToHeight(document, targetHeight) {
  const bounds = getDocumentBounds(document);
  const sourceHeight = bounds.max[1] - bounds.min[1];
  if (!(sourceHeight > 0)) throw new Error("Source model has no measurable height");
  const factor = targetHeight / sourceHeight;

  for (const scene of document.getRoot().listScenes()) {
    for (const node of scene.listChildren()) {
      const scale = node.getScale();
      node.setScale([scale[0] * factor, scale[1] * factor, scale[2] * factor]);
    }
  }
}

function removeNonGeometryResources(document) {
  const root = document.getRoot();
  root.listAnimations().forEach((animation) => animation.dispose());
  root.listCameras().forEach((camera) => camera.dispose());
  root.listSkins().forEach((skin) => skin.dispose());
  root.listTextures().forEach((texture) => texture.dispose());
}

function nameSinglePropNode(document, name) {
  const meshes = document.getRoot().listMeshes();
  const nodes = document
    .getRoot()
    .listNodes()
    .filter((node) => node.getMesh());
  if (meshes.length !== 1 || nodes.length !== 1) {
    throw new Error(`${name} must resolve to one mesh and one mesh node, received ${meshes.length}/${nodes.length}`);
  }
  meshes[0].setName(name);
  clearNodeParent(nodes[0]);
  clearNodeTransform(nodes[0]);
  nodes[0].setName(name);
}

function appendDocument(target, source) {
  mergeDocuments(target, source);
  const scenes = target.getRoot().listScenes();
  const targetScene = scenes.find((scene) => scene.getName() === "TerrainProps");
  if (!targetScene) throw new Error("TerrainProps scene was not retained during merge");

  for (const scene of scenes) {
    if (scene === targetScene) continue;
    scene.listChildren().forEach((node) => targetScene.addChild(node));
    scene.dispose();
  }
}

async function optimizeOutputDocument(document) {
  await MeshoptEncoder.ready;
  document
    .getRoot()
    .listExtensionsUsed()
    .forEach((extension) => extension.dispose());
  await document.transform(dedup(), prune(), unpartition(), meshopt({ encoder: MeshoptEncoder, level: "high" }));
}

function createOutputDocument() {
  const document = new Document();
  document.createBuffer("terrain-props-buffer");
  document.createScene("TerrainProps");
  return document;
}

function createNodeIO() {
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
}

function extractApprovedSources(archivePath, sourceDirectory) {
  const entries = [
    `${ULTIMATE_NATURE_ARCHIVE_ROOT}/License.txt`,
    ...ULTIMATE_NATURE_PROPS.map((prop) => `${ULTIMATE_NATURE_ARCHIVE_ROOT}/FBX/${prop.sourceFile}`),
  ];
  runCommand("unzip", ["-j", archivePath, ...entries, "-d", sourceDirectory]);
  for (const prop of ULTIMATE_NATURE_PROPS) requireFile(join(sourceDirectory, prop.sourceFile), prop.id);
  requireFile(join(sourceDirectory, "License.txt"), "Ultimate Nature license");
}

function convertFbxToGlb(sourcePath, outputPath) {
  runCommand("assimp", ["export", sourcePath, outputPath, "-f", "glb2"]);
}

function getDocumentBounds(document) {
  const scenes = document.getRoot().listScenes();
  if (scenes.length === 0) throw new Error("Document has no scene");
  return getBounds(scenes[0]);
}

function countDocumentTriangles(document) {
  return document
    .getRoot()
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
    .reduce((total, primitive) => {
      const elementCount = primitive.getIndices()?.getCount() ?? primitive.getAttribute("POSITION")?.getCount() ?? 0;
      return total + Math.floor(elementCount / 3);
    }, 0);
}

function countDocumentVertices(document) {
  return document
    .getRoot()
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
    .reduce((total, primitive) => total + (primitive.getAttribute("POSITION")?.getCount() ?? 0), 0);
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function requireValidCatalog() {
  const failures = validateUltimateNatureCatalog();
  if (failures.length > 0) throw new Error(`Invalid Ultimate Nature catalog:\n${failures.join("\n")}`);
}

function requireFile(path, label) {
  if (!path || !existsSync(path)) throw new Error(`${label} was not found: ${path}`);
}

function requireCommand(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error?.code === "ENOENT") throw new Error(`Required command is unavailable: ${command}`);
}

function runCommand(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `${command} failed with status ${result.status}`);
  }
}

function readOption(args, name, fallback = "") {
  const index = args.indexOf(name);
  return index === -1 ? fallback : (args[index + 1] ?? fallback);
}

async function main(args) {
  const requestedArchivePath = readOption(args, "--source-archive");
  if (!requestedArchivePath) throw new Error("--source-archive is required");
  const archivePath = resolve(requestedArchivePath);
  const outputDir = resolve(readOption(args, "--output-dir", DEFAULT_OUTPUT_DIR));
  const result = await buildUltimateNatureCatalog({ archivePath, outputDir });
  console.log(JSON.stringify(result.manifest, null, 2));
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  await main(process.argv.slice(2));
}
