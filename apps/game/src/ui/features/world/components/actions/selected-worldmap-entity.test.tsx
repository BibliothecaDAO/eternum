import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const { selectedTile, crate, founding } = vi.hoisted(() => ({
  selectedTile: { occupierType: 0 },
  /** A crate opened on the tile this session, as the crate store keeps it. */
  crate: { opening: null as null | { relics: number[] } },
  founding: { create: (_site: { col: number; row: number }) => Promise.resolve() },
}));
vi.mock("@/hooks/helpers/use-tile-at", () => ({
  useTileAt: () => ({ biome: 1, occupier_type: selectedTile.occupierType, occupier_id: 900 }),
}));
vi.mock("@/hooks/store/use-relic-crate-store", () => ({ useRelicCrateOpening: () => crate.opening }));
vi.mock("@/ui/features/military/chest/use-adjacent-own-explorer", () => ({ useAdjacentOwnExplorer: () => null }));
vi.mock("./chest-tile-details", () => ({ ChestTileDetails: () => <div data-panel="crate" /> }));
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
  it("says what founding costs and brings, and founds only once confirmed", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useUIStore.getState().selectOnMap({ kind: "hex", hex: { col: 4, row: 5 } });
    const create = vi.fn(() => Promise.resolve());
    founding.create = create;
    const { host, unmount } = mount(TileOccupier.ReservedHyperstructure);
    const button = (word: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === word)!;
    try {
      expect(host.textContent).toContain(
        "Founding is free. It raises a Hyperstructure here, held by The Vanguard behind its guards. Take it from them: +1,000 points",
      );
      act(() => button("Found a Hyperstructure").click());
      expect(create).not.toHaveBeenCalled();
      expect(host.textContent).toContain("Found it? It cannot be undone.");
      await act(async () => button("Found it").click());
      expect(create).toHaveBeenCalledTimes(1);
    } finally {
      unmount();
      useUIStore.getState().selectOnMap(null);
    }
  });
});

describe("a founding confirm", () => {
  const site = (host: HTMLElement) => ({
    button: (word: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === word),
  });

  it("belongs to the site it was asked on: another site selected shows its own Found a Hyperstructure", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    useUIStore.getState().selectOnMap({ kind: "hex", hex: { col: 4, row: 5 } });
    const create = vi.fn((_site: { col: number; row: number }) => Promise.resolve());
    founding.create = create;
    const { host, unmount } = mount(TileOccupier.ReservedHyperstructure);
    const { button } = site(host);
    try {
      act(() => button("Found a Hyperstructure")!.click());
      expect(button("Found it")).toBeDefined();
      act(() => useUIStore.getState().selectOnMap({ kind: "hex", hex: { col: 9, row: 5 } }));
      expect(button("Found it")).toBeUndefined();
      act(() => useUIStore.getState().selectOnMap({ kind: "hex", hex: { col: 4, row: 5 } }));
      expect(button("Found it")).toBeUndefined();

      act(() => useUIStore.getState().selectOnMap({ kind: "hex", hex: { col: 9, row: 5 } }));
      act(() => button("Found a Hyperstructure")!.click());
      await act(async () => button("Found it")!.click());
      expect(create.mock.calls).toEqual([[{ col: 9, row: 5 }]]);
    } finally {
      unmount();
      useUIStore.getState().selectOnMap(null);
    }
  });

  it("closes on Cancel without founding", () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    useUIStore.getState().selectOnMap({ kind: "hex", hex: { col: 4, row: 5 } });
    const create = vi.fn((_site: { col: number; row: number }) => Promise.resolve());
    founding.create = create;
    const { host, unmount } = mount(TileOccupier.ReservedHyperstructure);
    const { button } = site(host);
    try {
      act(() => button("Found a Hyperstructure")!.click());
      act(() => button("Cancel")!.click());
      expect(button("Found it")).toBeUndefined();
      expect(button("Found a Hyperstructure")).toBeDefined();
      expect(create).not.toHaveBeenCalled();
    } finally {
      unmount();
      useUIStore.getState().selectOnMap(null);
    }
  });
});
