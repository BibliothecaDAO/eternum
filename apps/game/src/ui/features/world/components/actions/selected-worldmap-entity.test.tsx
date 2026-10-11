import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const { selectedTile } = vi.hoisted(() => ({ selectedTile: { occupierType: 0 } }));
vi.mock("@/hooks/helpers/use-tile-at", () => ({
  useTileAt: () => ({ biome: 1, occupier_type: selectedTile.occupierType, occupier_id: 900 }),
}));
vi.mock("@/hooks/store/use-relic-crate-store", () => ({ useRelicCrateOpening: () => null }));
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
import { SelectedWorldmapEntity } from "./selected-worldmap-entity";

const panelFor = (occupierType: TileOccupier) => {
  selectedTile.occupierType = occupierType;
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<SelectedWorldmapEntity />));
  const panel = host.querySelector("[data-panel]")?.getAttribute("data-panel") ?? null;
  act(() => root.unmount());
  return panel;
};

describe("the selected tile panel", () => {
  it("opens the army panel for an army only, never for a shrine or well", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useUIStore.getState().setSelectedHex({ col: 4, row: 5 });
    expect(panelFor(TileOccupier.ExplorerPaladinT2)).toBe("army");
    expect(panelFor(TileOccupier.Shrine)).toBe("tile");
    expect(panelFor(TileOccupier.Well)).toBe("tile");
    useUIStore.getState().setSelectedHex(null);
  });
});
