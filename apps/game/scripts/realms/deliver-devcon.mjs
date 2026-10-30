import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco from "draco3dgltf";

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "draco3d.decoder": await draco.createDecoderModule() });

const game = fileURLToPath(new URL("../../", import.meta.url));
const read = async (path) => JSON.parse(await readFile(`${game}/${path}`, "utf8"));
const skins = await read("src/three/structures/realm-skins.json");
const tiers = (await read("src/three/structures/realm-assets.json")).filter((asset) => !asset.wonder);
for (const { directory } of Object.values(skins)) {
  for (const { id } of tiers) {
    const source = await readFile(`${game}/asset-sources/realms/devcon/${directory}/${id}.glb`);
    const delivery = await withLeftOwnershipBanner(source);
    const output = `${game}/public/models/realms/devcon/${directory}`;
    const path = `${output}/${id}.glb`;
    if (process.argv.includes("--check")) {
      if (!(await readFile(path)).equals(delivery)) throw new Error(`Stale Devcon delivery: ${path}`);
    } else {
      await mkdir(output, { recursive: true });
      await writeFile(path, delivery);
    }
  }
}

/** Preserve compressed architecture and cloth; only the detached right standard needs new geometry accessors. */
async function withLeftOwnershipBanner(source) {
  const jsonLength = source.readUInt32LE(12);
  const gltf = JSON.parse(source.subarray(20, 20 + jsonLength).toString());
  let binary = source.subarray(28 + jsonLength);
  const right = gltf.nodes.findIndex((node) => node.name === "Devcon diamond banner 2");
  if (right !== -1) {
    binary = await removeRightStandard(source, gltf, binary);
    removeRightCloth(gltf, right);
  }
  const banners = gltf.nodes.filter((node) => node.name?.startsWith("Devcon diamond banner"));
  if (!banners.length) throw new Error("Devcon realm has no separate banner cloth");
  for (const banner of banners) banner.extras = { ...banner.extras, orderCloth: "banner" };
  const json = Buffer.from(JSON.stringify(gltf));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(padded);
  const header = Buffer.from(source.subarray(0, 20));
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binary.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  header.writeUInt32LE(28 + padded.length + binary.length, 8);
  header.writeUInt32LE(padded.length, 12);
  return Buffer.concat([header, padded, binHeader, binary]);
}

function removeRightCloth(gltf, right) {
  const node = gltf.nodes[right];
  if (right !== gltf.nodes.length - 1 || node.mesh !== gltf.meshes.length - 1 || node.children?.length)
    throw new Error("Expected the separate right banner to be the final leaf mesh");
  gltf.nodes.pop();
  gltf.meshes.pop();
  for (const scene of gltf.scenes) scene.nodes = scene.nodes.filter((index) => index !== right);
}

async function removeRightStandard(source, gltf, binary) {
  const document = await io.readBinary(source);
  const meshIndex = gltf.nodes.find((node) => node.name.endsWith(" architecture")).mesh;
  const primitiveIndex = gltf.meshes[meshIndex].primitives.findIndex(
    (primitive) => gltf.materials[primitive.material].name === "Devcon brass standards",
  );
  if (primitiveIndex === -1) throw new Error("Missing separate brass standards material");
  const original = document.getRoot().listMeshes()[meshIndex].listPrimitives()[primitiveIndex];
  const kept = leftStandardIndices(original);
  const vertices = [...new Set(kept)];
  const remap = new Map(vertices.map((index, slot) => [index, slot]));
  const primitive = gltf.meshes[meshIndex].primitives[primitiveIndex];
  for (const semantic of Object.keys(primitive.attributes)) {
    const accessor = original.getAttribute(semantic);
    const size = accessor.getElementSize();
    const values = new Float32Array(
      vertices.flatMap((index) => Array.from(accessor.getArray().subarray(index * size, (index + 1) * size))),
    );
    const written = appendAccessor(gltf, binary, values, 5126, accessor.getType(), size);
    primitive.attributes[semantic] = written.index;
    binary = written.binary;
  }
  const written = appendAccessor(
    gltf,
    binary,
    new Uint16Array(kept.map((index) => remap.get(index))),
    5123,
    "SCALAR",
    1,
  );
  primitive.indices = written.index;
  delete primitive.extensions;
  return written.binary;
}

function leftStandardIndices(primitive) {
  const positions = primitive.getAttribute("POSITION").getArray();
  const indices = primitive.getIndices().getArray();
  const kept = [];
  for (let i = 0; i < indices.length; i += 3) {
    const face = Array.from(indices.subarray(i, i + 3));
    const left = face.map((index) => positions[index * 3] < 0);
    if (left.every(Boolean)) kept.push(...face);
    else if (left.some(Boolean)) throw new Error("A standard crosses the left/right roof boundary");
  }
  if (!kept.length || kept.length === indices.length) throw new Error("Expected separate left and right standards");
  return kept;
}

function appendAccessor(gltf, binary, values, componentType, type, size) {
  const bytes = Buffer.from(values.buffer, values.byteOffset, values.byteLength);
  const padded = Buffer.alloc(Math.ceil(bytes.length / 4) * 4);
  bytes.copy(padded);
  const bufferView = gltf.bufferViews.length;
  gltf.bufferViews.push({ buffer: 0, byteOffset: binary.length, byteLength: bytes.length });
  const min = Array.from({ length: size }, (_, axis) =>
    Math.min(...values.filter((_, index) => index % size === axis)),
  );
  const max = Array.from({ length: size }, (_, axis) =>
    Math.max(...values.filter((_, index) => index % size === axis)),
  );
  const index = gltf.accessors.length;
  gltf.accessors.push({ bufferView, componentType, count: values.length / size, type, min, max });
  gltf.buffers[0].byteLength = binary.length + padded.length;
  return { index, binary: Buffer.concat([binary, padded]) };
}
