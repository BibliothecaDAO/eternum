import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco from "draco3dgltf";

const game = fileURLToPath(new URL("../../", import.meta.url));
const json = async (path) => JSON.parse(await readFile(`${game}/${path}`, "utf8"));
const approved = await json("asset-sources/realms/devcon/approved.json");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const skins = await json("src/three/structures/realm-skins.json");
const tiers = (await json("src/three/structures/realm-assets.json")).filter((asset) => !asset.wonder);

test("every shipped Devcon tier keeps its left banner and drops the right cloth and standard without changing the building", async () => {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "draco3d.decoder": await draco.createDecoderModule() });
  assert.equal(hash(await readFile(`${game}/public/textures/realms/devcon-diamond.png`)), approved.diamondSha256);
  execFileSync(process.execPath, [`${game}/scripts/realms/deliver-devcon.mjs`, "--check"]);
  for (const { directory } of Object.values(skins)) {
    for (const { id } of tiers) {
      const source = `${game}/asset-sources/realms/devcon/${directory}/${id}`;
      const sourceBytes = await readFile(`${source}.glb`);
      assert.equal(hash(sourceBytes), approved.models[`${directory}/${id}.glb`].sha256);
      assert.equal(hash(await readFile(`${source}.blend`)), approved.models[`${directory}/${id}.glb`].blendSha256);
      const bytes = await readFile(`${game}/public/models/realms/devcon/${directory}/${id}.glb`);
      const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
      const original = JSON.parse(sourceBytes.subarray(20, 20 + sourceBytes.readUInt32LE(12)).toString());
      const originalBinary = sourceBytes.subarray(28 + sourceBytes.readUInt32LE(12));
      assert.ok(
        bytes
          .subarray(28 + bytes.readUInt32LE(12), 28 + bytes.readUInt32LE(12) + originalBinary.length)
          .equals(originalBinary),
      );
      for (const key of ["materials", "textures", "images"]) assert.deepEqual(gltf[key], original[key]);
      assert.deepEqual(gltf.meshes[0].primitives[0], original.meshes[0].primitives[0]);
      assert.deepEqual(gltf.meshes[1], original.meshes[1]);
      assert.deepEqual(gltf.scenes[0].nodes, [0, 1]);
      const triangles = gltf.meshes
        .flatMap((mesh) => mesh.primitives)
        .reduce((total, primitive) => total + gltf.accessors[primitive.indices].count / 3, 0);
      assert.ok(triangles <= 25_000 && triangles > 20_000, `${directory}/${id}: ${triangles} triangles`);
      assert.ok(bytes.length < 1_100_000, `${directory}/${id}: ${bytes.length} bytes`);
      assert.ok(gltf.materials.length <= 8);
      assert.ok(gltf.textures.length <= 6);
      assert.ok(gltf.extensionsUsed.includes("KHR_draco_mesh_compression"));
      assert.ok(gltf.extensionsUsed.includes("KHR_texture_basisu"));
      const cloth = gltf.nodes.filter((node) => node.extras?.orderCloth === "banner");
      assert.equal(cloth.length, 1);
      assert.equal(cloth[0].name, "Devcon diamond banner 1");
      assert.ok(cloth[0].extras.devconRoofMount[0] < 0);
      assert.equal(gltf.nodes.length, 2);
      assert.equal(gltf.meshes.length, 2);
      assert.ok(gltf.nodes.filter((node) => !cloth.includes(node)).every((node) => !node.extras?.orderCloth));
      const before = await io.readBinary(sourceBytes);
      const after = await io.readBinary(bytes);
      const leftStandard = standardTriangles(before).filter((triangle) => triangle.every((vertex) => vertex[0] < 0));
      assert.deepEqual(
        standardTriangles(after),
        leftStandard,
        `${directory}/${id}: left support geometry must be unchanged`,
      );
    }
  }
});

function standardTriangles(document) {
  const primitive = document
    .getRoot()
    .listMeshes()[0]
    .listPrimitives()
    .find((item) => item.getMaterial().getName() === "Devcon brass standards");
  const indices = primitive.getIndices().getArray();
  const attributes = ["POSITION", "NORMAL", "TEXCOORD_0"].map((name) => primitive.getAttribute(name));
  const triangles = [];
  for (let i = 0; i < indices.length; i += 3) {
    triangles.push(
      Array.from(indices.subarray(i, i + 3), (index) =>
        attributes.flatMap((attribute) =>
          Array.from(
            attribute.getArray().subarray(index * attribute.getElementSize(), (index + 1) * attribute.getElementSize()),
          ),
        ),
      ),
    );
  }
  return triangles;
}
