import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
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
import { closeRuinChest, playSiteClear, useRuinChest } from "./site-clear-moment";
import { payoutSprites, type SiteClear } from "./site-outcome";

const CAMP: SiteClear = { siteId: 9, kind: "Camp", reward: { resourceId: ResourcesIds.Labor, amount: 550 } };

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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
  it("fells the guard and flies the payout home with its +N", () => {
    const counter = document.createElement("span");
    counter.dataset.flyTarget = `resource-${ResourcesIds.Labor}`;
    document.body.append(counter);
    const burst = vi.fn();
    playSiteClear({ clear: CAMP, troopsLost: 420, at: { x: 1, y: 1 }, burst });
    expect(plays).toEqual(["combat.victory"]);
    expect(burst).toHaveBeenCalledTimes(1);
    // The counter holds from the story's arrival.
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

  it("opens a ruin's chest as that fight's result, which stays until it is closed; no other site has one", () => {
    const opening = () => {
      let value: ReturnType<typeof useRuinChest> = null;
      const Probe = () => {
        value = useRuinChest();
        return null;
      };
      const root = createRoot(document.createElement("div"));
      act(() => root.render(createElement(Probe)));
      act(() => root.unmount());
      return value;
    };
    playSiteClear({ clear: CAMP, troopsLost: 420, at: { x: 1, y: 1 }, burst: () => {} });
    vi.advanceTimersByTime(300);
    expect(opening()).toBeNull();

    playSiteClear({
      clear: { siteId: 3, kind: "Ruin", reward: null },
      troopsLost: 90,
      at: { x: 1, y: 1 },
      burst: () => {},
    });
    vi.advanceTimersByTime(60_000);
    expect(opening()).toEqual(expect.objectContaining({ siteId: 3, troopsLost: 90 }));
    closeRuinChest();
    expect(opening()).toBeNull();
  });
});
