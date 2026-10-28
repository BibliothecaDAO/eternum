import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { plays, flights, toasts, game } = vi.hoisted(() => ({
  plays: [] as string[],
  flights: [] as Array<{ count: number; announce?: number; delayMs?: number }>,
  toasts: [] as string[],
  game: { setup: {} as GameClientSetup },
}));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => game }));
vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: { getInstance: () => ({ play: (id: string) => (plays.push(id), Promise.resolve(null)) }) },
}));
vi.mock("@/ui/motion/motion-settings", () => ({ playHaptic: () => {}, useReducedMotion: () => true }));
vi.mock("@/ui/features/event-feed/notify", () => ({ toast: { success: (text: string) => toasts.push(text) } }));
vi.mock("@/three/sound/utils", () => ({ getResourceSoundId: (id: number) => `collect.${id}` }));
vi.mock("@/ui/motion/moments/banked-flight", () => ({
  findBankedCounter: (id: number) => document.querySelector(`[data-fly-target="resource-${id}"]`),
  flyToBankedCounter: (flight: { count: number; announce?: number; delayMs?: number }) => flights.push(flight),
}));

import { WorldUpdateListener } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { ClearedRuinChest } from "../chest/cleared-ruin-chest";
import { onRewardChestRequest } from "@/three/scenes/worldmap-reward-chest-request";
import { campBeside, SITE } from "./site-fixture";
import { closeRuinChest, playSiteClear, useRuinChest } from "./site-clear-moment";
import { payoutSprites, type SiteClear } from "./site-outcome";

const CAMP: SiteClear = { siteId: 9, kind: "Camp", reward: { resourceId: ResourcesIds.Labor, amount: 550 } };

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  plays.length = 0;
  flights.length = 0;
  toasts.length = 0;
  closeRuinChest();
  document.body.innerHTML = "";
});
afterEach(() => vi.useRealTimers());

describe("a cleared site", () => {
  it("sends six to twenty icons home, more for larger payouts", () => {
    expect([10, 550, 3_000, 10_000_000].map(payoutSprites)).toEqual([6, 11, 14, 20]);
  });
});

describe("the site-cleared moment", () => {
  it.each([5, 0])(
    "carries a ruin receipt paying %s LORDS through the listener, flight and a chest that goes by itself",
    (amount) => {
      const { store, site } = campBeside("Ruin");
      game.setup = { store } as GameClientSetup;
      const reward = { resource_type: ResourcesIds.Lords, amount: BigInt(amount) * BigInt(RESOURCE_PRECISION) };
      store.applyFacts([
        { model: "Structure", key: "0x71", value: null },
        { model: "Guard", key: "0x73", value: null },
        {
          model: "ExpeditionSite",
          key: "0x72",
          value: { ...site, clear: { explorer_id: 201n, home_id: 7n, reward } },
        },
      ]);
      const counter = document.createElement("span");
      counter.dataset.flyTarget = `resource-${ResourcesIds.Lords}`;
      document.body.append(counter);
      const host = document.createElement("div");
      document.body.append(host);
      const root = createRoot(host);
      const burst = vi.fn();
      const listener = new WorldUpdateListener(game.setup);
      const stop = listener.SitePayouts.onSitePayout((clear) =>
        playSiteClear({ clear, troopsLost: clear.troopsLost, at: { x: 1, y: 1 }, burst }),
      );
      const position = (event_index: number) => ({
        block_number: 9,
        transaction_hash: "0xab",
        transaction_index: 0,
        event_index,
      });
      try {
        act(() => root.render(createElement(ClearedRuinChest)));
        act(() =>
          store.applyEvent({
            model: "StoryEvent",
            key: "payout",
            value: {
              game_id: 1,
              owner: "0x111",
              timestamp: 350,
              event_position: position(4),
              story: {
                SitePayout: {
                  structure_id: 7,
                  explorer_id: 201,
                  site_id: SITE,
                  category: StructureType.Ruin,
                  reward,
                },
              },
            },
          }),
        );
        expect(burst).not.toHaveBeenCalled();
        expect(host.querySelector('[role="status"]')).toBeNull();
        act(() =>
          store.applyEvent({
            model: "BattleEvent",
            key: "battle",
            value: {
              game_id: 1,
              defender_id: SITE,
              coord: { x: 40, y: 12 },
              attacker: { before: "1498000000000", after: "1408000000000" },
              defender: { before: "1100000000000", after: "0" },
              event_position: position(5),
            },
          }),
        );
        expect(burst).toHaveBeenCalledTimes(1);
        expect(flights).toEqual([expect.objectContaining({ announce: amount, count: 6, delayMs: 300 })]);
        const requested: unknown[] = [];
        const stopRequests = onRewardChestRequest((request) => requested.push(request));
        act(() => vi.advanceTimersByTime(300));
        stopRequests();
        expect(plays).toEqual(["combat.victory", "site.clear"]);
        // The world map stages the chest at the screen's centre in its tier's glow, giving what the clear paid; the
        // site fixture's ruin chest is the contract's tier 3, Epic, and the clear cost 90 troops.
        expect(requested).toEqual([
          {
            rarity: 4,
            // The LORDS are the moment's hero, counted up under the chest; the rest rises small from its lid.
            lords: amount,
            prizes: [expect.objectContaining({ name: "XP" }), { icon: "skull", name: "troops", figure: "−90" }],
          },
        ]);
        // Nothing of it is on the page: no panel, nothing to press, every click reaches the map.
        expect(host.innerHTML).toBe("");
        const probeHost = document.createElement("div");
        const probe = createRoot(probeHost);
        const Probe = () => createElement("i", { "data-open": String(useRuinChest() !== null) });
        act(() => probe.render(createElement(Probe)));
        expect(probeHost.querySelector("i")?.dataset.open).toBe("false");
        act(() => probe.unmount());
      } finally {
        stop();
        act(() => {
          closeRuinChest();
          root.unmount();
        });
        host.remove();
      }
    },
  );

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

  it("opens a ruin's chest as that fight's result, until its moment closes it; no other site has one", () => {
    const opening = (): ReturnType<typeof useRuinChest> => {
      const probeHost = document.createElement("div");
      const root = createRoot(probeHost);
      const Probe = () => createElement("i", { "data-opening": JSON.stringify(useRuinChest()) });
      act(() => root.render(createElement(Probe)));
      const read = JSON.parse(probeHost.querySelector("i")!.dataset.opening!);
      act(() => root.unmount());
      return read;
    };
    playSiteClear({ clear: CAMP, troopsLost: 420, at: { x: 1, y: 1 }, burst: () => {} });
    vi.advanceTimersByTime(300);
    expect(opening()).toBeNull();

    playSiteClear({
      clear: { siteId: 3, kind: "Ruin", reward: { resourceId: ResourcesIds.Lords, amount: 5 } },
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
