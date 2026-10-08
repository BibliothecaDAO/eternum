// Checks the four T1 Knight Default GLBs (structure, the 31 joints by name and order, weights, embedded maps) and
// prints one line per file. Any failed check exits non-zero.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import sharp from "sharp";

// Order of runtime-fit.json body.joint_order: the 25 core joints, then the six driven helper joints.
const skinJoints = [
  "root",
  "pelvis",
  "spine_01",
  "spine_02",
  "spine_03",
  "clavicle_l",
  "upperarm_l",
  "lowerarm_l",
  "hand_l",
  "clavicle_r",
  "upperarm_r",
  "lowerarm_r",
  "hand_r",
  "neck_01",
  "Head",
  "thigh_l",
  "calf_l",
  "foot_l",
  "ball_l",
  "ball_leaf_l",
  "thigh_r",
  "calf_r",
  "foot_r",
  "ball_r",
  "ball_leaf_r",
  "elbow_half_l",
  "elbow_half_r",
  "knee_half_l",
  "knee_half_r",
  "upperarm_twist_l",
  "upperarm_twist_r",
];
const files = ["near/skin.glb", "near/sword.glb", "near/shield.glb", "mid/skin.glb"];
const assetRoot = resolve(process.cwd(), "public/models/characters/t1-knight-default");
const componentWidths = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
const componentCounts = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const readers = {
  5121: (view, offset) => view.getUint8(offset),
  5123: (view, offset) => view.getUint16(offset, true),
  5125: (view, offset) => view.getUint32(offset, true),
  5126: (view, offset) => view.getFloat32(offset, true),
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseGlb(bytes, name) {
  assert(bytes.readUInt32LE(0) === 0x46546c67, name + ": invalid GLB magic");
  assert(bytes.readUInt32LE(4) === 2, name + ": GLB version is not 2");
  assert(bytes.readUInt32LE(8) === bytes.length, name + ": declared byte length mismatch");
  const jsonLength = bytes.readUInt32LE(12);
  assert(bytes.readUInt32LE(16) === 0x4e4f534a, name + ": missing JSON chunk");
  const binaryOffset = 20 + jsonLength;
  assert(bytes.readUInt32LE(binaryOffset + 4) === 0x004e4942, name + ": missing BIN chunk");
  const binaryLength = bytes.readUInt32LE(binaryOffset);
  assert(binaryOffset + 8 + binaryLength === bytes.length, name + ": trailing or truncated chunks");
  const document = JSON.parse(bytes.subarray(20, binaryOffset).toString("utf8"));
  assert(document.buffers?.length === 1, name + ": expected one embedded buffer");
  assert(document.buffers[0].byteLength <= binaryLength, name + ": declared buffer exceeds BIN chunk");
  return { document, binary: bytes.subarray(binaryOffset + 8) };
}

function accessorReader(document, binary, index) {
  const accessor = document.accessors[index];
  assert(accessor && accessor.bufferView !== undefined && !accessor.sparse, "unsupported accessor " + index);
  const bufferView = document.bufferViews[accessor.bufferView];
  const width = componentWidths[accessor.componentType];
  const components = componentCounts[accessor.type];
  assert(width && components && readers[accessor.componentType], "unsupported accessor encoding " + index);
  const stride = bufferView.byteStride ?? width * components;
  const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  assert(
    start + (accessor.count - 1) * stride + width * components <= binary.length,
    "accessor out of bounds " + index,
  );
  const view = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
  return {
    count: accessor.count,
    components,
    read: (row, component) => readers[accessor.componentType](view, start + row * stride + component * width),
  };
}

function inspectScene(document, name) {
  assert(document.scenes?.length === 1 && document.scene === 0, name + ": expected one selected scene");
  const nodes = document.nodes ?? [];
  const roots = document.scenes[0].nodes ?? [];
  assert(roots.length === 1, name + ": expected one selected scene root");
  const seen = new Set();
  const visit = (index) => {
    assert(index >= 0 && index < nodes.length && !seen.has(index), name + ": bad or repeated scene node");
    seen.add(index);
    for (const child of nodes[index].children ?? []) visit(child);
  };
  for (const root of roots) visit(root);
  assert(seen.size === nodes.length, name + ": unselected/exported node exists");
  return { rootCount: roots.length, selectedNodes: seen.size };
}

function inspectGeometry(document, binary, name, skinned) {
  assert(document.meshes?.length === 1, name + ": expected one mesh");
  const primitives = document.meshes[0].primitives;
  assert(primitives?.length === 1, name + ": expected one primitive");
  const primitive = primitives[0];
  assert((primitive.mode ?? 4) === 4, name + ": not triangles");
  const positions = accessorReader(document, binary, primitive.attributes.POSITION);
  const normals = accessorReader(document, binary, primitive.attributes.NORMAL);
  const uvs = accessorReader(document, binary, primitive.attributes.TEXCOORD_0);
  const indices = accessorReader(document, binary, primitive.indices);
  assert(positions.count > 0 && indices.count > 0 && indices.count % 3 === 0, name + ": empty/non-triangle geometry");
  assert(normals.count === positions.count && uvs.count === positions.count, name + ": attribute count mismatch");
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let row = 0; row < positions.count; row++) {
    for (const [reader, components] of [
      [positions, 3],
      [normals, 3],
      [uvs, 2],
    ]) {
      for (let component = 0; component < components; component++) {
        const value = reader.read(row, component);
        assert(Number.isFinite(value), name + ": non-finite vertex attribute");
        if (reader === positions) {
          bounds.min[component] = Math.min(bounds.min[component], value);
          bounds.max[component] = Math.max(bounds.max[component], value);
        }
      }
    }
  }
  for (let row = 0; row < indices.count; row++) {
    assert(indices.read(row, 0) < positions.count, name + ": out-of-range triangle index");
  }
  // glTF samplers default to REPEAT, so UVs outside 0..1 are valid tiling and are not checked.
  if (skinned) {
    assert(
      document.skins?.length === 1 && document.skins[0].joints.length === skinJoints.length,
      name + ": expected " + skinJoints.length + "-joint skin",
    );
    const jointNames = document.skins[0].joints.map((node) => document.nodes[node]?.name);
    assert(
      jointNames.every((jointName, index) => jointName === skinJoints[index]),
      name + ": skin joint names or order differ from the Knight skeleton",
    );
    const joints = accessorReader(document, binary, primitive.attributes.JOINTS_0);
    const weights = accessorReader(document, binary, primitive.attributes.WEIGHTS_0);
    assert(
      joints.count === positions.count && weights.count === positions.count,
      name + ": skin attribute count mismatch",
    );
    assert(joints.components === 4 && weights.components === 4, name + ": expected four skin influences");
    let maximumError = 0;
    for (let row = 0; row < positions.count; row++) {
      let sum = 0;
      for (let component = 0; component < 4; component++) {
        const joint = joints.read(row, component);
        const weight = weights.read(row, component);
        assert(
          joint < skinJoints.length && Number.isFinite(weight) && weight >= 0 && weight <= 1,
          name + ": invalid joint or weight",
        );
        sum += weight;
      }
      assert(sum > 0, name + ": zero-weight vertex");
      maximumError = Math.max(maximumError, Math.abs(sum - 1));
    }
    assert(maximumError < 1e-5, name + ": unnormalized vertex weights");
    const inverseBinds = accessorReader(document, binary, document.skins[0].inverseBindMatrices);
    assert(
      inverseBinds.count === skinJoints.length && inverseBinds.components === 16,
      name + ": inverse bind count mismatch",
    );
    for (let row = 0; row < inverseBinds.count; row++) {
      for (let component = 0; component < 16; component++) {
        assert(Number.isFinite(inverseBinds.read(row, component)), name + ": non-finite inverse bind");
      }
    }
  } else {
    assert(!document.skins && primitive.attributes.JOINTS_0 === undefined, name + ": rigid item has a skin");
  }
  return { vertices: positions.count, triangles: indices.count / 3, topY: bounds.max[1] };
}

async function inspectTextures(document, binary, name) {
  assert(document.materials?.length === 1, name + ": expected one PBR material");
  const material = document.materials[0];
  const roles = {
    normal: material.normalTexture?.index,
    color: material.pbrMetallicRoughness?.baseColorTexture?.index,
    orm: material.pbrMetallicRoughness?.metallicRoughnessTexture?.index,
  };
  assert(
    Object.values(roles).every((index) => Number.isInteger(index)),
    name + ": missing PBR map role",
  );
  assert(new Set(Object.values(roles)).size === 3, name + ": PBR map roles are not distinct");
  const textures = [];
  for (const [role, index] of Object.entries(roles)) {
    const imageIndex = document.textures[index]?.source;
    const image = document.images?.[imageIndex];
    assert(image?.mimeType === "image/png" && image.bufferView !== undefined, name + ": missing embedded PNG");
    const bufferView = document.bufferViews[image.bufferView];
    const start = bufferView.byteOffset ?? 0;
    const bytes = binary.subarray(start, start + bufferView.byteLength);
    const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = decoded.info;
    assert(width > 0 && height > 0 && channels === 4, name + ": invalid decoded texture");
    assert(decoded.data.length === width * height * 4, name + ": decoded texture byte mismatch");
    if (role === "orm" && !Number.isInteger(material.occlusionTexture?.index)) {
      // The ORM image carries occlusion in its red channel; unbound, it must be plain white.
      for (let offset = 0; offset < decoded.data.length; offset += 4) {
        assert(
          decoded.data[offset] === 255,
          name + ": ORM red channel holds occlusion, but occlusionTexture is not bound",
        );
      }
    }
    textures.push({ role, width, height });
  }
  return textures;
}

async function inspectFile(relativePath) {
  const bytes = readFileSync(resolve(assetRoot, relativePath));
  const name = relativePath;
  const { document, binary } = parseGlb(bytes, name);
  const skinned = relativePath.endsWith("skin.glb");
  assert(!document.animations || document.animations.length === 0, name + ": authored clips present");
  inspectScene(document, name);
  const geometry = inspectGeometry(document, binary, name, skinned);
  const textures = await inspectTextures(document, binary, name);
  return {
    file: relativePath,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    skinJoints: document.skins?.[0]?.joints.length ?? 0,
    triangles: geometry.triangles,
    vertices: geometry.vertices,
    topY: geometry.topY,
    maps: textures.map(({ role, width, height }) => `${role} ${width}x${height}`).join(", "),
  };
}

const assets = [];
for (const file of files) assets.push(await inspectFile(file));
for (const asset of assets) {
  process.stdout.write(
    `${asset.file}: ok, ${asset.triangles} triangles, ${asset.vertices} vertices, ${asset.skinJoints} joints, ` +
      `top y ${asset.topY.toFixed(4)}, ${asset.bytes} bytes, sha256 ${asset.sha256.slice(0, 12)}, maps ${asset.maps}\n`,
  );
}
