import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { tiles } = vi.hoisted(() => ({
  tiles: {
    current: [] as { occupierType: number; occupierId?: number; occupierIsStructure?: boolean; hexCoords: object }[],
  },
}));
vi.mock("@/hooks/use-world-spatial-tiles", () => ({ useWorldSpatialTiles: () => tiles.current }));
vi.mock("@/hooks/helpers/use-query", () => ({ useQuery: () => ({ isMapView: true }) }));
vi.mock("./build/build-sheet", () => ({ BuildSheet: () => null, useOpenPlot: () => null }));
vi.mock("./sites/map-site-card", () => ({ MapSiteCard: () => null, useSelectedMapSite: () => null }));
vi.mock("./upgrade/castle-upgrade", () => ({ CastleUpgrade: () => null, useKeepSelected: () => null }));
vi.mock("@/ui/features/military/chest/use-adjacent-own-explorer", () => ({ useAdjacentOwnExplorer: () => 201 }));
vi.mock("./research/selected-building", () => ({ useSelectedBuildingRow: () => null }));

import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChestOpeningStore } from "@/hooks/store/use-chest-opening-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { onChestOpenRequest } from "@/three/scenes/worldmap-chest-open-request";
import { ChestOpenings } from "@/ui/features/military/chest/chest-openings";
import { campBeside, reloadSiteFacts, SITE, SITE_TILE } from "./sites/site-fixture";
import { useUIStore } from "@/hooks/store/use-ui-store";
import {
  expeditionSpireTile,
  readExpeditionRules,
  setBlockTimestampSource,
  setEntityNameLocalStorage,
} from "@bibliothecadao/eternum";
import { getNeighborHexes, siteName, TileOccupier } from "@bibliothecadao/types";
import { useSelectionCard } from "./frontier-selection-sheet";
import { useOnePanel } from "./hud/one-panel";
import { fightEnded } from "./sites/fight-result";

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

describe("Frontier's selection sheet", () => {
  it.each([
    { reload: false, occupied: false, renamed: false },
    { reload: false, occupied: true, renamed: false },
    { reload: true, occupied: false, renamed: false },
    { reload: true, occupied: true, renamed: false },
    { reload: true, occupied: true, renamed: true },
  ])(
    "opens the cleared receipt after deletion (reload: $reload, own army: $occupied, renamed: $renamed)",
    async ({ reload, occupied, renamed }) => {
      Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
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
      const store = reload ? reloadSiteFacts(fixture.store) : fixture.store;
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
      useAccountStore.setState({ account: { address: "0x111" } as never });
      useUIStore.getState().setMapLayer(false);
      useUIStore.getState().selectOnMap({ kind: "hex", hex: SITE_TILE });
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
        expect(host.querySelector("[data-kit-sheet]")?.getAttribute("aria-label")).toBe(expectedName);
        expect(host.textContent).toContain("Cleared · Troll");
        expect(host.textContent).toContain("550 Labor");
        expect(host.textContent).toContain("82 XP");
        const close = host.querySelector<HTMLButtonElement>('button[aria-label="Close"]');
        expect(close).not.toBeNull();
        await act(async () => close!.click());
        expect(host.querySelector("[data-kit-sheet]")).toBeNull();
        await act(async () => useUIStore.getState().selectOnMap({ kind: "hex", hex: SITE_TILE }));
        expect(host.querySelector("[data-kit-sheet]")?.getAttribute("aria-label")).toBe(expectedName);
        expect(host.querySelector("[data-site-rewards]")?.textContent).toBe("550 Labor82 XP");
      } finally {
        act(() => root.unmount());
        useUIStore.getState().selectOnMap(null);
        useAccountStore.setState({ account: null });
        tiles.current = [];
        localStorage.removeItem(`entity-name-${SITE}`);
      }
    },
  );

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

/** The realm's army standing beside its spire, Ethereal I researched: the spire's card opens for it. */
const armyAtSpire = () => {
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
  return { store, beside };
};

it("offers depth entry from Frontier for an own army at the computed spire", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store, beside } = armyAtSpire();
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

it("stands Research alone over the spire card of an army selected with no tile, and shows the next selection's card", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store, beside } = armyAtSpire();
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  /** The HUD's card and surface, both through the one panel; Research and its close as their buttons. */
  const Hud = () => {
    const card = useSelectionCard({ realm, onResearch: () => undefined });
    const { surface, openSurface, showsCard } = useOnePanel(card?.key ?? null);
    return (
      <>
        <button type="button" onClick={() => openSurface("research")}>
          Research
        </button>
        <button type="button" onClick={() => openSurface(null)}>
          Close
        </button>
        {surface && <section data-kit-sheet aria-label={surface} />}
        {showsCard && card?.sheet}
      </>
    );
  };
  // The army selected with no tile: its spire's card stands.
  useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: null });
  tiles.current = [];
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={{ store, systemCalls: {} } as never} account={{ address: "0x111" } as never}>
        <Hud />
      </GameProvider>,
    ),
  );
  const press = (word: string) =>
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === word)!.click());
  const sheets = () => [...host.querySelectorAll("[data-kit-sheet]")].map((sheet) => sheet.getAttribute("aria-label"));
  try {
    expect(sheets()).toEqual(["Spire"]);

    press("Research");
    expect(sheets()).toEqual(["research"]);
    // Closed and opened again, Research still stands alone; the card waits for the next selection.
    press("Close");
    expect(sheets()).toEqual([]);
    press("Research");
    expect(sheets()).toEqual(["research"]);

    // The next selection, the army on its tile beside the spire, opens its card in Research's place.
    act(() =>
      useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: { col: beside.col, row: beside.row } }),
    );
    expect(sheets()).toEqual(["Spire"]);
  } finally {
    act(() => root.unmount());
    useUIStore.getState().selectOnMap(null);
  }
});

it("selects a Frontier chest, follows missing metadata and expiry across clock ticks, opens through the world bridge and retains its receipt", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { store } = campBeside();
  const chestHex = { col: 4, row: 5 };
  const chestTile = { occupierType: TileOccupier.Chest, occupierId: 900, hexCoords: { ...chestHex, alt: false } };
  tiles.current = [chestTile];
  useAccountStore.setState({ account: { address: "0x111" } as never });
  const previousClock = useChainTimeStore.getState();
  let elapsedMs = 0;
  const performanceNow = vi.spyOn(performance, "now").mockImplementation(() => elapsedMs);
  useChainTimeStore.getState().anchor({ timestamp: 350_000, source: "herald-head" });
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
          <FrontierSelectionSheet realm={null} onResearch={() => undefined} />
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
    await act(async () => {
      elapsedMs = 1_000;
      useChainTimeStore.getState().tick();
    });
    expect(useChainTimeStore.getState().nowMs).toBe(351_000);
    expect(host.textContent).toContain("17 LORDS");
    expect(host.textContent).toContain("Expires at day rollover");
    expect(host.textContent).not.toContain("Chain time is not known yet");
    await act(async () => {
      elapsedMs = 49_999;
      useChainTimeStore.getState().tick();
    });
    expect(host.textContent).toContain("17 LORDS");
    await act(async () => {
      elapsedMs = 50_000;
      useChainTimeStore.getState().tick();
    });
    expect(useChainTimeStore.getState().nowMs).toBe(400_000);
    expect(host.textContent).toContain("0 LORDS");
    expect(host.textContent).toContain("Reservation expired");
    await act(async () => useChainTimeStore.getState().anchor({ timestamp: 350_000, source: "herald-head" }));
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
    performanceNow.mockRestore();
    useChainTimeStore.setState(previousClock);
  }
});

it.each([
  ["Camp", "Troll", "beast-troll", siteName(SITE)],
  ["Beasts", "Wraith", "beast-wraith", siteName(SITE)],
  ["Rift", "Rift", "beast-dark-fey", siteName(SITE)],
  ["Army", "Army", "attack", "Army"],
] as const)(
  "titles the %s result sheet as its card was, by the site's map name, and closes it on Escape",
  (site, name, art, title) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store } = campBeside();
    tiles.current = [];
    useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: { col: 4, row: 5 } });
    fightEnded({
      targetId: SITE,
      site,
      guardIdentity: { name, art },
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
          <FrontierSelectionSheet realm={null} onResearch={() => undefined} />
        </GameProvider>,
      ),
    );
    expect(host.querySelector("[data-kit-sheet]")?.getAttribute("aria-label")).toBe(title);

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));

    expect(host.querySelector("[data-kit-sheet]")).toBeNull();
    expect(useUIStore.getState().mapSelection).toEqual({
      kind: "army",
      entityId: 201,
      tile: null,
    });
    act(() => root.unmount());
    useUIStore.getState().selectOnMap(null);
  },
);
