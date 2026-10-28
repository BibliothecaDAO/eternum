import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const game = fileURLToPath(new URL("../../", import.meta.url));
const json = async (path) => JSON.parse(await readFile(`${game}/${path}`, "utf8"));
const approved = await json("asset-sources/realms/devcon/approved.json");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const skins = await json("src/three/structures/realm-skins.json");
const tiers = (await json("src/three/structures/realm-assets.json")).filter((asset) => !asset.wonder);

test("every shipped Devcon tier preserves its approved compressed delivery and has isolated ownership cloth", async () => {
  assert.equal(hash(await readFile(`${game}/public/textures/realms/devcon-diamond.png`)), approved.diamondSha256);
  execFileSync(process.execPath, [`${game}/scripts/realms/deliver-devcon.mjs`, "--check"]);
  for (const { directory } of Object.values(skins)) {
    for (const { id } of tiers) {
      const source = `${game}/asset-sources/realms/devcon/${directory}/${id}`;
      assert.equal(hash(await readFile(`${source}.glb`)), approved.models[`${directory}/${id}.glb`].sha256);
      assert.equal(hash(await readFile(`${source}.blend`)), approved.models[`${directory}/${id}.glb`].blendSha256);
      const bytes = await readFile(`${game}/public/models/realms/devcon/${directory}/${id}.glb`);
      const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
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
      assert.equal(cloth.length, id === "settlement" ? 1 : 2);
      assert.ok(cloth.every((node) => node.name.startsWith("Devcon diamond banner")));
      assert.ok(gltf.nodes.filter((node) => !cloth.includes(node)).every((node) => !node.extras?.orderCloth));
    }
  }
});
