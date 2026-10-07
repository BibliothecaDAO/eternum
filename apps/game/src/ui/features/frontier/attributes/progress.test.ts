import { beforeEach, describe, expect, it, vi } from "vitest";

const { plays, rises } = vi.hoisted(() => ({ plays: [] as string[], rises: [] as string[] }));
vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: { getInstance: () => ({ play: (id: string) => (plays.push(id), Promise.resolve(null)) }) },
}));
vi.mock("@/ui/motion/motion-layer", () => ({ riseSprite: ({ label }: { label: string }) => rises.push(label) }));
vi.mock("@/ui/motion/motion-settings", () => ({ playHaptic: () => {} }));

import { affordableUpgrades, attributeGain, nextTierPrice, xpGained } from "./attributes";
import { playArmyProgress } from "./progress-moment";

const RULES = {
  game_id: 1,
  reveal_xp: 2,
  fixed_xp: 200,
  uncommon_xp: 100,
  rare_xp: 200,
  epic_xp: 400,
  legendary_xp: 800,
};
const ARMY = { game_id: 1, explorer_id: 7, xp: 0, battle: 1, logistics: 1, scouting: 1, scouting_kinds: 0, support: 1 };

beforeEach(() => {
  plays.length = 0;
  rises.length = 0;
});

describe("an army's progress", () => {
  it("prices each next tier as the contract does, and nothing past legendary", () => {
    expect([1, 2, 3, 4, 5].map((tier) => nextTierPrice(RULES, tier))).toEqual([100, 200, 400, 800, null]);
  });

  it("can Upgrade any attribute whose next tier its XP covers", () => {
    expect(affordableUpgrades({ ...ARMY, xp: 99 }, RULES)).toEqual([]);
    // Scouting waits for the frontend's kind choice.
    expect(affordableUpgrades({ ...ARMY, xp: 150, battle: 2 }, RULES)).toEqual(["Logistics", "Support"]);
    expect(affordableUpgrades({ ...ARMY, xp: 5000, battle: 5, logistics: 5, scouting: 5, support: 5 }, RULES)).toEqual(
      [],
    );
  });

  it("earns XP from reveals and clears, and none from an Upgrade that spends it", () => {
    expect(xpGained({ xp: 40 }, { xp: 50 })).toBe(10);
    expect(xpGained({ xp: 150 }, { xp: 50 })).toBe(0);
  });
});

describe("an attribute's gain", () => {
  it("reads each attribute's rule, the tiered ones by the step between two tiers", () => {
    expect(attributeGain("Battle", 1, 2)).toBe("+10%");
    expect(attributeGain("Battle", 3, 5)).toBe("+70%");
    expect(attributeGain("Logistics", 1, 3)).toBe("+50");
    expect(attributeGain("Scouting", 1, 2)).toBe("+10%");
    expect(attributeGain("Scouting", 1, 5)).toBe("+100%");
    expect(attributeGain("Support", 1, 3)).toBe("+20%");
  });
});

describe("the progress flourish", () => {
  it("ticks and floats the XP from the army's tile, and plays nothing without a gain", () => {
    playArmyProgress({ xp: 10, at: { x: 5, y: 5 } });
    expect(plays).toEqual(["xp.tick"]);
    expect(rises).toEqual(["+10 XP"]);
    playArmyProgress({ xp: 0, at: null });
    expect(plays).toEqual(["xp.tick"]);
  });
});
