import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const { selectedTile, crate, founding } = vi.hoisted(() => ({
  selectedTile: { occupierType: 0, frontier: false },
  /** A crate opened on the tile this session, as the crate store keeps it. */
  crate: { opening: null as null | { relics: number[] } },
  founding: { create: (_site: { col: number; row: number }) => Promise.resolve() },
}));
vi.mock("@/hooks/helpers/use-tile-at", () => ({
  useTileAt: () => ({ biome: 1, occupier_type: selectedTile.occupierType, occupier_id: 900 }),
}));
vi.mock("@/hooks/store/use-chest-opening-store", () => ({ useChestOpening: () => crate.opening }));
vi.mock("@/ui/features/military/chest/use-adjacent-own-explorer", () => ({ useAdjacentOwnExplorer: () => null }));
vi.mock("@/config/game-modes", () => ({
  getGameModeConfig: () => ({ id: selectedTile.frontier ? "frontier" : "blitz" }),
}));
vi.mock("./chest-tile-details", () => ({
  ChestTileDetails: ({ rewardChestId }: { rewardChestId?: number }) => (
    <div data-panel="crate" data-reward-chest={rewardChestId} />
  ),
}));
vi.mock("@/hooks/use-blitz-hyperstructure-creation", () => ({
  useBlitzHyperstructureCreation: ({ contractHex }: { contractHex: { col: number; row: number } }) => ({
    canCreate: true,
    isCreating: false,
    createHyperstructure: () => founding.create(contractHex),
  }),
}));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  configManager: {
    getActiveGameId: () => 1,
    getVictoryPointGrants: () => ({ claimHyperstructureFromBandits: 1000 }),
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
    expect(panelFor(TileOccupier.Shrine)).toBe("tile");
    expect(panelFor(TileOccupier.Well)).toBe("tile");
    useUIStore.getState().selectOnMap(null);
  });
});

describe("a tile with an army and a crate it opened", () => {
  it("shows the army first, the opened crate under it; the crate alone once no army stands there", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useUIStore.getState().selectOnMap({ kind: "hex", hex: { col: 4, row: 5 } });
    crate.opening = { relics: [41, 42, 43] };
    try {
      expect(panelsFor(TileOccupier.ExplorerPaladinT2)).toEqual(["army", "crate"]);
      expect(panelsFor(TileOccupier.None)).toEqual(["crate"]);
    } finally {
      crate.opening = null;
      useUIStore.getState().selectOnMap(null);
    }
  });
});

describe("a reserved Hyperstructure site", () => {
  it("is founded by Create here at once, for the site shown", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    useUIStore.getState().selectOnMap({ kind: "hex", hex: { col: 4, row: 5 } });
    const create = vi.fn((_site: { col: number; row: number }) => Promise.resolve());
    founding.create = create;
    const { host, unmount } = mount(TileOccupier.ReservedHyperstructure);
    try {
      expect(host.textContent).toContain(
        "Reserved for a future Hyperstructure. Create it here or double-click the tile.",
      );
      const createHere = [...host.querySelectorAll("button")].find((button) => button.textContent === "Create here")!;
      await act(async () => createHere.click());
      expect(create.mock.calls).toEqual([[{ col: 4, row: 5 }]]);
    } finally {
      unmount();
      useUIStore.getState().selectOnMap(null);
    }
  });
});

it("keeps chest focus and supplies only Frontier's reward metadata ID, never a sealed relic pack ID", () => {
  useUIStore.getState().selectOnMap({ kind: "hex", hex: { col: 4, row: 5 } });
  for (const frontier of [false, true]) {
    selectedTile.frontier = frontier;
    const { host, unmount } = mount(TileOccupier.Chest);
    try {
      expect(host.querySelector('[data-panel="crate"]')).not.toBeNull();
      expect(host.querySelector('[data-panel="crate"]')?.getAttribute("data-reward-chest")).toBe(
        frontier ? "900" : null,
      );
    } finally {
      unmount();
    }
  }
  selectedTile.frontier = false;
  useUIStore.getState().selectOnMap(null);
});
