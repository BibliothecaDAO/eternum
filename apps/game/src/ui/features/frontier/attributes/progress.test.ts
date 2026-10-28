import { beforeEach, describe, expect, it, vi } from "vitest";

const { plays, rises } = vi.hoisted(() => ({ plays: [] as string[], rises: [] as string[] }));
vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: { getInstance: () => ({ play: (id: string) => (plays.push(id), Promise.resolve(null)) }) },
}));
vi.mock("@/ui/motion/motion-layer", () => ({ riseSprite: ({ label }: { label: string }) => rises.push(label) }));
vi.mock("@/ui/motion/motion-settings", () => ({ playHaptic: () => {} }));

import { availableRankUps, attributeGain, xpGained } from "./attributes";
import { playArmyProgress } from "./progress-moment";

const ARMY = {
  common_points: 0,
  uncommon_points: 0,
  rare_points: 0,
  epic_points: 0,
  legendary_points: 0,
  game_id: 1,
  explorer_id: 7n,
  xp: 0,
  battle: 0,
  logistics: 0,
  scouting: 0,
  scouting_kinds: 0,
  homecoming: 0,
};

beforeEach(() => {
  plays.length = 0;
  rises.length = 0;
});

describe("an army's progress", () => {
  it("offers only attributes for which a fitting point is held", () => {
    expect(availableRankUps({ ...ARMY, xp: 5000 })).toEqual([]);
    expect(availableRankUps({ ...ARMY, common_points: 1, battle: 1 })).toEqual(["Logistics", "Scouting", "Homecoming"]);
    expect(
      availableRankUps({ ...ARMY, legendary_points: 1, battle: 5, logistics: 5, scouting: 5, homecoming: 5 }),
    ).toEqual([]);
  });

  it("earns XP from reveals and clears, and none from a rank raised with a point", () => {
    expect(xpGained({ xp: 40 }, { xp: 50 })).toBe(10);
    expect(xpGained({ xp: 150 }, { xp: 150 })).toBe(0);
  });
});

describe("an attribute's gain", () => {
  it("reads each attribute's rule, the tiered ones by the step between two tiers", () => {
    expect(attributeGain("Battle", 1, 2)).toBe("+15%");
    expect(attributeGain("Battle", 3, 5)).toBe("+55%");
    expect(attributeGain("Logistics", 1, 3)).toBe("+55");
    expect(attributeGain("Scouting", 1, 2)).toBe("+15%");
    expect(attributeGain("Scouting", 1, 5)).toBe("+90%");
    expect(attributeGain("Homecoming", 1, 3)).toBe("+11%");
    expect(attributeGain("Homecoming", 1, 5)).toBe("+27%");
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
