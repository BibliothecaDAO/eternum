import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it, vi } from "vitest";
import { Box3, Mesh, Vector3 } from "three";
import { createCreatureAnimator } from "./biome-creature-animator.js";
import { loadBiomeCreature, disposeBiomeCreature } from "./biome-creature-assets";

const directory = new URL("../../../../public/models/biome-creatures/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", directory), "utf8"));

function parseWithoutTextures(bytes: Buffer) {
  const length = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + length).toString());
  // Node cannot decode browser images. Keep the real hierarchy, geometry and colors for pose tests.
  for (const material of gltf.materials ?? []) {
    delete material.normalTexture;
    delete material.occlusionTexture;
    delete material.emissiveTexture;
    delete material.pbrMetallicRoughness?.baseColorTexture;
    delete material.pbrMetallicRoughness?.metallicRoughnessTexture;
  }
  delete gltf.images;
  delete gltf.textures;
  delete gltf.samplers;
  const originalBinaryOffset = 20 + length;
  const binaryChunk = bytes.subarray(originalBinaryOffset);
  const json = Buffer.from(JSON.stringify(gltf));
  const paddedLength = Math.ceil(json.length / 4) * 4;
  const packed = Buffer.alloc(20 + paddedLength + binaryChunk.length, 0x20);
  packed.writeUInt32LE(0x46546c67, 0);
  packed.writeUInt32LE(2, 4);
  packed.writeUInt32LE(packed.length, 8);
  packed.writeUInt32LE(paddedLength, 12);
  packed.writeUInt32LE(0x4e4f534a, 16);
  json.copy(packed, 20);
  binaryChunk.copy(packed, 20 + paddedLength);
  return new GLTFLoader().parseAsync(packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength), "");
}

describe("supplied creature assets", () => {
  it("contains all 16 LOD2 species", () => {
    expect(manifest.creatures).toHaveLength(16);
    expect(manifest.lod).toBe(2);
    expect(new Set(manifest.creatures.map((c: { biome: string }) => c.biome)).size).toBe(16);
  });
  for (const entry of manifest.creatures)
    it(`${entry.id}: intact, articulated, finite and seekable`, async () => {
      const bytes = readFileSync(fileURLToPath(new URL(entry.file, directory)));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
      const source = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
      expect(
        source.meshes.reduce((total: number, mesh: { primitives: unknown[] }) => total + mesh.primitives.length, 0),
      ).toBeLessThanOrEqual(28);
      const gltf = await parseWithoutTextures(bytes);
      expect(gltf.animations).toHaveLength(0);
      const animator = createCreatureAnimator(gltf.scene, { seed: 5 });
      expect(animator.profile).toBe(entry.profile);
      expect(animator.joints.length).toBeGreaterThan(3);
      const pose = () => animator.joints.flatMap((joint) => [...joint.position, ...joint.quaternion, ...joint.scale]);
      animator.reset();
      const rest = pose();
      animator.update(1.25, { activity: "move" });
      const walking = pose();
      expect(walking).not.toEqual(rest);
      for (const time of [0, 0.1, 8, 120]) {
        animator.update(time);
        expect(pose().every(Number.isFinite)).toBe(true);
      }
      animator.update(1.25, { activity: "move" });
      expect(pose()).toEqual(walking);
      animator.reset();
      expect(pose()).toEqual(rest);
      disposeBiomeCreature(gltf.scene);
    });
});

it.each(["lantern-anglerfish", "green-sea-turtle"])(
  "centers %s at swimming depth without casting a surface shadow",
  async (species) => {
    const bytes = readFileSync(new URL(`${species}.glb`, directory));
    const gltf = await parseWithoutTextures(bytes);
    const loader = vi.spyOn(GLTFLoader.prototype, "loadAsync").mockResolvedValueOnce(gltf);
    try {
      const creature = await loadBiomeCreature(species, () => {});
      const bounds = new Box3().setFromObject(creature);
      expect(bounds.getCenter(new Vector3()).y).toBeCloseTo(0);
      expect(bounds.min.y).toBeLessThan(0);
      expect(bounds.max.y).toBeGreaterThan(0);
      expect(Math.max(...bounds.getSize(new Vector3()).toArray())).toBeCloseTo(0.65);
      creature.traverse((object) => {
        if (object instanceof Mesh) expect(object.castShadow).toBe(false);
      });
      disposeBiomeCreature(creature);
    } finally {
      loader.mockRestore();
    }
  },
);
