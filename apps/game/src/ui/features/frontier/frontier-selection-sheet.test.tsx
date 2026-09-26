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
vi.mock("./upgrade/building-upgrade", () => ({ BuildingUpgrade: () => null, useSelectedBuilding: () => null }));
vi.mock("./upgrade/castle-upgrade", () => ({ CastleUpgrade: () => null, useKeepSelected: () => null }));

import { useUIStore } from "@/hooks/store/use-ui-store";
import { TileOccupier } from "@bibliothecadao/types";
import { FrontierSelectionSheet } from "./frontier-selection-sheet";

const sheetFor = (occupierType: number | null) => {
  tiles.current = occupierType === null ? [] : [{ occupierType, hexCoords: { col: 4, row: 5, alt: false } }];
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<FrontierSelectionSheet realm={null} />));
  const sheet = host.querySelector("[data-frontier-sheet]")?.getAttribute("aria-label") ?? null;
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
    expect(sheetFor(TileOccupier.ExplorerKnightT1Regular)).toBeNull();
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
