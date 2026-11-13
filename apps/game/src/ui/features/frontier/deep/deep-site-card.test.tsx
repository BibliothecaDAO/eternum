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
  useCurrentBlockTimestamp: () => 350,
  useCurrentDefaultTick: () => 350,
  useNowSeconds: () => 350,
  useBlockTimestamp: () => ({ currentArmiesTick: 350, armiesTickTimeRemaining: 1 }),
}));

import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { configManager } from "@bibliothecadao/eternum";
import type { GameClientSetup, NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { deepSites, TileOccupier } from "@bibliothecadao/types";

import { campBeside } from "../sites/site-fixture";
import { DeepSiteCard } from "./deep-site-card";
import { readDeepSiteCard, type DeepActor } from "./deep-site-plan";

const PRECISION = 1_000_000_000n;
const NOW = 350;
/** The Foundation stands beside army 201 (41,12); the Quarry and the Altar out of its reach. */
const TILES = { foundation: { col: 42, row: 12 }, quarry: { col: 30, row: 12 }, altar: { col: 50, row: 12 } };
const SITE_ID = { foundation: 901, quarry: 902, altar: 903 };

afterEach(() => useUIStore.getState().selectOnMap(null));

/**
 * The site fixture's Frontier day with the Deep's three sites (DeepRules at Season 1's numbers, one army tick a second
 * so the day outlasts every guard here), realm 7 of player 0x111 in Might with its army 201 beside the Foundation, and
 * a second home of each `others` with an army guarding a site.
 */
const deepDay = (beasts: { foundation: bigint; quarry: bigint; altar: bigint }) => {
  const { store } = campBeside();
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  const slice = store.require("SliceRules", { game_id: 1 });
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  store.applyFacts([
    {
      model: "SliceRules",
      key: "0x100",
      value: { ...slice, tick_config: { ...slice.tick_config, armies_tick_in_seconds: 1 } },
    },
    {
      model: "DeepRules",
      key: "0xd0",
      value: {
        game_id: 1,
        foundation: { alt: false, x: 25, y: 35 },
        quarry: { alt: false, x: 12, y: 20 },
        altar: { alt: false, x: 38, y: 20 },
        beast_count: 10_000n * PRECISION,
        loss_per_tick: 200n * PRECISION,
        quarry_per_tick: 500n * PRECISION,
        altar_per_tick: 5,
        altar_threshold: 1_500,
      },
    },
    {
      model: "RaceRules",
      key: "0xd1",
      value: {
        game_id: 1,
        season_days: 40n,
        glory_per_tick: 5n,
        height_per_tick: 5,
        stage_height: 2_000,
        clear_mist_percent: 0,
        second_wind_percent: 0,
        pale_moon_percent: 0,
        spoils_percent: 0,
        first: { alt: false, x: 0, y: 0 },
        second: { alt: false, x: 0, y: 0 },
        third: { alt: false, x: 0, y: 0 },
        fourth: { alt: false, x: 0, y: 0 },
      },
    },
    { model: "HomeAspect", key: "0xd2", value: { game_id: 1, home: 7n, aspect: 1 } },
    ...deepSites.flatMap((kind, index) => {
      const entity_id = BigInt(SITE_ID[kind.position]);
      const tile = TILES[kind.position];
      return [
        { model: "DeepSite", key: `0xe${index}`, value: { game_id: 1, entity_id, kind: kind.id, day: 0n } },
        {
          model: "TileOccupancy",
          key: `0xf${index}`,
          value: { game_id: 1, entity_id, category: TileOccupier.DeepSite, is_structure: false, alt: false, ...tile },
        },
        {
          model: "Guard",
          key: `0xa${index}`,
          value: {
            game_id: 1,
            structure_id: entity_id,
            slot: 0,
            destroyed_tick: 0,
            troops: { ...army.troops, count: beasts[kind.position] },
          },
        },
      ];
    }),
  ] as never);
  /** Another player's home `home` of player `owner` in `aspect`, its army `explorer` guarding `site` in `slot`. */
  const guard = (
    home: number,
    owner: string,
    aspect: number,
    explorer: number,
    site: number,
    slot: number,
    troops: bigint,
  ) =>
    store.applyFacts([
      {
        model: "Structure",
        key: `0xb${home}`,
        value: { ...realm, entity_id: BigInt(home), owner, metadata: { ...realm.metadata, realm_id: home } },
      },
      { model: "HomeAspect", key: `0xc${home}`, value: { game_id: 1, home: BigInt(home), aspect } },
      {
        model: "ExplorerTroops",
        key: `0xd${explorer}`,
        value: {
          ...army,
          explorer_id: BigInt(explorer),
          owner: BigInt(home),
          troops: { ...army.troops, count: troops * PRECISION },
        },
      },
      { model: "ArmyDay", key: `0xe${explorer}`, value: { game_id: 1, explorer_id: BigInt(explorer), day: 0n } },
      {
        model: "DeepArmy",
        key: `0xf${explorer}`,
        value: { game_id: 1, explorer_id: BigInt(explorer), last_tick: BigInt(NOW) },
      },
      {
        model: "DeepGuard",
        key: `0xa${explorer}`,
        value: { game_id: 1, explorer_id: BigInt(explorer), site_id: BigInt(site), slot },
      },
    ] as never);
  const actor: DeepActor = {
    army: store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 }),
    tile: { col: 41, row: 12 },
  };
  return { store, guard, actor };
};

const read = (store: NativeFactStore, tile: { col: number; row: number }, actor: DeepActor | null) => {
  const plan = readDeepSiteCard(store, 1, tile, actor, 0x111n, NOW);
  if (plan?.kind !== "site") throw new Error(`no site card: ${JSON.stringify(plan?.kind)}`);
  return plan;
};

describe("a Deep site's card", () => {
  it("says what each site's tick pays, split by troops, from the game's rules", () => {
    const { store, guard } = deepDay({ foundation: 0n, quarry: 0n, altar: 0n });
    guard(8, "0x222", 1, 301, SITE_ID.altar, 0, 3_000n);
    store.applyFacts([{ model: "AltarBar", key: "0xab", value: { game_id: 1, aspect: 1, charge: 40 } }] as never);
    expect(read(store, TILES.foundation, null).pay).toEqual({ glory: 5, height: 5, resources: 0, bar: null });
    expect(read(store, TILES.quarry, null).pay).toEqual({ glory: 0, height: 0, resources: 500, bar: null });
    expect(read(store, TILES.altar, null).pay).toEqual({
      glory: 5,
      height: 0,
      resources: 0,
      bar: { perTick: 5, charge: 40, threshold: 1_500 },
    });
  });

  it("offers Attack on the day's beast beside it, and Move toward a site out of reach", () => {
    const { store, actor } = deepDay({ foundation: 10_000n * PRECISION, quarry: 7_500n * PRECISION, altar: 0n });
    const beside = read(store, TILES.foundation, actor);
    expect(beside.guard).toEqual({ kind: "beast", troops: 10_000 });
    expect(beside.step).toEqual({ kind: "attack" });
    expect(beside.inReach).toBe(true);
    const away = read(store, TILES.quarry, actor);
    expect(away.guard).toEqual({ kind: "beast", troops: 7_500 });
    expect(away.inReach).toBe(false);
    expect(read(store, TILES.altar, actor).guard).toEqual({ kind: "open" });
    expect(read(store, TILES.altar, actor).step).toEqual({ kind: "take" });
  });

  it("shows each slot's realm, troops, ticks left and share, and lets a mate join a free slot", () => {
    const { store, guard, actor } = deepDay({ foundation: 0n, quarry: 0n, altar: 0n });
    guard(8, "0x222", 1, 301, SITE_ID.foundation, 0, 3_000n);
    guard(9, "0x333", 1, 302, SITE_ID.foundation, 2, 1_000n);
    const plan = read(store, TILES.foundation, actor);
    if (plan.guard.kind !== "held") throw new Error("not held");
    expect(plan.guard.aspect).toBe(1);
    // 3,000 at 200 a tick lasts 15 ticks, 1,000 lasts 5; they share each tick 75 to 25.
    expect(
      plan.guard.slots.map(({ slot, troops, ticks, share, mine }) => ({ slot, troops, left: ticks.left, share, mine })),
    ).toEqual([
      { slot: 0, troops: 3_000, left: 15, share: 75, mine: false },
      { slot: 2, troops: 1_000, left: 5, share: 25, mine: false },
    ]);
    expect(plan.step).toEqual({ kind: "join" });
  });

  it("refuses what the contract refuses: another Aspect's site, a second army of a player, a full guard, another day's army", () => {
    const rival = deepDay({ foundation: 0n, quarry: 0n, altar: 0n });
    rival.guard(8, "0x222", 2, 301, SITE_ID.foundation, 0, 3_000n);
    expect(read(rival.store, TILES.foundation, rival.actor).step).toEqual({ kind: "rival" });

    const own = deepDay({ foundation: 0n, quarry: 0n, altar: 0n });
    own.guard(8, "0x111", 1, 301, SITE_ID.foundation, 0, 3_000n);
    expect(read(own.store, TILES.foundation, own.actor).step).toEqual({ kind: "guarding" });
    expect(read(own.store, TILES.foundation, own.actor).guard).toMatchObject({ slots: [{ mine: true }] });

    const full = deepDay({ foundation: 0n, quarry: 0n, altar: 0n });
    [8, 9, 10, 11].forEach((home, slot) =>
      full.guard(home, `0x${home}00`, 1, 300 + home, SITE_ID.foundation, slot, 1_000n),
    );
    expect(read(full.store, TILES.foundation, full.actor).step).toEqual({ kind: "full" });

    const late = deepDay({ foundation: 10_000n * PRECISION, quarry: 0n, altar: 0n });
    late.store.applyFacts([
      { model: "ArmyDay", key: "0xad", value: { game_id: 1, explorer_id: 201, day: 1 } },
    ] as never);
    expect(read(late.store, TILES.foundation, late.actor).step).toEqual({ kind: "other-day" });
  });

  it("reads nothing while the snapshot is still arriving, and no card where no Deep site stands", () => {
    const { store, actor } = deepDay({ foundation: 10_000n * PRECISION, quarry: 0n, altar: 0n });
    expect(readDeepSiteCard(store, 1, { col: 1, row: 1 }, actor, 0x111n, NOW)).toBeNull();
    store.setSnapshot({ gameId: 1, complete: false, actor: "0x111", timestamp: NOW });
    expect(readDeepSiteCard(store, 1, TILES.foundation, actor, 0x111n, NOW)).toEqual({ kind: "reading" });
  });

  it("draws the guard's slots on the card and sends Join for the selected army with the site's tile", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
    const { store, guard } = deepDay({ foundation: 0n, quarry: 0n, altar: 0n });
    guard(8, "0x222", 1, 301, SITE_ID.foundation, 0, 3_000n);
    useAccountStore.setState({ account: { address: "0x111" } as never });
    const interact = vi.fn(() => Promise.resolve({ transaction_hash: "0x1" }));
    const tile = {
      hexCoords: { ...TILES.foundation, alt: false },
      occupierType: TileOccupier.DeepSite,
    } as unknown as TileSpatialRenderable;
    const host = document.createElement("div");
    const root = createRoot(host);
    act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: null }));
    act(() =>
      root.render(
        <GameProvider
          value={{ store, systemCalls: { interact_site: interact } } as unknown as GameClientSetup}
          account={{ address: "0x111", account: { address: "0x111" } } as never}
        >
          <DeepSiteCard tile={tile} onClose={() => {}} />
        </GameProvider>,
      ),
    );
    expect(host.textContent).toContain("For your Aspect");
    expect(host.textContent).toContain("Held by Might");
    expect(host.textContent).toContain("15 ticks left · 100% of each tick");
    expect(host.querySelectorAll("[data-deep-slots] .ui-row")).toHaveLength(4);
    expect(
      [...host.querySelectorAll("[data-deep-slots] .ui-row")].filter((row) => row.textContent?.includes("Free slot")),
    ).toHaveLength(3);
    const join = [...host.querySelectorAll("button")].find((button) => button.textContent === "Join");
    await act(async () => join!.click());
    expect(interact).toHaveBeenCalledWith(
      expect.objectContaining({
        explorer_id: 201,
        coord: { alt: false, x: TILES.foundation.col, y: TILES.foundation.row },
      }),
    );
    act(() => root.unmount());
  });
});
