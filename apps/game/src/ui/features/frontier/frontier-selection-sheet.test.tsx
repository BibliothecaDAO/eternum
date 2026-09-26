import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const { tiles } = vi.hoisted(() => ({ tiles: { current: [] as { occupierId: number }[] } }));
vi.mock("@/hooks/use-world-spatial-tiles", () => ({ useWorldSpatialTiles: () => tiles.current }));
vi.mock("@/hooks/helpers/use-query", () => ({ useQuery: () => ({ isMapView: true }) }));
vi.mock("@/ui/features/world/components/bottom-right-panel", () => ({
  useSelectedTileDetails: () => <p data-inspector>inspector</p>,
}));
vi.mock("./build/build-sheet", () => ({ BuildSheet: () => null, useOpenPlot: () => null }));
vi.mock("./sites/map-site-card", () => ({ MapSiteCard: () => null, useSelectedMapSite: () => null }));
vi.mock("./sites/tile-card", () => ({ TileCard: () => null, useSelectedSite: () => null }));
vi.mock("./upgrade/building-upgrade", () => ({ BuildingUpgrade: () => null, useSelectedBuilding: () => null }));
vi.mock("./upgrade/castle-upgrade", () => ({ CastleUpgrade: () => null, useKeepSelected: () => null }));

import { useUIStore } from "@/hooks/store/use-ui-store";
import { FrontierSelectionSheet } from "./frontier-selection-sheet";

const inspectorShown = (occupied: { occupierId: number }[]) => {
  tiles.current = occupied;
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<FrontierSelectionSheet realm={null} />));
  const shown = host.querySelector("[data-inspector]") !== null;
  act(() => root.unmount());
  return shown;
};

describe("Frontier's selection sheet", () => {
  it("shows nothing for an empty or unrevealed map tile, and a tile's details only when something stands there", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useUIStore.getState().setSelectedHex({ col: 4, row: 5 });
    expect(inspectorShown([{ occupierId: 0 }])).toBe(false);
    expect(inspectorShown([])).toBe(false);
    expect(inspectorShown([{ occupierId: 201 }])).toBe(true);
    useUIStore.getState().setSelectedHex(null);
  });
});
