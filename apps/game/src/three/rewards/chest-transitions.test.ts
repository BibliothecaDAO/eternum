// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, MeshStandardMaterial, Scene } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { ChestTransitions } from "./chest-transitions";

function createPool() {
  const scene = new Group();
  const body = new Group();
  body.name = "ChestBody";
  const lid = new Group();
  lid.name = "ChestLid";
  body.add(lid);
  scene.add(body);
  for (let i = 0; i < 2; i++) {
    const ring = new Group();
    ring.name = `ArcaneSealRing${i}`;
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute([0.7, 0.05, 0, 0.71, 0.05, 0, 0.7, 0.05, 0.01], 3));
    const material = new MeshStandardMaterial();
    material.name = "Ritual violet";
    ring.add(new Mesh(geometry, material));
    scene.add(ring);
  }
  const gems = new Group();
  gems.name = "OrbitGems";
  scene.add(gems);
  return new ChestTransitions({ scene, animations: [] } as unknown as GLTF);
}

describe("precompiled chest transitions", () => {
  it("reveals the marker with the one-second summon, then releases the slot", () => {
    const pool = createPool();
    pool.start("1,0", "summon", new Matrix4(), 4);
    expect(pool.revealProgress("1,0")).toBe(0);
    pool.update(0.65, 4.65);
    expect(pool.revealProgress("1,0")).toBeGreaterThan(0);
    expect(pool.has("1,0")).toBe(true);
    pool.update(0.35, 5);
    expect(pool.has("1,0")).toBe(false);
    pool.dispose();
  });
  it("fans out all three awarded icons with the opening and cleans them up after absorption", () => {
    const pool = createPool();
    pool.start("1,0", "open", new Matrix4(), 4);
    pool.revealReward("1,0", { kind: "relics", relics: [41, 43, 39] });
    const actor = pool.group.children.find((child) => child.visible)!;
    const label = actor.children.find((child) => "element" in child) as Group & { element: HTMLElement };
    expect(label.element.querySelectorAll("img")).toHaveLength(3);
    pool.update(0.2, 4.2);
    expect(label.visible).toBe(false);
    // The entity diff following the reward event must not restart opening.
    pool.start("1,0", "open", new Matrix4(), 4.2);
    pool.update(0.5, 4.7);
    expect(label.visible).toBe(true);
    expect(Number((label.element.firstElementChild!.firstElementChild as HTMLElement).style.opacity)).toBe(1);
    pool.update(2, 6.7);
    expect(pool.has("1,0")).toBe(false);
    expect(pool.hasRewardReveals()).toBe(false);
    expect(label.parent).toBeNull();
    pool.dispose();
  });
  it("precompiles actual hidden objects and restores visibility even after failure", async () => {
    const pool = createPool();
    await expect(
      pool.prepare(async (root) => {
        root.traverse((part) => expect(part.visible).toBe(true));
        throw new Error("device lost");
      }, new Scene()),
    ).rejects.toThrow("device lost");
    expect(pool.group.children.every((actor) => !actor.visible)).toBe(true);
    for (let i = 0; i < 4; i++) expect(pool.start(`${i},0`, "summon", new Matrix4(), 1)).toBe(true);
    expect(pool.start("5,0", "summon", new Matrix4(), 1)).toBe(false);
    pool.clear();
    expect(pool.start("5,0", "summon", new Matrix4(), 1)).toBe(true);
    pool.dispose();
  });
});

it("keeps decorative gems sealed through summon sampling, reveals on open and seals a reused actor", () => {
  const pool = createPool();
  try {
    pool.start("1,0", "summon", new Matrix4(), 4);
    const actor = pool.group.children.find((child) => child.visible)!;
    const gems = actor.getObjectByName("OrbitGems")!;
    expect(gems.visible).toBe(false);
    pool.update(0.7, 4.7);
    expect(gems.visible).toBe(false);
    pool.start("1,0", "open", new Matrix4(), 4.7);
    pool.revealReward("1,0", { kind: "relics", relics: [41, 43, 39] });
    pool.update(0.7, 5.4);
    expect(gems.visible).toBe(true);
    expect(pool.hasRewardReveals()).toBe(true);
    pool.update(2, 7.4);
    expect(pool.has("1,0")).toBe(false);
    pool.start("2,0", "summon", new Matrix4(), 8);
    expect(gems.visible).toBe(false);
    pool.update(0.7, 8.7);
    expect(gems.visible).toBe(false);
  } finally {
    pool.dispose();
  }
});

it.each([17, 0])("reveals exactly the paid LORDS amount %i, never relics or an expired prize", (amount) => {
  const pool = createPool();
  try {
    pool.start("1,0", "open", new Matrix4(), 4);
    pool.revealReward("1,0", { kind: "lords", amount });
    const actor = pool.group.children.find((child) => child.visible)!;
    const label = actor.children.find((child) => "element" in child) as Group & { element: HTMLElement };
    expect([...label.element.querySelectorAll("img")].map((img) => img.alt)).toEqual(amount ? ["17 LORDS"] : []);
    pool.update(0.7, 4.7);
    expect(label.visible).toBe(true);
    if (amount)
      expect(Number((label.element.querySelector("img")!.parentElement as HTMLElement).style.opacity)).toBe(1);
    pool.update(2, 6.7);
    expect(pool.has("1,0")).toBe(false);
    expect(label.parent).toBeNull();
  } finally {
    pool.dispose();
  }
});
