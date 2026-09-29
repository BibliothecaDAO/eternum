import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { plays, flights, toasts } = vi.hoisted(() => ({
  plays: [] as string[],
  flights: [] as Array<{ count: number; announce?: number; delayMs?: number }>,
  toasts: [] as string[],
}));
vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: { getInstance: () => ({ play: (id: string) => (plays.push(id), Promise.resolve(null)) }) },
}));
vi.mock("@/ui/motion/motion-settings", () => ({ playHaptic: () => {} }));
vi.mock("@/ui/features/event-feed/notify", () => ({ toast: { success: (text: string) => toasts.push(text) } }));
vi.mock("@/three/sound/utils", () => ({ getResourceSoundId: (id: number) => `collect.${id}` }));
vi.mock("@/ui/motion/moments/banked-flight", () => ({
  findBankedCounter: (id: number) => document.querySelector(`[data-fly-target="resource-${id}"]`),
  flyToBankedCounter: (flight: { count: number; announce?: number; delayMs?: number }) => flights.push(flight),
}));

import { ResourcesIds } from "@bibliothecadao/types";
import { playSiteClear } from "./site-clear-moment";
import { payoutSprites, type SiteClear } from "./site-outcome";

const CAMP: SiteClear = { kind: "Camp", reward: { resourceId: ResourcesIds.Labor, amount: 550 } };

beforeEach(() => {
  vi.useFakeTimers();
  plays.length = 0;
  flights.length = 0;
  toasts.length = 0;
  document.body.innerHTML = "";
});
afterEach(() => vi.useRealTimers());

describe("a cleared site", () => {
  it("sends six to twenty icons home, more for larger payouts", () => {
    expect([10, 550, 3_000, 10_000_000].map(payoutSprites)).toEqual([6, 11, 14, 20]);
  });
});

describe("the site-cleared moment", () => {
  it("fells the guard, then shows its card and flies the payout home with its +N", () => {
    const counter = document.createElement("span");
    counter.dataset.flyTarget = `resource-${ResourcesIds.Labor}`;
    document.body.append(counter);
    const burst = vi.fn();
    playSiteClear({ clear: CAMP, troopsLost: 420, at: { x: 1, y: 1 }, burst });
    expect(plays).toEqual(["combat.victory"]);
    expect(burst).toHaveBeenCalledTimes(1);
    // The counter holds from the story's arrival; its icons leave with the card.
    expect(flights).toEqual([expect.objectContaining({ count: 11, announce: 550, delayMs: 300 })]);
    vi.advanceTimersByTime(300);
    expect(plays).toEqual(["combat.victory", "site.clear"]);
    expect(toasts).toEqual([]);
  });

  it("says it in a toast only when no counter is on screen", () => {
    playSiteClear({ clear: CAMP, troopsLost: 420, at: { x: 1, y: 1 }, burst: () => {} });
    vi.advanceTimersByTime(300);
    expect(flights).toEqual([]);
    expect(toasts).toEqual(["+550 Labor"]);
  });
});
