import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const { selectedTile } = vi.hoisted(() => ({ selectedTile: { occupierType: 0 } }));
vi.mock("@/hooks/helpers/use-tile-at", () => ({
  useTileAt: () => ({ biome: 1, occupier_type: selectedTile.occupierType, occupier_id: 900 }),
}));
vi.mock("@/hooks/store/use-relic-crate-store", () => ({ useRelicCrateOpening: () => null }));
// The panel titles itself with the tile's normalized coordinates, which need the game's map config.
vi.mock("@/ui/features/world/components/bottom-right-panel/tile-panel-title", () => ({
  formatTilePanelTitle: (label: string) => label,
}));
vi.mock("@/ui/features/world/components/entities/hooks/use-army-entity-detail", () => ({
  useArmyEntityDetail: () => ({ explorer: undefined }),
}));
vi.mock("@/ui/features/world/components/entities/banner/army-banner-entity-detail", () => ({
  ArmyBannerEntityDetail: () => <div data-panel="army" />,
}));
vi.mock("@/ui/features/world/components/actions/unoccupied-tile-quadrants", () => ({
  BiomeSummaryCard: () => null,
  UnoccupiedTileQuadrants: () => <div data-panel="tile" />,
}));

import { useUIStore } from "@/hooks/store/use-ui-store";
import { TileOccupier } from "@bibliothecadao/types";
import { type MapTileParts, SelectedWorldmapEntity } from "./selected-worldmap-entity";

const panelFor = (occupierType: TileOccupier) => {
  selectedTile.occupierType = occupierType;
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<SelectedWorldmapEntity />));
  const panel = host.querySelector("[data-panel]")?.getAttribute("data-panel") ?? null;
  act(() => root.unmount());
  return panel;
};

/** What the panel hands a HUD that lays its parts out itself: which panel each part draws. */
const partsFor = (occupierType: TileOccupier) => {
  selectedTile.occupierType = occupierType;
  const host = document.createElement("div");
  const root = createRoot(host);
  let word: string | null = null;
  const layout = (parts: MapTileParts) => {
    word = parts.occupantWord;
    return (
      <>
        <div data-part="occupant">{parts.occupant}</div>
        <div data-part="biome">{parts.biome}</div>
      </>
    );
  };
  act(() => root.render(<SelectedWorldmapEntity layout={layout} />));
  const drawn = (part: string) =>
    host.querySelector(`[data-part="${part}"] [data-panel]`)?.getAttribute("data-panel") ?? null;
  const parts = { word, occupant: drawn("occupant"), biome: drawn("biome") };
  act(() => root.unmount());
  return parts;
};

describe("the selected tile panel", () => {
  it("opens the army panel for an army only, never for a shrine or well", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useUIStore.getState().selectOnMap({ kind: "hex", hex: { col: 4, row: 5 } });
    expect(panelFor(TileOccupier.ExplorerPaladinT2)).toBe("army");
    expect(panelFor(TileOccupier.Shrine)).toBe("tile");
    expect(panelFor(TileOccupier.Well)).toBe("tile");
    useUIStore.getState().selectOnMap(null);
  });

  it("hands a HUD an army and its biome apart, and a bare shrine its biome alone", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useUIStore.getState().selectOnMap({ kind: "hex", hex: { col: 4, row: 5 } });
    expect(partsFor(TileOccupier.ExplorerPaladinT2)).toEqual({ word: "Army", occupant: "army", biome: null });
    expect(partsFor(TileOccupier.Shrine)).toEqual({ word: null, occupant: null, biome: "tile" });
    useUIStore.getState().selectOnMap(null);
  });
});
