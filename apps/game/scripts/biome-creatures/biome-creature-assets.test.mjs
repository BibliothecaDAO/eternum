import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { NodeIO } from "@gltf-transform/core";
import { KHRTextureBasisu } from "@gltf-transform/extensions";
import { describe, expect, it } from "vitest";

const ASSET_DIRECTORY = new URL("../../public/models/biome-creatures/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", ASSET_DIRECTORY), "utf8"));
const built = manifest.creatures.filter((creature) => creature.builder);
const io = new NodeIO().registerExtensions([KHRTextureBasisu]);

describe("the map's animals as shipped", () => {
  it.each(manifest.creatures)("ships $id as its manifest records it", async ({ file, bytes, sha256 }) => {
    const model = await readFile(new URL(file, ASSET_DIRECTORY));
    expect(model.byteLength).toBe(bytes);
    expect(createHash("sha256").update(model).digest("hex")).toBe(sha256);
  });

  it.each(built)("gives $id the rig its animator drives", async ({ id, file, profile }) => {
    const document = await io.readBinary(new Uint8Array(await readFile(new URL(file, ASSET_DIRECTORY))));
    const nodes = document.getRoot().listNodes();
    const jointed = (joint) => nodes.filter((node) => node.getExtras().joint === joint);
    const [root] = nodes.filter((node) => node.getExtras().animation_schema === "biome-creature-v1");
    expect(root.getExtras()).toMatchObject({ creature_id: id, profile });
    expect(jointed("body")).toHaveLength(1);
    expect(jointed("neck")).toHaveLength(1);
    const hips = jointed("hip");
    expect(hips).toHaveLength(4);
    for (const hip of hips) {
      const { upperLength, lowerLength, footHeight, bend } = hip.getExtras();
      const [knee] = hip.listChildren().filter((child) => child.getExtras().joint === "knee");
      // The knee hangs straight below the hip, and the leg is long enough to stand on: the animator bends it down.
      expect(knee.getTranslation()[1]).toBeCloseTo(-upperLength, 5);
      expect(upperLength + lowerLength).toBeGreaterThan(hip.getWorldTranslation()[1] - footHeight);
      expect(Math.abs(bend)).toBe(1);
    }
  });

  it.each(built)("skins $id whole, to joints it has, with textures the GPU reads directly", async ({ file }) => {
    const document = await io.readBinary(new Uint8Array(await readFile(new URL(file, ASSET_DIRECTORY))));
    const [skin] = document.getRoot().listSkins();
    const [primitive] = document.getRoot().listMeshes()[0].listPrimitives();
    const joints = primitive.getAttribute("JOINTS_0").getArray();
    const weights = primitive.getAttribute("WEIGHTS_0").getArray();
    expect(Math.max(...joints)).toBeLessThan(skin.listJoints().length);
    for (let vertex = 0; vertex < weights.length / 4; vertex++) {
      const total = weights[vertex * 4] + weights[vertex * 4 + 1] + weights[vertex * 4 + 2] + weights[vertex * 4 + 3];
      expect(total).toBeCloseTo(1, 4);
    }
    for (const texture of document.getRoot().listTextures()) expect(texture.getMimeType()).toBe("image/ktx2");
  });
});
