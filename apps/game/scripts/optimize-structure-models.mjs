import { execFileSync } from "node:child_process";
import { readFileSync, renameSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const app = new URL("../", import.meta.url);
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
  execFileSync(process.execPath, [fileURLToPath(new URL("scripts/compress-models.mjs", app)), "--only", model], {
    stdio: "inherit",
  });
  // Draco preserves the baked transforms required by the instanced structure renderer.
  execFileSync(
    fileURLToPath(new URL("node_modules/.bin/gltf-transform", app)),
    ["draco", input, output, "--method", "edgebreaker"],
    { stdio: "inherit" },
  );
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
  if (document.nodes.some((node) => node.scale?.some((value) => value !== 1))) {
    throw new Error(`${model}: scaled nodes are incompatible with structure instancing`);
  }
  const primitives = document.meshes.flatMap((mesh) => mesh.primitives);
  return {
    model,
    bytes: bytes.length,
    drawCalls: primitives.length,
    triangles: primitives.reduce((sum, primitive) => sum + document.accessors[primitive.indices].count / 3, 0),
    textures: document.images.length,
    compression: document.extensionsUsed,
  };
}
