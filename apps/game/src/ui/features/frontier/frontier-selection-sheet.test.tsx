import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/sync/action-outcome", async (original) => ({
  ...(await original<typeof import("@/sync/action-outcome")>()),
  untilApplied: async (sent: Promise<unknown>) => {
    await sent;
    return "0x1";
  },
}));

const { tiles } = vi.hoisted(() => ({
  tiles: {
    current: [] as {
      occupierType: number;
      occupierId?: number;
      occupierIsStructure?: boolean;
      hexCoords: { col: number; row: number; alt?: boolean };
    }[],
  },
}));
// The world's tiles at the hexes asked, as the spatial reader answers: none once nothing is selected.
vi.mock("@/hooks/use-world-spatial-tiles", () => ({
  useWorldSpatialTiles: (hexes: Array<{ col: number; row: number }>) =>
    tiles.current.filter((tile) =>
      hexes.some((hex) => hex.col === tile.hexCoords.col && hex.row === tile.hexCoords.row),
    ),
}));
vi.mock("@/hooks/helpers/use-query", () => ({ useQuery: () => ({ isMapView: true }) }));
vi.mock("./build/build-sheet", () => ({ BuildSheet: () => null, useOpenPlot: () => null }));
vi.mock("./sites/map-site-card", () => ({ MapSiteCard: () => null, useSelectedMapSite: () => null }));
vi.mock("./upgrade/castle-upgrade", () => ({ CastleUpgrade: () => null, useKeepSelected: () => null }));
const { tapped } = vi.hoisted(() => ({
  tapped: { current: null as { category: number; innerCol: number; innerRow: number } | null },
}));
vi.mock("./research/selected-building", () => ({ useTappedBuilding: () => tapped.current }));
vi.mock("./building/building-card", () => ({
  BuildingCard: ({ building }: { building: { category: number } }) => <div data-building-card={building.category} />,
}));

import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { campBeside, otherArmyAt, reloadSiteFacts, SITE, SITE_TILE } from "./sites/site-fixture";
import { attachMapSelectionPositions } from "@/hooks/store/map-selection";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { configManager, setBlockTimestampSource, setEntityNameLocalStorage } from "@bibliothecadao/eternum";
import { BuildingType, siteName, TileOccupier } from "@bibliothecadao/types";
import { transferArmies, TRANSFER_TAPPED } from "./army/transfer-fixture";
import { useSelectionCard } from "./frontier-selection-sheet";

/** The selection's card as the HUD draws it. */
const FrontierSelectionSheet = (props: Parameters<typeof useSelectionCard>[0]) =>
  useSelectionCard(props)?.sheet ?? null;

afterEach(() => setBlockTimestampSource(null));

const sheetFor = (occupierType: number | null) => {
  const { store } = campBeside();
  useAccountStore.setState({ account: { address: "0x111" } as never });
  tiles.current =
    occupierType === null
      ? []
      : [
          {
            occupierType,
            occupierId: occupierType === TileOccupier.ExplorerKnightT1 ? 201 : 0,
            hexCoords: { col: 4, row: 5, alt: false },
          },
        ];
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={{ store } as never} account={{ address: "0x111" } as never}>
        <FrontierSelectionSheet realm={null} onResearch={() => undefined} />
      </GameProvider>,
    ),
  );
  const sheet = host.querySelector("[data-kit-sheet]")?.getAttribute("aria-label") ?? null;
  act(() => root.unmount());
  useAccountStore.setState({ account: null });
  return sheet;
};

/** The camp beside the realm cleared by army 201 and its structure gone, the army standing on it if `occupied`. */
const clearedCamp = ({ occupied, reload }: { occupied: boolean; reload: boolean }) => {
  const fixture = campBeside();
  fixture.store.applyFacts([
    {
      model: "TileOccupancy",
      key: "0x90",
      value: { game_id: 1, ...SITE_TILE, entity_id: SITE, category: TileOccupier.Camp, is_structure: true },
    },
  ]);
  fixture.store.applyFacts([
    {
      model: "ExpeditionSite",
      key: "0x72",
      value: {
        ...fixture.site,
        clear: {
          explorer_id: 201n,
          home_id: 7n,
          reward: { resource_type: 23, amount: 550_000_000_000n },
        },
      },
    },
    { model: "Structure", key: "0x71", value: null },
    { model: "Guard", key: "0x73", value: null },
    { model: "TileOccupancy", key: "0x90", value: null },
  ]);
  if (occupied)
    fixture.store.applyFacts([
      { model: "TileOccupancy", key: "0x75", value: null },
      {
        model: "TileOccupancy",
        key: "0x91",
        value: {
          game_id: 1,
          ...SITE_TILE,
          entity_id: 201,
          category: TileOccupier.ExplorerKnightT1,
          is_structure: false,
        },
      },
    ]);
  return reload ? reloadSiteFacts(fixture.store) : fixture.store;
};

describe("Frontier's selection sheet", () => {
  it.each([
    { reload: false, occupied: false, foreign: false, renamed: false },
    { reload: false, occupied: true, foreign: false, renamed: false },
    { reload: true, occupied: false, foreign: false, renamed: false },
    { reload: true, occupied: true, foreign: false, renamed: false },
    { reload: true, occupied: true, foreign: false, renamed: true },
    { reload: false, occupied: true, foreign: true, renamed: false },
    { reload: true, occupied: true, foreign: true, renamed: false },
    { reload: true, occupied: true, foreign: true, renamed: true },
  ])(
    "opens the cleared receipt, named once by its site, after deletion (reload: $reload, army on it: $occupied, another player's: $foreign, renamed: $renamed)",
    async ({ reload, occupied, foreign, renamed }) => {
      // The army on the tile is the viewer's own, or, seen from another account, someone else's.
      const viewer = foreign ? "0x222" : "0x111";
      Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
      const store = clearedCamp({ occupied, reload });
      const expectedName = renamed ? "North Watch" : siteName(SITE);
      if (renamed) setEntityNameLocalStorage(SITE, expectedName);
      expect(store.get("Structure", { game_id: 1, entity_id: SITE })).toBeUndefined();
      expect(store.get("Guard", { game_id: 1, structure_id: SITE, slot: 0 })).toBeUndefined();
      expect(store.entityOccupancy(1, SITE)).toBeUndefined();
      if (occupied) expect(store.entityOccupancy(1, 201)).toMatchObject(SITE_TILE);
      tiles.current = occupied
        ? [
            {
              occupierType: TileOccupier.ExplorerKnightT1,
              occupierId: 201,
              occupierIsStructure: false,
              hexCoords: SITE_TILE,
            },
          ]
        : [];
      useAccountStore.setState({ account: { address: viewer } as never });
      useUIStore.getState().setMapLayer(false);
      useUIStore.getState().selectOnMap({ kind: "hex", hex: SITE_TILE });
      const host = document.createElement("div");
      const root = createRoot(host);
      try {
        await act(async () =>
          root.render(
            <GameProvider value={{ store } as never} account={{ address: viewer } as never}>
              <FrontierSelectionSheet realm={null} onResearch={() => undefined} />
            </GameProvider>,
          ),
        );
        const sheet = host.querySelector("[data-kit-sheet]")!;
        expect(sheet.getAttribute("aria-label")).toBe("Supply Post");
        expect(sheet.querySelector(".ui-frame__head .ui-chip")?.textContent).toBe(expectedName);
        expect(sheet.textContent!.split(expectedName).length - 1).toBe(1);
        expect(host.textContent).toContain("Cleared · Golem");
        expect(host.textContent).toContain("550 Labor");
        const close = host.querySelector<HTMLButtonElement>('button[aria-label="Close"]');
        expect(close).not.toBeNull();
        await act(async () => close!.click());
        expect(host.querySelector("[data-kit-sheet]")).toBeNull();
        await act(async () => useUIStore.getState().selectOnMap({ kind: "hex", hex: SITE_TILE }));
        expect(host.querySelector("[data-kit-sheet]")?.getAttribute("aria-label")).toBe("Supply Post");
        expect(host.querySelector("[data-kit-sheet]")!.textContent).toContain(expectedName);
        expect(host.querySelector("[data-site-rewards]")?.textContent).toBe("550 Labor");
      } finally {
        act(() => root.unmount());
        useUIStore.getState().selectOnMap(null);
        useAccountStore.setState({ account: null });
        tiles.current = [];
        localStorage.removeItem(`entity-name-${SITE}`);
      }
    },
  );

  // Owner, 28 October 2026: "when I click on a tile that was cleared but an army is standing on it, army panel must be
  // displayed not the cleared one".
  it("opens no card over the player's own army on a cleared site; the clear's Feed link opens its receipt", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const store = clearedCamp({ occupied: true, reload: false });
    tiles.current = [
      {
        occupierType: TileOccupier.ExplorerKnightT1,
        occupierId: 201,
        occupierIsStructure: false,
        hexCoords: SITE_TILE,
      },
    ];
    const giveBackPositions = attachMapSelectionPositions({
      army: (id) => (Number(id) === 201 ? { col: SITE_TILE.col, row: SITE_TILE.row, alt: false } : undefined),
      structure: () => undefined,
    });
    useAccountStore.setState({ account: { address: "0x111" } as never });
    useUIStore.getState().setMapLayer(false);
    const host = document.createElement("div");
    const root = createRoot(host);
    try {
      await act(async () =>
        root.render(
          <GameProvider value={{ store } as never} account={{ address: "0x111" } as never}>
            <FrontierSelectionSheet realm={null} onResearch={() => undefined} />
          </GameProvider>,
        ),
      );
      // The map's tap on the army: the army selected where it stands, its tile the cleared site's.
      await act(async () => useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: "own" }));
      expect(useUIStore.getState().selectedHex).toEqual({ col: SITE_TILE.col, row: SITE_TILE.row });
      expect(host.querySelector("[data-kit-sheet]")).toBeNull();
      // The clear's row in the Feed selects the tile itself, as every match link does (openOnMap's "tile").
      await act(async () => useUIStore.getState().selectOnMap({ kind: "hex", hex: SITE_TILE }));
      expect(host.querySelector("[data-kit-sheet]")?.getAttribute("aria-label")).toBe("Supply Post");
      expect(host.querySelector("[data-kit-sheet] .ui-frame__head .ui-chip")?.textContent).toBe(siteName(SITE));
      expect(host.textContent).toContain("Cleared · Golem");
    } finally {
      act(() => root.unmount());
      giveBackPositions();
      useUIStore.getState().selectOnMap(null);
      useAccountStore.setState({ account: null });
      tiles.current = [];
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

  it("opens an attack card on another player's army only where the game takes an army's attack on another", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const enemySheet = (battle: boolean) => {
      const { store } = campBeside();
      otherArmyAt(store, 4, 5);
      const enabled = configManager.isCommandEnabled.bind(configManager);
      const spy = vi
        .spyOn(configManager, "isCommandEnabled")
        .mockImplementation((command) => (command === "Battle" ? battle : enabled(command)));
      tiles.current = [{ occupierType: TileOccupier.ExplorerKnightT1, occupierId: 301, hexCoords: { col: 4, row: 5 } }];
      useUIStore.getState().selectOnMap({ kind: "hex", hex: { col: 4, row: 5 } });
      const host = document.createElement("div");
      const root = createRoot(host);
      act(() =>
        root.render(
          <GameProvider value={{ store } as never} account={{ address: "0x111" } as never}>
            <FrontierSelectionSheet realm={null} onResearch={() => undefined} />
          </GameProvider>,
        ),
      );
      const sheet = host.querySelector("[data-kit-sheet]")?.getAttribute("aria-label") ?? null;
      act(() => root.unmount());
      spy.mockRestore();
      useUIStore.getState().selectOnMap(null);
      tiles.current = [];
      return sheet;
    };

    // Where the game leaves Battle out, as Frontier's preset does, the contract would refuse the attack: no card offers it.
    expect(enemySheet(false)).toBeNull();
    expect(enemySheet(true)).toBe("Army");
  });
});

it("the map's actual transfer selection shows the survivor before the player confirms", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const store = transferArmies(2, 0);
  useAccountStore.setState({ account: { address: "0x111" } as never });
  tiles.current = [];
  useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: TRANSFER_TAPPED });
  const swap = vi.fn().mockResolvedValue({ transaction_hash: "0x1" });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() =>
      root.render(
        <GameProvider
          value={{ store, systemCalls: { explorer_explorer_swap: swap } } as never}
          account={{ address: "0x111" } as never}
        >
          <FrontierSelectionSheet
            realm={store.require("Structure", { game_id: 1, entity_id: 7 })}
            onResearch={() => undefined}
          />
        </GameProvider>,
      ),
    );
    expect(host.querySelector('[role="dialog"]')?.getAttribute("aria-label")).toBe("Transfer troops");
    const expectMergePreview = () => {
      expect(host.querySelector(".ui-notice")?.textContent).toBe(
        "Army 1 loses its Logistics, Oath slots and held Oaths.",
      );
      expect(host.querySelector("s")).toBeNull();
      expect(host.textContent).toContain("100/180→7");
    };
    expectMergePreview();
    expect(swap).not.toHaveBeenCalled();
    const confirm = [...host.querySelectorAll("button")].find((button) => button.textContent === "Merge into Army 2")!;
    await act(async () => confirm.click());
    expect(swap).not.toHaveBeenCalled();
    // Confirming the loss preserves the preview; only the final press sends the transfer.
    expectMergePreview();
    const final = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Confirm merge into Army 2",
    )!;
    await act(async () => final.click());
    expect(swap).toHaveBeenCalledWith(
      expect.objectContaining({ from_explorer_id: 201, to_explorer_id: 202, count: 600_000_000_000 }),
    );
  } finally {
    act(() => root.unmount());
    host.remove();
    useUIStore.getState().selectOnMap(null);
    useAccountStore.setState({ account: null });
  }
});

it("opens a building tapped on the realm's board as its own card, never the Research page", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { store } = campBeside();
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  tapped.current = { category: BuildingType.ResourceWheat, innerCol: 11, innerRow: 10 };
  const onResearch = vi.fn();
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={{ store } as never} account={{ address: "0x111" } as never}>
        <FrontierSelectionSheet realm={realm} onResearch={onResearch} />
      </GameProvider>,
    ),
  );
  expect(host.querySelector("[data-building-card]")?.getAttribute("data-building-card")).toBe(
    String(BuildingType.ResourceWheat),
  );
  expect(onResearch).not.toHaveBeenCalled();
  act(() => root.unmount());
  tapped.current = null;
});
