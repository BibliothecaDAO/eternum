// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { Group, Matrix4, Scene } from "three";
import { createChestPool } from "./chest-pool-fixture";
import type { ChestPresentationBeats } from "./chest-transitions";
import { chestRewardPrizes } from "./chest-reward-reveal";
import { chestRarityGlow } from "./chest-rarity-glow";
import { RewardSummoning } from "./reward-summoning";
import { HUD_SHEET } from "@/tokens";

const createPool = createChestPool;

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

/** Beats that record what the pool told, in order. */
const recordedBeats = (log: string[], name: string): ChestPresentationBeats => ({
  onShown: () => log.push(`${name} shown`),
  onOpen: () => log.push(`${name} opened`),
  onEnd: () => log.push(`${name} ended`),
});

// Owner, 28 October 2026: "I want a real animation, like the chest opening in blitz, but on the center of the screen".
it("presents a chest that arrives, opens by itself and goes, telling each beat as it reaches it", () => {
  const open = vi.spyOn(RewardSummoning.prototype, "open");
  const pool = createPool();
  const beats: string[] = [];
  try {
    expect(pool.present("centre", new Matrix4(), 4, recordedBeats(beats, "A"))).toBe(true);
    const actor = pool.group.children.find((child) => child.visible)!;
    open.mockClear();
    // It arrives first, shut.
    pool.update(0.5, 4.5);
    expect(open).not.toHaveBeenCalled();
    expect(beats).toEqual(["A shown"]);
    // Arrived, its lid opens on its own, once, and says so.
    pool.update(0.6, 5.1);
    pool.update(0.5, 5.6);
    expect(open).toHaveBeenCalledTimes(1);
    expect(beats).toEqual(["A shown", "A opened"]);
    // Then it goes by itself, its slot free again, and says so.
    pool.update(2.5, 8.1);
    expect(pool.has("centre")).toBe(false);
    expect(actor.visible).toBe(false);
    expect(beats).toEqual(["A shown", "A opened", "A ended"]);
  } finally {
    pool.dispose();
    open.mockRestore();
  }
});

it("opens when the chest has arrived, however long a frame between updates", () => {
  const pool = createPool();
  const beats: string[] = [];
  try {
    pool.present("centre", new Matrix4(), 4, recordedBeats(beats, "A"));
    pool.update(0.5, 4.5);
    // A four-second gap (a tab in the background): the chest opens now, and stands open, not gone.
    pool.update(4, 8.5);
    expect(beats).toEqual(["A shown", "A opened"]);
    expect(pool.has("centre")).toBe(true);
  } finally {
    pool.dispose();
  }
});

it("replaces a chest still arriving: the first ends, the second starts afresh in its own placement and glow", () => {
  const clearGlow = vi.spyOn(RewardSummoning.prototype, "clearGlow");
  const pool = createPool();
  const beats: string[] = [];
  try {
    pool.present("centre", new Matrix4(), 4, recordedBeats(beats, "A"), chestRarityGlow(5));
    pool.update(0.8, 4.8);
    clearGlow.mockClear();
    const elsewhere = new Matrix4().makeTranslation(3, 0, 0);
    pool.present("centre", elsewhere, 4.8, recordedBeats(beats, "B"));
    expect(beats).toEqual(["A shown", "A ended", "B shown"]);
    // A common chest: the legendary glow before it is gone.
    expect(clearGlow).toHaveBeenCalled();
    const actor = pool.group.children.find((child) => child.visible)!;
    expect(actor.position.x).toBe(3);
    // Its own summon: not open where the first would have opened.
    pool.update(0.3, 5.1);
    expect(beats).not.toContain("B opened");
    pool.update(0.8, 5.9);
    expect(beats).toEqual(["A shown", "A ended", "B shown", "B opened"]);
  } finally {
    pool.dispose();
    clearGlow.mockRestore();
  }
});

it("ends a presented chest cleared with its chunk or cancelled with the scene", () => {
  const pool = createPool();
  const beats: string[] = [];
  try {
    pool.present("centre", new Matrix4(), 4, recordedBeats(beats, "A"));
    pool.update(0.5, 4.5);
    pool.clear();
    expect(beats).toEqual(["A shown", "A ended"]);
    pool.present("centre", new Matrix4(), 5, recordedBeats(beats, "B"));
    pool.cancel("centre");
    expect(beats).toEqual(["A shown", "A ended", "B shown", "B ended"]);
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
    pool.present("centre", new Matrix4(), 4, recordedBeats([], "A"), legendary);
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
