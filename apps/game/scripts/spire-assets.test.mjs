// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const bytes = readFileSync(new URL("../public/models/ethereal/spire.glb", import.meta.url));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));
const binary = bytes.subarray(28 + jsonLength);

function values(index) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  const size = { SCALAR: 1, VEC3: 3, VEC4: 4 }[accessor.type];
  expect(accessor.componentType).toBe(5126);
  return Array.from({ length: accessor.count }, (_, row) =>
    Array.from({ length: size }, (_, column) =>
      binary.readFloatLE(
        (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + row * (view.byteStride ?? size * 4) + column * 4,
      ),
    ),
  );
}

describe("production spire asset", () => {
  it("keeps the authored mesh budget and GPU-compressed textures", () => {
    expect(bytes.length).toBeLessThan(768 * 1024);
    expect(gltf.extensionsUsed).toEqual(expect.arrayContaining(["KHR_draco_mesh_compression", "KHR_texture_basisu"]));
    const primitives = gltf.meshes.flatMap((mesh) => mesh.primitives);
    expect(primitives).toHaveLength(29);
    expect(primitives.reduce((sum, primitive) => sum + gltf.accessors[primitive.indices].count / 3, 0)).toBe(16140);
    expect(gltf.materials).toHaveLength(8);
    expect(gltf.images).toHaveLength(6);
    for (const image of gltf.images) {
      expect(image.mimeType).toBe("image/ktx2");
      const offset = gltf.bufferViews[image.bufferView].byteOffset ?? 0;
      expect(binary.readUInt32LE(offset + 20)).toBeLessThanOrEqual(480);
      expect(binary.readUInt32LE(offset + 24)).toBeLessThanOrEqual(480);
    }
  });

  it("retains the true translucent sphere, semantic hierarchy and all six inward currents", () => {
    const core = gltf.nodes.filter((node) => node.extras?.trueSphereRadius === 0.3);
    expect(core).toHaveLength(1);
    const material = gltf.materials[gltf.meshes[core[0].mesh].primitives[0].material];
    expect(material.alphaMode).toBe("BLEND");
    expect(material.pbrMetallicRoughness.baseColorTexture).toBeDefined();
    expect(material.emissiveTexture).toBeDefined();
    expect(gltf.nodes.filter((node) => node.extras?.spirePart === "portalCurrent")).toHaveLength(6);
    expect(gltf.nodes.some((node) => node.extras?.portalTransparencyMode === "split-depth-additive-v1")).toBe(true);
    for (const node of gltf.nodes.filter((node) => node.mesh !== undefined))
      expect(node.scale ?? [1, 1, 1]).toEqual([1, 1, 1]);
  });

  it("preserves the eight-second loop and hides every current during its teleport reset", () => {
    expect(gltf.animations).toHaveLength(1);
    const clip = gltf.animations[0];
    expect(clip.name).toBe("Spire_Loop");
    for (const channel of clip.channels) {
      const sampler = clip.samplers[channel.sampler];
      const times = values(sampler.input).flat();
      const samples = values(sampler.output);
      expect(times[0]).toBe(0);
      expect(times.at(-1)).toBe(8);
      expect(times.every((time, index) => Number.isFinite(time) && (!index || time > times[index - 1]))).toBe(true);
      expect(samples.flat().every(Number.isFinite)).toBe(true);
      const first = samples[0],
        last = samples.at(-1);
      // q and -q represent the same rotation.
      const sign =
        channel.target.path === "rotation" && first.reduce((sum, value, index) => sum + value * last[index], 0) < 0
          ? -1
          : 1;
      expect(Math.max(...first.map((value, index) => Math.abs(value - sign * last[index])))).toBeLessThan(0.00001);
      if (channel.target.path !== "scale" || gltf.nodes[channel.target.node].extras?.spirePart !== "portalCurrent")
        continue;
      const translation = clip.channels.find(
        (other) => other.target.node === channel.target.node && other.target.path === "translation",
      );
      expect(translation).toBeDefined();
      const motion = clip.samplers[translation.sampler];
      const motionTimes = values(motion.input).flat();
      const positions = values(motion.output);
      let resets = 0;
      for (let i = 1; i < positions.length; i++) {
        if (Math.hypot(...positions[i].map((value, axis) => value - positions[i - 1][axis])) < 0.1) continue;
        // The entire interpolation interval must remain at zero scale, including after key reduction.
        for (const resetTime of [motionTimes[i - 1], motionTimes[i]]) {
          const right = times.findIndex((time) => time >= resetTime - 0.000001);
          const exact = Math.abs(times[right] - resetTime) < 0.000001;
          for (const scale of exact ? [samples[right]] : [samples[right - 1], samples[right]])
            expect(Math.max(...scale.map(Math.abs))).toBeLessThan(0.000001);
        }
        resets++;
      }
      expect(resets).toBe(2);
    }
  });
});
