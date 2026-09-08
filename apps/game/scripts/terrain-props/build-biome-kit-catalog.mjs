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
  unpartition,
  weld,
} from "@gltf-transform/functions";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MeshoptEncoder } from "meshoptimizer";
import {
  BIOME_KIT_PROPS,
  BIOME_KIT_CANOPY_IDS,
  BIOME_KIT_MAX_GLB_BYTES,
  validateBiomeKitCatalog,
  getBiomeKitTriangleBudgets,
  resolveBiomeKitWindWeight,
} from "./biome-kit-catalog.mjs";
import { assertCanopySilhouetteRetention, extractCanopyGeometry } from "./terrain-prop-silhouette.mjs";
const DEFAULT_OUTPUT_DIR = fileURLToPath(new URL("../../public/models/procedural-terrain/", import.meta.url));
const OUTPUT_GLB_NAME = "biome-kit-props.glb";
const TRIANGLE_BUDGET_TOLERANCE = 1.1;

export async function buildBiomeKitCatalog({ sourceDir, outputDir = DEFAULT_OUTPUT_DIR }) {
  const failures = validateBiomeKitCatalog();
  if (failures.length) throw new Error(failures.join("\n"));
  const sourceManifest = JSON.parse(readFileSync(join(sourceDir, "manifest.json"), "utf8"));
  if (sourceManifest.name !== "BIOME / 16" || sourceManifest.version !== "1.0.0")
    throw new Error("Unsupported biome kit manifest");
  const io = createNodeIO();
  const outputDocument = createOutputDocument();
  const entries = [];
  for (const prop of BIOME_KIT_PROPS) entries.push(await buildPropLods({ sourceDir, io, outputDocument, prop }));
  await optimizeOutputDocument(outputDocument);
  return writeCatalogArtifacts({ io, outputDocument, outputDir, sourceDir, sourceManifest, entries });
}

async function writeCatalogArtifacts({ io, outputDocument, outputDir, sourceDir, sourceManifest, entries }) {
  const binary = await io.writeBinary(outputDocument);
  if (binary.byteLength > BIOME_KIT_MAX_GLB_BYTES)
    throw new Error(`Biome prop catalog exceeds transfer budget: ${binary.byteLength}`);
  const manifest = buildCatalogManifest({ sourceDir, sourceManifest, entries, binary });
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, OUTPUT_GLB_NAME), binary);
  writeFileSync(join(outputDir, "biome-kit-props.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

function buildCatalogManifest({ sourceDir, sourceManifest, entries, binary }) {
  return {
    contractVersion: 1,
    catalog: { id: "biome-16", version: 1, importerVersion: 1 },
    source: {
      title: sourceManifest.name,
      version: sourceManifest.version,
      manifestSha256: sha256File(join(sourceDir, "manifest.json")),
      provenance: "User-supplied original procedural artwork; see SOURCE.md",
    },
    output: {
      file: OUTPUT_GLB_NAME,
      sha256: createHash("sha256").update(binary).digest("hex"),
      bytes: binary.byteLength,
      meshCompression: "EXT_meshopt_compression",
      textures: 0,
      triangleBudgets: getBiomeKitTriangleBudgets(),
    },
    entries,
  };
}

async function buildPropLods({ sourceDir, io, outputDocument, prop }) {
  const lods = {},
    silhouetteGeometry = {},
    sources = {};
  for (const [lod, sourceLod] of [
    ["near", 1],
    ["far", 2],
  ]) {
    const sourceFile = `glb/props/${prop.sourceId}.lod${sourceLod}.glb`;
    const sourcePath = join(sourceDir, sourceFile);
    const document = await io.read(sourcePath);
    const result = await preparePropDocument({
      document,
      lod,
      prop,
      targetTriangles: lod === "near" ? prop.nearTriangles : prop.farTriangles,
    });
    appendDocument(outputDocument, document);
    const { silhouetteGeometry: geometry, ...details } = result;
    lods[lod] = details;
    silhouetteGeometry[lod] = geometry;
    sources[lod] = { file: sourceFile, sha256: sha256File(sourcePath) };
  }
  if (BIOME_KIT_CANOPY_IDS.includes(prop.id))
    assertCanopySilhouetteRetention(prop.id, silhouetteGeometry.near, silhouetteGeometry.far);
  return {
    id: prop.id,
    sourceId: prop.sourceId,
    sources,
    targetHeight: prop.targetHeight,
    windMode: prop.windMode,
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

  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute("POSITION");
      if (!position) throw new Error(`${prop.id} primitive is missing POSITION`);
      const sourceMaterial = primitive.getMaterial();
      const sourceColor = sourceMaterial?.getBaseColorFactor() ?? [1, 1, 1, 1];
      const sourceVertexColor = primitive.getAttribute("COLOR_0");
      if (!sourceVertexColor) throw new Error(`${prop.id} is missing authored vertex colors`);
      const colorArray = new Float32Array(position.getCount() * 4);
      const windArray = new Float32Array(position.getCount());

      for (let index = 0; index < position.getCount(); index += 1) {
        const vertex = sourceVertexColor.getElement(index, []);
        const rgba = [
          vertex[0] * sourceColor[0],
          vertex[1] * sourceColor[1],
          vertex[2] * sourceColor[2],
          (vertex[3] ?? 1) * sourceColor[3],
        ];
        colorArray.set(rgba, index * 4);
        windArray[index] = resolveBiomeKitWindWeight(prop.windMode, rgba);
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
        if (semantic !== "POSITION" && semantic !== "NORMAL") primitive.setAttribute(semantic, null);
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

function option(args, name, fallback = "") {
  const index = args.indexOf(name);
  return index < 0 ? fallback : (args[index + 1] ?? fallback);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sourceDir = option(process.argv.slice(2), "--source-dir");
  if (!sourceDir) throw new Error("--source-dir is required");
  console.log(
    JSON.stringify(
      await buildBiomeKitCatalog({
        sourceDir: resolve(sourceDir),
        outputDir: resolve(option(process.argv.slice(2), "--output-dir", DEFAULT_OUTPUT_DIR)),
      }),
      null,
      2,
    ),
  );
}
