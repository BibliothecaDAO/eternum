import { execFileSync } from "node:child_process";
import { readFileSync, renameSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const app = new URL("../", import.meta.url);
const gltfTransform = fileURLToPath(new URL("node_modules/.bin/gltf-transform", app));
const verifyOnly = process.argv.includes("--verify");
const models = process.argv.slice(2).filter((argument) => argument !== "--verify");
if (models.length === 0) throw new Error("Provide model paths relative to public/models");
for (const model of models) {
  if (!verifyOnly) optimizeModel(model);
  console.log(JSON.stringify(inspectCompressedModel(model)));
}

function optimizeModel(model) {
  const input = fileURLToPath(new URL(`public/models/${model}`, app));
  const output = input.replace(/\.glb$/, ".compressed.glb");
  const beforeBytes = statSync(input).size;
  if (model === "ethereal/spire.glb") {
    // Retain the hierarchy and zero-scale current resets; only remove redundant keys.
    execFileSync(gltfTransform, ["resample", input, output, "--tolerance", "0.000001"], { stdio: "inherit" });
    renameSync(output, input);
  }
  execFileSync(process.execPath, [fileURLToPath(new URL("scripts/compress-models.mjs", app)), "--only", model], {
    stdio: "inherit",
  });
  // Draco compresses geometry without flattening the spire's animated hierarchy.
  execFileSync(gltfTransform, ["draco", input, output, "--method", "edgebreaker"], { stdio: "inherit" });
  renameSync(output, input);
  console.log(JSON.stringify({ model, beforeBytes, afterBytes: statSync(input).size }));
}

function inspectCompressedModel(model) {
  const bytes = readFileSync(new URL(`public/models/${model}`, app));
  if (bytes.toString("ascii", 0, 4) !== "glTF") throw new Error(`${model}: expected GLB`);
  const document = JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
  for (const extension of ["KHR_draco_mesh_compression", "KHR_texture_basisu"]) {
    if (!document.extensionsUsed?.includes(extension)) throw new Error(`${model}: missing ${extension}`);
  }
  if (document.images.some((image) => image.mimeType !== "image/ktx2")) {
    throw new Error(`${model}: texture is not GPU compressed`);
  }
  const animatedSpire = model === "ethereal/spire.glb";
  if (animatedSpire) verifySpire(document, model);
  if (
    document.nodes.some(
      (node) =>
        node.scale?.some((value) => value !== 1) &&
        !(animatedSpire && node.mesh === undefined && node.extras?.spirePart === "portalCurrent"),
    )
  ) {
    throw new Error(`${model}: scaled nodes are incompatible with structure instancing`);
  }
  const primitives = document.meshes.flatMap((mesh) => mesh.primitives);
  return {
    model,
    bytes: bytes.length,
    drawCalls: primitives.length,
    triangles: primitives.reduce((sum, primitive) => sum + document.accessors[primitive.indices].count / 3, 0),
    textures: document.images.length,
    materials: document.materials.length,
    animations: document.animations?.map(({ name, channels }) => ({ name, channels: channels.length })) ?? [],
    compression: document.extensionsUsed,
  };
}

function verifySpire(document, model) {
  const fail = (message) => {
    throw new Error(`${model}: ${message}`);
  };
  const nodes = document.nodes;
  if (nodes.filter((node) => node.extras?.trueSphereRadius === 0.3).length !== 1)
    fail("requires one spherical portal core with its radius metadata");
  if (!nodes.some((node) => node.extras?.portalTransparencyMode === "split-depth-additive-v1"))
    fail("missing portal composition policy");
  if (nodes.filter((node) => node.extras?.spirePart === "portalCurrent").length !== 6)
    fail("requires six animated inward currents");
  if (document.animations?.length !== 1 || document.animations[0].name !== "Spire_Loop")
    fail("requires the authored Spire_Loop animation");
  const clip = document.animations[0];
  const duration = Math.max(...clip.samplers.map((sampler) => document.accessors[sampler.input].max[0]));
  if (Math.abs(duration - 8) > 0.000001) fail("animation must retain its eight-second loop");
  for (const [index, node] of nodes.entries()) {
    if (node.extras?.spirePart !== "portalCurrent") continue;
    if (!clip.channels.some((channel) => channel.target.node === index && channel.target.path === "scale"))
      fail("inward current is missing its animated scale/reset envelope");
  }
}
