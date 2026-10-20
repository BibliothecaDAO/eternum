import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { tiles } = vi.hoisted(() => ({
  tiles: { current: [] as { occupierType: number; occupierId?: number; hexCoords: object }[] },
}));
vi.mock("@/hooks/use-world-spatial-tiles", () => ({ useWorldSpatialTiles: () => tiles.current }));
vi.mock("@/hooks/helpers/use-query", () => ({ useQuery: () => ({ isMapView: true }) }));
vi.mock("./build/build-sheet", () => ({ BuildSheet: () => null, useOpenPlot: () => null }));
vi.mock("./sites/map-site-card", () => ({ MapSiteCard: () => null, useSelectedMapSite: () => null }));
vi.mock("./sites/tile-card", () => ({ TileCard: () => null, useSelectedTarget: () => null }));
vi.mock("./upgrade/castle-upgrade", () => ({ CastleUpgrade: () => null, useKeepSelected: () => null }));
vi.mock("@/ui/features/military/chest/use-adjacent-own-explorer", () => ({ useAdjacentOwnExplorer: () => 201 }));
vi.mock("./research/selected-building", () => ({ useSelectedBuildingRow: () => null }));

import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChestOpeningStore } from "@/hooks/store/use-chest-opening-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { onChestOpenRequest } from "@/three/scenes/worldmap-chest-open-request";
import { ChestOpenings } from "@/ui/features/military/chest/chest-openings";
import { campBeside, SITE_TILE } from "./sites/site-fixture";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { expeditionSpireTile, readExpeditionRules, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { getNeighborHexes, TileOccupier } from "@bibliothecadao/types";
import { FrontierSelectionSheet } from "./frontier-selection-sheet";
import { fightEnded } from "./sites/fight-result";

/** Rules for the sheets that never read them here. */
const RULES = { dayUnitSeconds: 100, spacing: 10, startMainAt: 100, seed: 1n };

afterEach(() => setBlockTimestampSource(null));

const sheetFor = (occupierType: number | null) => {
  const { store } = campBeside();
  tiles.current = occupierType === null ? [] : [{ occupierType, hexCoords: { col: 4, row: 5, alt: false } }];
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={{ store } as never} account={{ address: "0x111" } as never}>
        <FrontierSelectionSheet rules={RULES} realm={null} onResearch={() => undefined} />
      </GameProvider>,
    ),
  );
  const sheet = host.querySelector("[data-kit-sheet]")?.getAttribute("aria-label") ?? null;
  act(() => root.unmount());
  return sheet;
};

describe("Frontier's selection sheet", () => {
  it("opens and closes a cleared site's receipt after its structure and guard are removed", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const { store, site } = campBeside();
    store.applyFacts([
      {
        model: "ExpeditionSite",
        key: "0x72",
        value: {
          ...site,
          clear: {
            explorer_id: 201n,
            home_id: 7n,
            reward: { resource_type: 23, amount: 550_000_000_000n },
          },
        },
      },
      { model: "Structure", key: "0x71", value: null },
      { model: "Guard", key: "0x73", value: null },
    ]);
    tiles.current = [];
    useUIStore.getState().selectOnMap({ kind: "hex", hex: SITE_TILE });
    const host = document.createElement("div");
    const root = createRoot(host);
    try {
      await act(async () =>
        root.render(
          <GameProvider value={{ store } as never} account={{ address: "0x111" } as never}>
            <FrontierSelectionSheet rules={RULES} realm={null} onResearch={() => undefined} />
          </GameProvider>,
        ),
      );
      expect(host.querySelector('[data-kit-sheet][aria-label="Camp"]')).not.toBeNull();
      expect(host.textContent).toContain("Cleared · Camp");
      expect(host.textContent).toContain("550 Labor");
      expect(host.textContent).toContain("82 XP");
      const close = host.querySelector<HTMLButtonElement>('button[aria-label="Close"]');
      expect(close).not.toBeNull();
      await act(async () => close!.click());
      expect(host.querySelector("[data-kit-sheet]")).toBeNull();
    } finally {
      act(() => root.unmount());
      useUIStore.getState().selectOnMap(null);
    }
  });

  it("opens a Frontier card for a spire, and nothing for a tile without one", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useUIStore.getState().selectOnMap({ kind: "hex", hex: { col: 4, row: 5 } });
    expect(sheetFor(TileOccupier.Spire)).toBe("Spire");
    // An empty tile, an unrevealed one, or an army the dock already shows: no card, and never the old inspector.
    expect(sheetFor(TileOccupier.None)).toBeNull();
    expect(sheetFor(null)).toBeNull();
    expect(sheetFor(TileOccupier.ExplorerKnightT1)).toBeNull();
    useUIStore.getState().selectOnMap(null);
  });
});

it("offers depth entry from Frontier for an own army at the computed spire", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store } = campBeside();
  // Realm 7's day-0 site is in its home region, 7; the fixture's clock (t=350) is on day 0.
  const spire = expeditionSpireTile(
    readExpeditionRules(store, 1)!,
    store.require("Structure", { game_id: 1, entity_id: 7 }),
    350,
  )!;
  const beside = getNeighborHexes(spire.col, spire.row)[0];
  store.applyFacts([
    // research.cairo: the depth row's tier sits at bit 46; Ethereal I is researched.
    { model: "RealmKnowledge", key: "0xd", value: { game_id: 1, structure_id: 7, learned: 1n << 46n } },
    {
      model: "DepthRules",
      key: "0x903",
      value: {
        game_id: 1,
        depth: 1,
        entry_stamina: 20,
        reveal_percent: 100,
        site_guard_lower: 1,
        site_guard_upper: 2,
        reveal_site_neighbors: false,
        chest: { common: 10000, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
        ruin_guard_lower: 1,
        ruin_guard_upper: 2,
        guard_step: 1,
        beast_weak_lower: 300,
        beast_weak_upper: 350,
        beast_strong_lower: 450,
        beast_strong_upper: 550,
      },
    },
    {
      model: "TileOccupancy",
      key: "0x75",
      value: null,
    },
    {
      model: "TileOccupancy",
      key: "0x904",
      // The army stands beside the realm's spire.
      value: {
        game_id: 1,
        alt: false,
        col: beside.col,
        row: beside.row,
        entity_id: 201,
        category: 15,
        is_structure: false,
      },
    },
  ] as never);
  useAccountStore.setState({ account: { address: "0x111" } as never });
  // Army 201 selected, acting on the tile beside it.
  useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: { col: beside.col, row: beside.row } });
  tiles.current = [];
  const enter = vi.fn().mockResolvedValue(undefined);
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider
        value={{ store, systemCalls: { enter_depth: enter } } as never}
        account={{ address: "0x111" } as never}
      >
        <FrontierSelectionSheet
          rules={readExpeditionRules(store, 1)!}
          realm={store.require("Structure", { game_id: 1, entity_id: 7 })}
          onResearch={() => undefined}
        />
      </GameProvider>,
    ),
  );
  try {
    const button = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Ethereal I · 20 stamina",
    );
    expect(button).toBeDefined();
    expect(button!.disabled).toBe(false);
    await act(async () => button!.click());
    expect(enter).toHaveBeenCalledWith(expect.objectContaining({ explorerId: 201, depth: 1 }));
  } finally {
    act(() => root.unmount());
    useUIStore.getState().selectOnMap(null);
  }
});

it("selects a Frontier chest, follows missing metadata and expiry, opens through the world bridge and retains its receipt", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { store } = campBeside();
  const chestHex = { col: 4, row: 5 };
  const chestTile = { occupierType: TileOccupier.Chest, occupierId: 900, hexCoords: { ...chestHex, alt: false } };
  tiles.current = [chestTile];
  useAccountStore.setState({ account: { address: "0x111" } as never });
  useChainTimeStore.setState({ nowMs: 350_000 });
  useChestOpeningStore.setState({ openings: {} });
  useUIStore.getState().selectOnMap({ kind: "hex", hex: chestHex });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const setup = { store } as never;
  const request = vi.fn(({ explorerId, hex }) => {
    expect(explorerId).toBe(201);
    expect(hex).toEqual(chestHex);
    tiles.current = [];
    store.applyEvent({
      model: "StoryEvent",
      key: "0x400",
      value: {
        game_id: 1,
        timestamp: 350,
        story: {
          RewardChestOpened: {
            explorer_id: explorerId,
            structure_id: 7,
            coord: { alt: false, x: hex.col, y: hex.row },
            amount: 17,
          },
        },
      },
    });
  });
  const stop = onChestOpenRequest(request);
  try {
    await act(async () =>
      root.render(
        <GameProvider value={setup} account={{ address: "0x111" } as never}>
          <ChestOpenings />
          <FrontierSelectionSheet rules={readExpeditionRules(store, 1)!} realm={null} onResearch={() => undefined} />
        </GameProvider>,
      ),
    );
    expect(host.querySelector('[data-kit-sheet][aria-label="Reward Chest"]')).not.toBeNull();
    expect(host.textContent).toContain("Syncing chest reward");
    await act(async () =>
      store.applyFacts([
        {
          model: "SiteChest",
          key: "0xcce5",
          value: {
            game_id: 1,
            entity_id: 900,
            tier: 0,
            amount: "17",
            reservation_day: "0",
          },
        },
      ] as never),
    );
    expect(host.textContent).toContain("17 LORDS");
    expect(host.textContent).toContain("Expires at day rollover");
    await act(async () => useChainTimeStore.setState({ nowMs: 400_000 }));
    expect(host.textContent).toContain("0 LORDS");
    expect(host.textContent).toContain("Reservation expired");
    await act(async () => useChainTimeStore.setState({ nowMs: 350_000 }));
    const open = [...host.querySelectorAll("button")].find((button) => button.textContent === "Open")!;
    expect(open.disabled).toBe(false);
    await act(async () => open.click());
    expect(request).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("17 LORDS paid to the army's realm");
    expect([...host.querySelectorAll("button")].some((button) => button.textContent === "Open")).toBe(false);
    await act(async () => useUIStore.getState().closeSelectedTile());
    expect(host.querySelector('[aria-label="Reward Chest"]')).toBeNull();
    await act(async () => useUIStore.getState().selectOnMap({ kind: "hex", hex: chestHex }));
    expect(host.textContent).toContain("17 LORDS paid to the army's realm");
    await act(async () => useUIStore.getState().setMapLayer(true));
    expect(host.querySelector('[aria-label="Reward Chest"]')).toBeNull();
  } finally {
    stop();
    act(() => root.unmount());
    host.remove();
    useUIStore.getState().selectOnMap(null);
    useUIStore.getState().setMapLayer(false);
    useAccountStore.setState({ account: null });
  }
});

it("closes the target's card with its fight result on Escape, not back to the card from before the fight", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store } = campBeside();
  tiles.current = [];
  useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: { col: 4, row: 5 } });
  fightEnded({
    site: "Rift",
    verdict: "guard-holds",
    armyArt: "knight-t1",
    army: { before: 1_000, after: 694 },
    guard: { before: 1_000, after: 572 },
    gained: null,
  });
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={{ store } as never} account={{ address: "0x111" } as never}>
        <FrontierSelectionSheet rules={RULES} realm={null} onResearch={() => undefined} />
      </GameProvider>,
    ),
  );
  expect(host.querySelector("[data-kit-sheet]")?.getAttribute("aria-label")).toBe("Rift");

  act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));

  expect(host.querySelector("[data-kit-sheet]")).toBeNull();
  expect(useUIStore.getState().mapSelection).toEqual({
    kind: "army",
    entityId: 201,
    tile: null,
  });
  act(() => root.unmount());
  useUIStore.getState().selectOnMap(null);
});
