import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { plays, rises } = vi.hoisted(() => ({ plays: [] as string[], rises: [] as string[] }));
vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: { getInstance: () => ({ play: (id: string) => (plays.push(id), Promise.resolve(null)) }) },
}));
vi.mock("@/ui/motion/motion-layer", () => ({ riseSprite: ({ label }: { label: string }) => rises.push(label) }));
vi.mock("@/ui/motion/motion-settings", () => ({ playHaptic: () => {} }));

import { bankedPicks, levelProgress, progressChange, xpGained } from "./attributes";
import { playArmyProgress } from "./progress-moment";

const RULES = { game_id: 1, reveal_xp: 10, clear_xp: 25, level_step_xp: 20 };

beforeEach(() => {
  vi.useFakeTimers();
  plays.length = 0;
  rises.length = 0;
});
afterEach(() => vi.useRealTimers());

describe("an army's progress", () => {
  it("fills its bar toward 20 × its level, and stops at full while XP banks behind an offer", () => {
    expect(levelProgress({ level: 3, xp: 40 }, RULES)).toEqual({ into: 40, needed: 60 });
    expect(levelProgress({ level: 3, xp: 95 }, RULES)).toEqual({ into: 60, needed: 60 });
  });

  it("banks one more pick behind the waiting offer for each threshold its XP still covers", () => {
    expect(bankedPicks({ level: 3, xp: 59 }, RULES)).toBe(0);
    expect(bankedPicks({ level: 3, xp: 60 }, RULES)).toBe(1);
    expect(bankedPicks({ level: 3, xp: 139 }, RULES)).toBe(1);
    expect(bankedPicks({ level: 3, xp: 140 }, RULES)).toBe(2);
  });

  it("earns XP from reveals and clears, and none from a pick that spends a threshold", () => {
    expect(xpGained({ level: 3, xp: 40 }, { level: 3, xp: 50 }, RULES)).toBe(10);
    expect(xpGained({ level: 3, xp: 75 }, { level: 4, xp: 15 }, RULES)).toBe(0);
    expect(progressChange({ level: 3, xp: 75 }, { level: 4, xp: 15 }, RULES)).toEqual({ xp: 0, levels: 1 });
  });
});

describe("the progress flourish", () => {
  it("ticks and floats the XP from the army's tile", () => {
    playArmyProgress({ xp: 10, levels: 0, at: { x: 5, y: 5 }, burst: () => {}, now: 0 });
    expect(plays).toEqual(["xp.tick"]);
    expect(rises).toEqual(["+10 XP"]);
  });

  it("plays one level-up beat per level gained, one after another", () => {
    const burst = vi.fn();
    playArmyProgress({ xp: 0, levels: 2, at: null, burst, now: 0 });
    expect(burst).toHaveBeenCalledTimes(1);
    expect(plays).toEqual(["ui.levelup"]);
    vi.advanceTimersByTime(400);
    expect(burst).toHaveBeenCalledTimes(2);
    expect(plays).toEqual(["ui.levelup", "ui.levelup"]);
  });
});
