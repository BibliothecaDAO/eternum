import { createElement } from "react";
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

import { ResourceManager, WorldUpdateListener } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { campBeside, reloadSiteFacts, SITE, SITE_TILE } from "./site-fixture";
import { playSiteClear } from "./site-clear-moment";
import { payoutSprites, type SiteClear } from "./site-outcome";
import { readClearedSite, SiteReceipt } from "./site-receipt";
import { renderToStaticMarkup } from "react-dom/server";

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
  it.each([137, 80, 0])(
    "applies a Beasts receipt of %s Labor to the live moment and keeps the confirmed stores",
    (amount) => {
      const { store, site } = campBeside("Beasts");
      const precision = BigInt(RESOURCE_PRECISION);
      const reward = { resource_type: ResourcesIds.Labor, amount: BigInt(amount) * precision };
      const balance = (1000n + BigInt(amount)) * precision;
      const counter = document.createElement("span");
      counter.dataset.flyTarget = `resource-${ResourcesIds.Labor}`;
      document.body.append(counter);
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      const burst = vi.fn();
      const listener = new WorldUpdateListener({ store } as GameClientSetup);
      const stop = listener.SitePayouts.onSitePayout((clear) => playSiteClear({ clear, at: { x: 1, y: 1 }, burst }));
      const position = (event_index: number) => ({
        block_number: 9,
        transaction_hash: "0xab",
        transaction_index: 0,
        event_index,
      });
      try {
        // Herald delivers the credited balance and clear receipt before the transaction's events.
        store.applyFacts([
          { model: "Structure", key: "0x71", value: null },
          { model: "Guard", key: "0x73", value: null },
          {
            model: "ExpeditionSite",
            key: "0x72",
            value: { ...site, clear: { explorer_id: 201n, home_id: 7n, reward } },
          },
          {
            model: "ResourceBalance",
            key: "0x79",
            value: { game_id: 1, entity_id: 7, resource_type: ResourcesIds.Labor, balance },
          },
        ]);
        store.applyEvent({
          model: "StoryEvent",
          key: "payout",
          value: {
            game_id: 1,
            owner: "0x111",
            timestamp: 350,
            event_position: position(4),
            story: {
              SitePayout: { structure_id: 7, explorer_id: 201, site_id: SITE, category: StructureType.Beasts, reward },
            },
          },
        });
        expect(burst).not.toHaveBeenCalled();
        store.applyEvent({
          model: "BattleEvent",
          key: "battle",
          value: {
            game_id: 1,
            defender_id: SITE,
            coord: { x: SITE_TILE.col, y: SITE_TILE.row },
            attacker: { before: "758000000000", after: "728000000000" },
            defender: { before: "81000000000", after: "0" },
            event_position: position(5),
          },
        });
        expect(errors).not.toHaveBeenCalled();
        expect(burst).toHaveBeenCalledTimes(1);
        expect(flights).toEqual([
          expect.objectContaining({ resourceId: ResourcesIds.Labor, announce: amount, delayMs: 300 }),
        ]);
        vi.advanceTimersByTime(300);
        expect(plays).toEqual(["combat.victory", "site.clear"]);
        expect(toasts).toEqual([]);
        const restored = reloadSiteFacts(store);
        restored.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 350 });
        for (const facts of [store, restored]) {
          expect(new ResourceManager(facts, 7, 1).balance(ResourcesIds.Labor)).toBe(balance);
          const selected = readClearedSite(facts, 1, SITE_TILE)!;
          expect(selected.site.clear?.reward).toEqual(reward);
          const receipt = renderToStaticMarkup(createElement(SiteReceipt, { selected }));
          expect(receipt).toContain(`<strong>${amount}</strong>`);
          expect(receipt).toContain("Labor");
        }
      } finally {
        stop();
        errors.mockRestore();
      }
    },
  );

  it("keeps a cleared ruin's receipt without a LORDS flight or cash chest", () => {
    const { store, site } = campBeside("Ruin");
    store.applyFacts([
      {
        model: "ExpeditionSite",
        key: "0x72",
        value: {
          ...site,
          clear: { explorer_id: 201n, home_id: 7n, reward: null },
        },
      },
    ]);
    const burst = vi.fn();
    const requested: unknown[] = [];
    const onRequest = (event: Event) => requested.push(event);
    window.addEventListener("rewardChestRequest", onRequest);
    try {
      playSiteClear({ clear: { siteId: SITE, kind: "Ruin", reward: null }, at: { x: 1, y: 1 }, burst });
      vi.advanceTimersByTime(300);
      expect(burst).toHaveBeenCalledOnce();
      expect(plays).toEqual(["combat.victory", "site.clear"]);
      expect(flights).toEqual([]);
      expect(toasts).toEqual([]);
      expect(requested).toEqual([]);
      for (const facts of [store, reloadSiteFacts(store)]) {
        const selected = readClearedSite(facts, 1, SITE_TILE)!;
        expect(selected.site.clear?.reward).toBeNull();
        const receipt = renderToStaticMarkup(createElement(SiteReceipt, { selected }));
        expect(receipt).toContain("Cleared");
        expect(receipt).toContain("XP");
        expect(receipt).not.toContain("LORDS");
      }
    } finally {
      window.removeEventListener("rewardChestRequest", onRequest);
    }
  });

  it("fells the guard and flies the payout home with its +N", () => {
    const counter = document.createElement("span");
    counter.dataset.flyTarget = `resource-${ResourcesIds.Labor}`;
    document.body.append(counter);
    const burst = vi.fn();
    playSiteClear({ clear: CAMP, at: { x: 1, y: 1 }, burst });
    expect(plays).toEqual(["combat.victory"]);
    expect(burst).toHaveBeenCalledTimes(1);
    // The counter holds from the story's arrival.
    expect(flights).toEqual([expect.objectContaining({ count: 11, announce: 550, delayMs: 300 })]);
    vi.advanceTimersByTime(300);
    expect(plays).toEqual(["combat.victory", "site.clear"]);
    expect(toasts).toEqual([]);
  });

  it("says it in a toast only when no counter is on screen", () => {
    playSiteClear({ clear: CAMP, at: { x: 1, y: 1 }, burst: () => {} });
    vi.advanceTimersByTime(300);
    expect(flights).toEqual([]);
    expect(toasts).toEqual(["+550 Labor"]);
  });
});
