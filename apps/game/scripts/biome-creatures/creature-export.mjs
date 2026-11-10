import { Document, NodeIO } from "@gltf-transform/core";

/** How many joints may move one vertex: glTF's first skinning set. */
const INFLUENCES = 4;

/**
 * Binds each vertex to the joints whose solids it lies on: fully to the one under it, sharing with a neighbour as that
 * neighbour's surface comes within `softness`, so the skin bends over a joint instead of creasing.
 */
export function bindSkin(positions, volume, jointNames, softness) {
  const vertexCount = positions.length / 3;
  const joints = new Uint8Array(vertexCount * INFLUENCES);
  const weights = new Float32Array(vertexCount * INFLUENCES);
  const jointIndex = volume.joints.map((name) => {
    const index = jointNames.indexOf(name);
    if (index < 0) throw new Error(`A solid is carried by a joint the rig lacks: ${name}`);
    return index;
  });
  const distances = new Float64Array(volume.joints.length);
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    volume.jointDistances(positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2], distances);
    const pulls = [...distances]
      .map((distance, index) => ({ joint: jointIndex[index], pull: Math.exp(-Math.max(distance, 0) / softness) }))
      .toSorted((a, b) => b.pull - a.pull)
      .slice(0, INFLUENCES);
    const total = pulls.reduce((sum, { pull }) => sum + pull, 0);
    pulls.forEach(({ joint, pull }, slot) => {
      joints[vertex * INFLUENCES + slot] = joint;
      weights[vertex * INFLUENCES + slot] = pull / total;
    });
  }
  return { joints, weights };
}

/**
 * Writes a creature as the game loads it: a `biome-creature-v1` hierarchy of named joints carrying the rig's own
 * metadata, and one skinned mesh over them.
 */
export async function writeCreatureModel(path, creature) {
  const document = new Document();
  const buffer = document.createBuffer();
  const accessor = (type, array) => document.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const material = document
    .createMaterial(`${creature.id}-coat`)
    .setRoughnessFactor(creature.roughness ?? 0.85)
    .setMetallicFactor(0);
  if (creature.coatImage) {
    const texture = document.createTexture(`${creature.id}-coat`).setImage(creature.coatImage).setMimeType("image/png");
    material.setBaseColorTexture(texture);
  }
  const primitive = document
    .createPrimitive()
    .setMaterial(material)
    .setIndices(accessor("SCALAR", creature.mesh.indices))
    .setAttribute("POSITION", accessor("VEC3", creature.mesh.positions))
    .setAttribute("NORMAL", accessor("VEC3", creature.mesh.normals))
    .setAttribute("TEXCOORD_0", accessor("VEC2", creature.mesh.uvs))
    .setAttribute("COLOR_0", accessor("VEC3", creature.mesh.colours))
    .setAttribute("JOINTS_0", accessor("VEC4", creature.skin.joints))
    .setAttribute("WEIGHTS_0", accessor("VEC4", creature.skin.weights));

  const root = document.createNode(`${creature.id}__root`).setExtras({
    joint: "root",
    creature_id: creature.id,
    biome: creature.biome,
    profile: creature.profile,
    animation_schema: "biome-creature-v1",
  });
  const skin = document.createSkin(`${creature.id}-rig`);
  const nodes = new Map();
  const inverseBinds = new Float32Array(creature.joints.length * 16);
  creature.joints.forEach((joint, index) => {
    const parent = creature.joints.find((candidate) => candidate.name === joint.parent);
    const node = document
      .createNode(`${creature.id}__${joint.name}`)
      .setTranslation(joint.at.map((value, axis) => value - (parent ? parent.at[axis] : 0)))
      .setExtras(joint.extras);
    (parent ? nodes.get(parent.name) : root).addChild(node);
    nodes.set(joint.name, node);
    skin.addJoint(node);
    // The rig binds unrotated, so a joint's inverse bind is only its place undone.
    inverseBinds.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -joint.at[0], -joint.at[1], -joint.at[2], 1], index * 16);
  });
  skin.setInverseBindMatrices(accessor("MAT4", inverseBinds));
  root.addChild(
    document
      .createNode(`${creature.id}__skin`)
      .setMesh(document.createMesh(creature.id).addPrimitive(primitive))
      .setSkin(skin),
  );
  document.createScene(creature.id).addChild(root);
  await new NodeIO().write(path, document);
}
