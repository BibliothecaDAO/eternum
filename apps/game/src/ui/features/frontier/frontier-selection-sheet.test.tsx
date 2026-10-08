import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const { tiles, adjacent } = vi.hoisted(() => ({
  tiles: { current: [] as { occupierType: number; hexCoords: object }[] },
  adjacent: { army: 201 as number | null },
}));
vi.mock("@/hooks/use-world-spatial-tiles", () => ({ useWorldSpatialTiles: () => tiles.current }));
vi.mock("@/hooks/helpers/use-query", () => ({ useQuery: () => ({ isMapView: true }) }));
vi.mock("@/ui/features/military/chest/use-adjacent-own-explorer", () => ({
  useAdjacentOwnExplorer: () => adjacent.army,
}));
vi.mock("./build/build-sheet", () => ({ BuildSheet: () => null, useOpenPlot: () => null }));
vi.mock("./sites/map-site-card", () => ({ MapSiteCard: () => null, useSelectedMapSite: () => null }));
vi.mock("./sites/tile-card", () => ({ TileCard: () => null, useSelectedSite: () => null }));
vi.mock("./upgrade/castle-upgrade", () => ({ CastleUpgrade: () => null, useKeepSelected: () => null }));

import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { campBeside } from "./sites/site-fixture";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { TileOccupier } from "@bibliothecadao/types";
import { FrontierSelectionSheet } from "./frontier-selection-sheet";

const sheetFor = (occupierType: number | null) => {
  tiles.current = occupierType === null ? [] : [{ occupierType, hexCoords: { col: 4, row: 5, alt: false } }];
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<FrontierSelectionSheet realm={null} />));
  const sheet = host.querySelector("[data-kit-sheet]")?.getAttribute("aria-label") ?? null;
  act(() => root.unmount());
  return sheet;
};

describe("Frontier's selection sheet", () => {
  it("opens a Frontier card for a chest or a spire, and nothing for a tile without one", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useUIStore.getState().setSelectedHex({ col: 4, row: 5 });
    expect(sheetFor(TileOccupier.Chest)).toBe("Chest");
    expect(sheetFor(TileOccupier.Spire)).toBe("Spire");
    // An empty tile, an unrevealed one, or an army the dock already shows: no card, and never the old inspector.
    expect(sheetFor(TileOccupier.None)).toBeNull();
    expect(sheetFor(null)).toBeNull();
    expect(sheetFor(TileOccupier.ExplorerKnightT1)).toBeNull();
    useUIStore.getState().setSelectedHex(null);
  });

  it("opens a chest for the army beside it, and draws the way there when none stands beside it", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useUIStore.getState().setSelectedHex({ col: 4, row: 5 });
    tiles.current = [{ occupierType: TileOccupier.Chest, hexCoords: { col: 4, row: 5, alt: false } }];
    const render = () => {
      const host = document.createElement("div");
      const root = createRoot(host);
      act(() => root.render(<FrontierSelectionSheet realm={null} />));
      const open = [...host.querySelectorAll("button")].some((button) => button.textContent === "Open");
      const hint = host.querySelector('[aria-label="Bring an army beside the chest"]') !== null;
      act(() => root.unmount());
      return { open, hint };
    };
    expect(render()).toEqual({ open: true, hint: false });
    adjacent.army = null;
    expect(render()).toEqual({ open: false, hint: true });
    adjacent.army = 201;
    useUIStore.getState().setSelectedHex(null);
  });
});

it("offers depth entry from Frontier for an own army at the computed spire", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store } = campBeside();
  store.applyFacts([
    // research.cairo: the depth row's tier sits at bit 46; Ethereal I is researched.
    { model: "RealmKnowledge", key: "0x901", value: { game_id: 1, structure_id: 7, learned: 1n << 46n } },
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
      },
    },
    {
      model: "TileOccupancy",
      key: "0x904",
      // Realm 1's day-0 site, beside its spire: the fixture's clock (t=350) is on day 0.
      value: { game_id: 1, alt: false, col: 5, row: 5, entity_id: 201, category: 15, is_structure: false },
    },
  ] as never);
  useAccountStore.setState({ account: { address: "0x111" } as never });
  useUIStore.getState().updateEntityActionSelectedEntityId(201);
  useUIStore.getState().setSelectedHex({ col: 5, row: 5 });
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
        <FrontierSelectionSheet realm={store.require("Structure", { game_id: 1, entity_id: 7 })} />
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
    useUIStore.getState().updateEntityActionSelectedEntityId(null);
    useUIStore.getState().setSelectedHex(null);
  }
});
