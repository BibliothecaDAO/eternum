import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { NodeIO } from "@gltf-transform/core";
import { KHRTextureBasisu } from "@gltf-transform/extensions";
import { Object3D, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { createCreatureAnimator } from "../../src/three/terrain/creatures/biome-creature-animator.js";
import { CREATURE_SPECIES, homeBiome } from "../../src/three/terrain/creatures/biome-creature-catalog";
import { countSurfacePieces } from "./creature-surface.mjs";

const ASSET_DIRECTORY = new URL("../../public/models/biome-creatures/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", ASSET_DIRECTORY), "utf8"));
const io = new NodeIO().registerExtensions([KHRTextureBasisu]);
const ANIMATED_JOINTS = new Set([
  "body",
  "hip",
  "knee",
  "neck",
  "tail",
  "splay_leg",
  "splay_knee",
  "claw",
  "pincer",
  "stinger",
  "flipper",
  "lure",
  "wing",
  "bird_foot",
]);

async function readModel(file) {
  return io.readBinary(new Uint8Array(await readFile(new URL(file, ASSET_DIRECTORY))));
}

function rigOf(document) {
  const toObject = (node) => {
    const object = new Object3D();
    object.position.fromArray(node.getTranslation());
    object.quaternion.fromArray(node.getRotation());
    object.userData = { ...node.getExtras() };
    for (const child of node.listChildren()) object.add(toObject(child));
    return object;
  };
  const scene = new Object3D();
  for (const node of document.getRoot().listScenes()[0].listChildren()) scene.add(toObject(node));
  return scene;
}

function poseOf(joint) {
  return [...joint.quaternion.toArray(), ...joint.position.toArray()];
}

function walkAndTakeOff(animator, seconds) {
  const bind = new Map(animator.joints.map((joint) => [joint, poseOf(joint)]));
  const posed = new Set();
  for (let time = 0; time <= seconds; time += 0.1) {
    animator.update(time, { distance: time * 0.3, pace: 1, lift: time > seconds / 2 ? 1 : 0 });
    for (const joint of animator.joints)
      if (poseOf(joint).some((value, index) => Math.abs(value - bind.get(joint)[index]) > 1e-3)) posed.add(joint);
  }
  return posed;
}

describe("the map's animals as shipped", () => {
  it("has a model for every creature species the catalog names", () => {
    expect(manifest.creatures.map(({ id }) => id).toSorted()).toEqual([...CREATURE_SPECIES].toSorted());
    for (const species of CREATURE_SPECIES) expect(homeBiome(species)).toBeTruthy();
  });

  it.each(manifest.creatures)("ships $id as its manifest records it", async ({ file, bytes, sha256 }) => {
    const model = await readFile(new URL(file, ASSET_DIRECTORY));
    expect(model.byteLength).toBe(bytes);
    expect(createHash("sha256").update(model).digest("hex")).toBe(sha256);
  });

  it.each(manifest.creatures)(
    "walks $id with the one animator, every joint it poses leaving its bind",
    async ({ id, file, profile }) => {
      const animator = createCreatureAnimator(rigOf(await readModel(file)));
      expect(animator.rig.userData).toMatchObject({ creature_id: id, profile });
      const posed = animator.joints.filter((joint) => ANIMATED_JOINTS.has(joint.userData.joint));
      expect(posed.length).toBeGreaterThan(4);
      const moved = walkAndTakeOff(animator, 4);
      for (const joint of posed) expect(moved.has(joint), `${id} ${joint.userData.joint}`).toBe(true);
    },
  );

  it.each(manifest.creatures.filter((creature) => creature.profile === "penguin"))(
    "keeps $id's lower foot planted where it stood as it waddles",
    async ({ file }) => {
      const scene = rigOf(await readModel(file));
      const animator = createCreatureAnimator(scene);
      const feet = animator.joints.filter((joint) => joint.userData.joint === "bird_foot");
      const lowestFoot = () => {
        scene.updateMatrixWorld(true);
        return Math.min(...feet.map((foot) => foot.getWorldPosition(new Vector3()).y));
      };
      const standing = lowestFoot();
      const heights = new Set();
      for (let time = 0; time <= 2; time += 0.1) {
        animator.update(time, { distance: time * 0.3, pace: 1 });
        expect(lowestFoot()).toBeCloseTo(standing, 4);
        heights.add(Math.max(...feet.map((foot) => foot.getWorldPosition(new Vector3()).y)).toFixed(3));
      }
      expect(heights.size).toBeGreaterThan(3);
    },
  );

  it.each(manifest.creatures)(
    "hangs $id's knees straight below its hips, on legs long enough for the animator to bend to the ground",
    async ({ file }) => {
      const document = await readModel(file);
      const hips = document
        .getRoot()
        .listNodes()
        .filter((node) => node.getExtras().joint === "hip");
      expect([0, 4]).toContain(hips.length);
      for (const hip of hips) {
        const { upperLength, lowerLength, footHeight, bend } = hip.getExtras();
        const [knee] = hip.listChildren().filter((child) => child.getExtras().joint === "knee");
        expect(knee.getTranslation()[1]).toBeCloseTo(-upperLength, 5);
        expect(upperLength + lowerLength).toBeGreaterThan(hip.getWorldTranslation()[1] - footHeight);
        expect(Math.abs(bend)).toBe(1);
      }
    },
  );

  it.each(manifest.creatures)(
    "skins $id whole, to joints it has, with textures the GPU reads directly",
    async ({ file }) => {
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
    },
  );

  it.each(manifest.creatures)("skins $id in one piece, with nothing floating free of the body", async ({ file }) => {
    const document = await io.readBinary(new Uint8Array(await readFile(new URL(file, ASSET_DIRECTORY))));
    const [primitive] = document.getRoot().listMeshes()[0].listPrimitives();
    const vertexCount = primitive.getAttribute("POSITION").getCount();
    expect(countSurfacePieces(primitive.getIndices().getArray(), vertexCount)).toBe(1);
  });
});
