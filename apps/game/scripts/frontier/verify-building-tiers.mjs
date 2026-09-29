/** Guard source textures, animation, transforms and the tier delivery budgets. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco from "draco3dgltf";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco.createDecoderModule(),
});
const models = new URL("../../public/models/", import.meta.url);
for (const family of ["farm", "barracks", "storehouse", "workers-hut"]) await verifyFamily(family);

async function verifyFamily(family) {
  const source = await readModel(`new-buildings-opt/${family.replace("-", "_")}.glb`);
  for (const tier of [2, 3]) {
    const variant = await readModel(`frontier/buildings/${family}-${tier}.glb`);
    assert.deepEqual(
      textureHashes(variant).slice(0, source.listTextures().length),
      textureHashes(source),
      `${family}: texture payload changed`,
    );
    assert.deepEqual(animationSignature(variant), animationSignature(source), `${family}: authored motion changed`);
    const originalNodes = variant.listNodes().slice(0, source.listNodes().length);
    assert.deepEqual(
      originalNodes.map(nodeTransform),
      source.listNodes().map(nodeTransform),
      `${family}: source hierarchy changed`,
    );
    const originalCost = modelCost(source),
      variantCost = modelCost(variant);
    assert.equal(variantCost.draws, originalCost.draws, `${family}: added a material draw`);
    assert.ok(variantCost.triangles <= originalCost.triangles * 1.15, `${family}: exceeds triangle budget`);
    assert.equal(variant.listTextures().length, source.listTextures().length + (tier === 3 ? 1 : 0));
    console.log(`${family}-${tier}: textures, motion, source transforms and triangle/draw budgets passed`);
  }
}

async function readModel(path) {
  return (await io.read(fileURLToPath(new URL(path, models)))).getRoot();
}

function textureHashes(root) {
  return root.listTextures().map((texture) => createHash("sha256").update(texture.getImage()).digest("hex"));
}

function nodeTransform(node) {
  return {
    name: node.getName(),
    translation: node.getTranslation(),
    rotation: node.getRotation(),
    scale: node.getScale(),
  };
}

function animationSignature(root) {
  return root.listAnimations().map((animation) => ({
    name: animation.getName(),
    channels: animation.listChannels().map((channel) => ({
      target: channel.getTargetNode().getName(),
      path: channel.getTargetPath(),
      interpolation: channel.getSampler().getInterpolation(),
      times: Array.from(channel.getSampler().getInput().getArray()),
      values: Array.from(channel.getSampler().getOutput().getArray()),
    })),
  }));
}

function modelCost(root) {
  const primitives = root.listMeshes().flatMap((mesh) => mesh.listPrimitives());
  return {
    draws: primitives.length,
    triangles: primitives.reduce((sum, primitive) => sum + primitive.getIndices().getCount() / 3, 0),
  };
}
