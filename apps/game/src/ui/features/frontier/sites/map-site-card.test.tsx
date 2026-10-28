import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/audio/unit-command-audio", () => ({ playUnitCommandSound: () => {} }));
vi.mock("@/sync/active-game-client", async (original) => ({
  ...(await original<typeof import("@/sync/active-game-client")>()),
  requireActiveGameClient: () => ({
    waitForAction: () => Promise.resolve({ hash: "0x1", block: 9, status: "SUCCEEDED" }),
  }),
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentDefaultTick: () => 360,
  useNowSeconds: () => 360,
  useBlockTimestamp: () => ({ currentArmiesTick: 3, armiesTickTimeRemaining: 60 }),
}));

import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ActionPaths, ActionType } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { MapSiteCard } from "./map-site-card";
import { campBeside, SITE_TILE } from "./site-fixture";

afterEach(() => useUIStore.getState().selectOnMap(null));

describe("a Well's tile card", () => {
  it("shows the stamina it gives, offers Use only where the army's orders offer it, and uses it", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store } = campBeside();
    store.applyFacts([
      {
        model: "TileOccupancy",
        key: "0x75",
        value: { game_id: 1, alt: false, col: 41, row: 12, entity_id: 201, category: 15, is_structure: false },
      },
    ] as never);
    useAccountStore.setState({ account: { address: "0x111" } as never });
    const interact = vi.fn(() => Promise.resolve({ transaction_hash: "0x1" }));
    const tile = { hexCoords: SITE_TILE, occupierType: 41 } as unknown as TileSpatialRenderable;
    const host = document.createElement("div");
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider
          value={{ store, systemCalls: { interact_site: interact } } as unknown as GameClientSetup}
          account={{ address: "0x111", account: { address: "0x111" } } as never}
        >
          <MapSiteCard selected={{ kind: "Well", tile }} onClose={() => {}} />
        </GameProvider>,
      ),
    );
    const use = () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Use");
    expect(host.querySelector('[aria-label="stamina +60"]')).not.toBeNull();
    expect(use()).toBeUndefined();
    // No army selected: what it gives alone, no army to pick (owner, 28 October 2026: "agree with no picker").
    expect(host.querySelectorAll(".ui-row")).toHaveLength(0);
    expect(host.textContent).not.toContain("Pick an army");

    act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: null }));
    // Selected but offered no Use (the planner has not offered one): no Use, and no army to pick.
    expect(use()).toBeUndefined();
    expect(host.textContent).not.toContain("Pick an army");
    // The planner's Use at the site, as the map offers it for the selected army.
    act(() =>
      useUIStore.getState().updateEntityActionActionPaths(
        new Map([
          [
            ActionPaths.posKey(SITE_TILE),
            [
              { hex: { col: 41, row: 12 }, actionType: ActionType.Move },
              { hex: { col: SITE_TILE.col, row: SITE_TILE.row }, actionType: ActionType.UseSite, staminaCost: 0 },
            ],
          ],
        ]),
      ),
    );
    expect(use()?.disabled).toBe(false);
    await act(async () => use()!.click());
    expect(interact).toHaveBeenCalledWith(
      expect.objectContaining({ explorer_id: 201, coord: { alt: false, x: SITE_TILE.col, y: SITE_TILE.row } }),
    );
    act(() => root.unmount());
  });
});

/**
 * The card a Well or Shrine opens with army 201 selected beside it, on the site fixture's game with the Frontier XP
 * rules: the army row's text, its stamina meter's value, and the tier gem it shows.
 */
const openWith = (
  kind: "Well" | "Shrine",
  { stamina, xp, tier = 1 }: { stamina: bigint; xp: number; tier?: number },
) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store } = campBeside("Camp", true, stamina);
  store.applyFacts([
    {
      model: "TileOccupancy",
      key: "0x75",
      value: { game_id: 1, alt: false, col: 41, row: 12, entity_id: 201, category: 15, is_structure: false },
    },
    {
      model: "ArmyProgressionRules",
      key: "0x1af10",
      value: {
        game_id: 1,
        reveal_xp: 2,
        fixed_xp: 200,
        uncommon_xp: 100,
        rare_xp: 200,
        epic_xp: 400,
        legendary_xp: 800,
      },
    },
    {
      model: "ArmyProgress",
      key: "1:201",
      value: {
        game_id: 1,
        explorer_id: "201",
        xp,
        battle: tier,
        logistics: tier,
        scouting: tier,
        scouting_kinds: 0,
        homecoming: tier,
      },
    },
  ] as never);
  useAccountStore.setState({ account: { address: "0x111" } as never });
  const tile = { hexCoords: SITE_TILE, occupierType: kind === "Well" ? 41 : 40 } as unknown as TileSpatialRenderable;
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: null }));
  act(() =>
    root.render(
      <GameProvider
        value={{ store, systemCalls: {} } as unknown as GameClientSetup}
        account={{ address: "0x111", account: { address: "0x111" } } as never}
      >
        <MapSiteCard selected={{ kind, tile }} onClose={() => {}} />
      </GameProvider>,
    ),
  );
  const row = host.querySelector("[data-site-user]");
  const reading = {
    row: row?.textContent ?? null,
    meter: row?.querySelector('[role="meter"]')?.getAttribute("aria-valuenow") ?? null,
    gem: row?.querySelector(".ui-tier")?.getAttribute("aria-label") ?? null,
    foot: host.querySelector(".ui-window__foot")?.textContent ?? null,
  };
  act(() => root.unmount());
  return reading;
};

describe('the army a Well or Shrine acts on (owner, 28 October 2026: "ok for B")', () => {
  // The fixture's bar holds 120, an explore costing 30.
  it("shows a Well's refill on the army's bar, before and after, with the explores it buys", () => {
    expect(openWith("Well", { stamina: 40n, xp: 0 })).toEqual({
      row: "Army 140 → 100+2 explores",
      meter: "100",
      gem: null,
      foot: "+60",
    });
  });

  it("caps a Well's refill at the army's maximum, buying no explore the bar cannot hold", () => {
    expect(openWith("Well", { stamina: 100n, xp: 0 })).toEqual({
      row: "Army 1100 → 120",
      meter: "120",
      gem: null,
      foot: "+60",
    });
  });

  it("shows a Shrine's XP before and after, and the attribute tier that XP then buys", () => {
    expect(openWith("Shrine", { stamina: 100n, xp: 40 })).toEqual({
      row: "Army 140 → 240 XPII",
      meter: null,
      gem: "Uncommon",
      foot: "+200 XP",
    });
  });

  it("shows no tier when the Shrine's XP still falls short of the next one's price", () => {
    // Every attribute at Epic: the next tier, Legendary, costs 800.
    expect(openWith("Shrine", { stamina: 100n, xp: 40, tier: 4 })).toEqual({
      row: "Army 140 → 240 XP",
      meter: null,
      gem: null,
      foot: "+200 XP",
    });
  });
});
