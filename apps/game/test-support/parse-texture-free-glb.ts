import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/** Load actual public GLB geometry while stripping textures unsupported by Node fixtures. */
export async function parseTextureFreeGlb(url: string) {
  const glb = readFileSync(resolve(process.cwd(), `public${url}`));
  const jsonLength = glb.readUInt32LE(12);
  const document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  const binary = glb.subarray(28 + jsonLength);
  document.buffers[0].uri = `data:application/octet-stream;base64,${binary.toString("base64")}`;
  for (const mesh of document.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  document.materials = [];
  document.textures = [];
  document.images = [];
  return new GLTFLoader().parseAsync(JSON.stringify(document), "");
}
