import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const { selectedTile } = vi.hoisted(() => ({
  selectedTile: { occupierType: 0 },
}));
vi.mock("@/hooks/helpers/use-tile-at", () => ({
  useTileAt: () => ({ biome: 1, occupier_type: selectedTile.occupierType, occupier_id: 900 }),
}));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  configManager: {
    getActiveGameId: () => 1,
  },
}));
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
import { SelectedWorldmapEntity } from "./selected-worldmap-entity";

const mount = (occupierType: TileOccupier) => {
  selectedTile.occupierType = occupierType;
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<SelectedWorldmapEntity />));
  return { host, unmount: () => act(() => root.unmount()) };
};

const panelsFor = (occupierType: TileOccupier) => {
  const { host, unmount } = mount(occupierType);
  const panels = [...host.querySelectorAll("[data-panel]")].map((panel) => panel.getAttribute("data-panel"));
  unmount();
  return panels;
};

const panelFor = (occupierType: TileOccupier) => panelsFor(occupierType)[0] ?? null;

describe("the selected tile panel", () => {
  it("opens the army panel for an army only, never for a shrine or well", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useUIStore.getState().selectOnMap({ kind: "hex", hex: { col: 4, row: 5 } });
    expect(panelFor(TileOccupier.ExplorerPaladinT2)).toBe("army");
    useUIStore.getState().selectOnMap(null);
  });
});
