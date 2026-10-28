// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, MeshStandardMaterial, Scene } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { ChestTransitions } from "./chest-transitions";
import { chestRewardPrizes } from "./chest-reward-reveal";
import { chestRarityGlow } from "./chest-rarity-glow";
import { RewardSummoning } from "./reward-summoning";
import { HUD_SHEET } from "@/tokens";

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
    pool.revealReward("1,0", chestRewardPrizes({ kind: "relics", relics: [41, 43, 39] }));
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
    pool.revealReward("1,0", chestRewardPrizes({ kind: "relics", relics: [41, 43, 39] }));
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
    pool.revealReward("1,0", chestRewardPrizes({ kind: "lords", amount }));
    const actor = pool.group.children.find((child) => child.visible)!;
    const label = actor.children.find((child) => "element" in child) as Group & { element: HTMLElement };
    expect([...label.element.querySelectorAll("img")].map((img) => img.alt)).toEqual(amount ? ["17 LORDS"] : []);
    pool.update(0.7, 4.7);
    expect(label.visible).toBe(true);
    if (amount) expect(Number(label.element.querySelector<HTMLElement>("[data-chest-prize]")!.style.opacity)).toBe(1);
    pool.update(2, 6.7);
    expect(pool.has("1,0")).toBe(false);
    expect(label.parent).toBeNull();
  } finally {
    pool.dispose();
  }
});

// Owner, 28 October 2026: "I want a real animation, like the chest opening in blitz, but on the center of the screen".
it("presents a chest that arrives, opens by itself with its prizes, and goes, with nothing to press", () => {
  const pool = createPool();
  try {
    const prizes = [
      ...chestRewardPrizes({ kind: "lords", amount: 100 }),
      { name: "XP", figure: "+136 XP" },
      { icon: "skull" as const, name: "troops", figure: "−4" },
    ];
    expect(pool.present("centre", new Matrix4(), 4, prizes)).toBe(true);
    const actor = pool.group.children.find((child) => child.visible)!;
    const label = () =>
      actor.children.find((child) => "element" in child) as (Group & { element: HTMLElement }) | undefined;
    // It arrives first: no prize yet while it is summoned.
    pool.update(0.5, 4.5);
    expect(label()).toBeUndefined();
    // Arrived, it opens on its own and the prizes come out, each with its figure.
    pool.update(0.6, 5.1);
    pool.update(0.5, 5.6);
    expect(label()?.visible).toBe(true);
    expect([...label()!.element.querySelectorAll("[data-chest-prize]")].map((prize) => prize.textContent)).toEqual([
      "100 LORDS",
      "+136 XP",
      "−4",
    ]);
    // Then it goes by itself, its prizes with it.
    pool.update(2.5, 8.1);
    expect(pool.has("centre")).toBe(false);
    expect(actor.visible).toBe(false);
  } finally {
    pool.dispose();
  }
});

it("lights a presented chest in its rarity's glow, and lets a reused slot open plain", () => {
  const setGlow = vi.spyOn(RewardSummoning.prototype, "setGlow");
  const clearGlow = vi.spyOn(RewardSummoning.prototype, "clearGlow");
  const pool = createPool();
  try {
    const legendary = chestRarityGlow(5)!;
    pool.present("centre", new Matrix4(), 4, [], legendary);
    expect(setGlow).toHaveBeenLastCalledWith(legendary);
    pool.clear();
    clearGlow.mockClear();
    pool.start("1,0", "open", new Matrix4(), 4);
    expect(clearGlow).toHaveBeenCalledTimes(1);
  } finally {
    pool.dispose();
    setGlow.mockRestore();
    clearGlow.mockRestore();
  }
});

it("glows a chest from uncommon up in the HUD's own rarity colour, its beams reaching higher with its rarity", () => {
  expect(chestRarityGlow(1)).toBeUndefined();
  expect(chestRarityGlow(2)?.tint).toBe(HUD_SHEET["rarity-2"]);
  expect(chestRarityGlow(5)?.tint).toBe(HUD_SHEET["rarity-5"]);
  expect(chestRarityGlow(5)!.beam!.reach).toBeGreaterThan(chestRarityGlow(2)!.beam!.reach);
});
