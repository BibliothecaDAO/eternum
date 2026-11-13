import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

// The world's tiles: the spire the realm found occupies its own tile as a spire, as the map's projection shows it.
const world = vi.hoisted(() => ({ spire: null as { col: number; row: number } | null }));
vi.mock("@/hooks/use-world-spatial-tiles", () => ({
  useWorldSpatialTiles: (hexes: readonly { col: number; row: number }[]) =>
    hexes
      .filter((hex) => hex.col === world.spire?.col && hex.row === world.spire?.row)
      .map((hex) => ({ hexCoords: hex, occupierType: TileOccupier.Spire, occupierId: 0, occupierIsStructure: false })),
}));
vi.mock("@/hooks/helpers/use-query", () => ({ useQuery: () => ({ isMapView: true }) }));
vi.mock("./build/build-sheet", () => ({ BuildSheet: () => null, useOpenPlot: () => null }));
vi.mock("./upgrade/castle-upgrade", () => ({ CastleUpgrade: () => null, useKeepSelected: () => null }));
vi.mock("./research/selected-building", () => ({ useTappedBuilding: () => null }));
// The order's outcome, as the game client reports it once the chain applies it.
vi.mock("@/sync/active-game-client", async (original) => ({
  ...(await original<typeof import("@/sync/active-game-client")>()),
  requireActiveGameClient: () => ({
    waitForAction: () => Promise.resolve({ hash: "0x1", block: 9, status: "SUCCEEDED" }),
  }),
}));

import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useBlockTimestampStore } from "@/hooks/store/use-block-timestamp-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import {
  ActionPaths,
  ActionType,
  ArmyActionManager,
  configManager,
  expeditionDepth,
  setBlockTimestampSource,
} from "@bibliothecadao/eternum";
import { StructureType, TileOccupier } from "@bibliothecadao/types";
import { attachMapSelectionPositions } from "@/hooks/store/map-selection";
import { useArmyPanelOpens } from "./army/army-opens";
import { SpireButton, SpireOdds, useArmyAtItsSpire } from "./spire-card";
import { useSelectionCard } from "./frontier-selection-sheet";
import { useOnePanel } from "./hud/one-panel";
import { SPIRE_ARMY, SPIRE_DAY_NOW, spireDay as spireFixture } from "./spire-fixture";

const ARMY = SPIRE_ARMY;
const NOW = SPIRE_DAY_NOW;

/** The fixture's day, read at its second as the HUD reads the clock. */
const spireDay = (options?: Parameters<typeof spireFixture>[0]) => {
  const day = spireFixture(options);
  world.spire = day.spire;
  setBlockTimestampSource(() => NOW);
  useBlockTimestampStore.setState({ currentBlockTimestamp: NOW, currentDefaultTick: NOW });
  return day;
};

/** The HUD's selection card, as both layouts mount it, with Research's door recorded. */
const renderHud = (store: ReturnType<typeof spireDay>["store"], viewer = "0x111") => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useAccountStore.setState({ account: { address: viewer } as never });
  const enter = vi.fn().mockResolvedValue({ transaction_hash: "0x1" });
  const research = vi.fn();
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  const Hud = () => useSelectionCard({ realm, onResearch: research })?.sheet ?? null;
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider
        value={{ store, systemCalls: { enter_depth: enter } } as never}
        account={{ address: viewer } as never}
      >
        <Hud />
      </GameProvider>,
    ),
  );
  const sheet = () => host.querySelector("[data-kit-sheet]");
  /** Each depth the card lists: its name, its line (the cost, or why not) and whether Enter takes it. */
  const depths = () =>
    [...host.querySelectorAll("[data-spire-depths] .ui-row")].map((row) => ({
      depth: row.querySelector(".ui-row__title")?.textContent,
      line: row.querySelector(".ui-row__detail")?.textContent,
      button: row.querySelector("button")?.textContent,
      enabled: row.querySelector("button")?.disabled === false,
    }));
  const press = async (label: string) => {
    const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    expect(button, label).not.toBeNull();
    await act(async () => button!.click());
  };
  return { host, sheet, depths, press, enter, research, unmount: () => act(() => root.unmount()) };
};

/** A tap on the spire with the army selected: the map keeps the army and selects the spire's tile for it. */
const tapSpireWithArmy = (spire: { col: number; row: number }) =>
  act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: ARMY, tile: spire }));

afterEach(() => {
  vi.restoreAllMocks();
  useUIStore.getState().selectOnMap(null);
  useAccountStore.setState({ account: null });
  setBlockTimestampSource(null);
});

describe("a realm's spire, from the player's path", () => {
  it("offers the army beside it the one layer below without an entry cost, enters it, and says the army is there", async () => {
    const { store, rules, spire, armyTile } = spireDay();
    const hud = renderHud(store);
    try {
      tapSpireWithArmy(spire);
      expect(hud.sheet()?.getAttribute("aria-label")).toBe("Spire");
      expect(hud.sheet()!.textContent).toContain("Army");
      expect(hud.depths()).toEqual([{ depth: "Ethereal I", line: undefined, button: "Enter", enabled: true }]);
      // What entering commits the army to, before it goes: the rest of the day, with no way back up.
      expect(hud.host.querySelector("[data-spire-commitment]")?.textContent).toMatch(
        /^Army( \d+)? stays until the day ends \(.+\)$/,
      );

      await hud.press("Enter Ethereal I");
      expect(hud.enter).toHaveBeenCalledTimes(1);
      expect(hud.enter).toHaveBeenCalledWith(expect.objectContaining({ explorerId: ARMY, depth: 1 }));

      // The chain's answer: the army lands on the nearest free tile below the spire, one region down.
      const landing = { col: spire.col, row: spire.row + rules.spacing };
      act(() =>
        store.applyFacts([
          { model: "TileOccupancy", key: "0x904", value: null },
          {
            model: "TileOccupancy",
            key: "0x906",
            value: { game_id: 1, alt: false, ...landing, entity_id: ARMY, category: 15, is_structure: false },
          },
        ] as never),
      );
      expect(expeditionDepth(rules, { y: store.entityOccupancy(1, ARMY)!.row })).toBe(1);
      expect(armyTile.row).toBeLessThan(landing.row);
      expect(hud.sheet()!.textContent).toMatch(/Army( \d+)? is on another layer/);
      expect(hud.depths().map(({ enabled }) => enabled)).toEqual([false]);
    } finally {
      hud.unmount();
    }
  });

  it("lets an exhausted army enter, whatever stands below the spire: the chain picks the nearest free tile", () => {
    const { store, rules, spire } = spireDay({ stamina: 0n });
    store.applyFacts([
      {
        model: "TileOccupancy",
        key: "0x905",
        value: {
          game_id: 1,
          alt: false,
          col: spire.col,
          row: spire.row + rules.spacing,
          entity_id: 990,
          category: TileOccupier.Camp,
          is_structure: true,
        },
      },
    ] as never);
    const hud = renderHud(store);
    try {
      tapSpireWithArmy(spire);
      expect(hud.depths()).toEqual([{ depth: "Ethereal I", line: undefined, button: "Enter", enabled: true }]);
    } finally {
      hud.unmount();
    }
  });

  it("explains itself to a tap with no army, acts for the army beside it, and points an army away to it", () => {
    const beside = spireDay();
    let hud = renderHud(beside.store);
    try {
      // No army selected, one beside the spire: the card acts for it, named.
      act(() => useUIStore.getState().selectOnMap({ kind: "hex", hex: beside.spire }));
      expect(hud.sheet()?.getAttribute("aria-label")).toBe("Spire");
      expect(hud.depths().map(({ enabled }) => enabled)).toEqual([true]);
    } finally {
      hud.unmount();
    }

    const away = spireDay({ standing: "away" });
    hud = renderHud(away.store);
    try {
      // No army selected and none beside: what to do, and the layer below listed, closed.
      act(() => useUIStore.getState().selectOnMap({ kind: "hex", hex: away.spire }));
      expect(hud.sheet()!.textContent).toContain("Select an army beside the spire");
      expect(hud.depths().map(({ depth, enabled }) => ({ depth, enabled }))).toEqual([
        { depth: "Ethereal I", enabled: false },
      ]);
      // The army selected away from the spire: it must stand beside it, and nothing commits it yet.
      tapSpireWithArmy(away.spire);
      expect(hud.sheet()!.textContent).toMatch(/Army( \d+)? must be beside the spire/);
      expect(hud.host.querySelector("[data-spire-commitment]")).toBeNull();
      expect(hud.depths().map(({ enabled }) => enabled)).toEqual([false]);
    } finally {
      hud.unmount();
    }
  });

  /**
   * The HUD's panels as each layout composes them, through the one panel: the selection's card, and the army's panel.
   * A desktop opens the army's panel on selecting it (a surface); a phone keeps the map and shows the army in its action
   * row, which no card covers. Either panel carries Spire while the army stands at its spire, as both draw it.
   */
  const renderLayoutHud = (store: ReturnType<typeof spireDay>["store"], layout: "desktop" | "phone") => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useAccountStore.setState({ account: { address: "0x111" } as never });
    const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
    const giveBack = attachMapSelectionPositions({
      army: (id) => {
        const tile = store.entityOccupancy(1, Number(id));
        return tile && { col: tile.col, row: tile.row, alt: false };
      },
      structure: () => undefined,
    });
    useUIStore.getState().setMapLayer(false);
    const ArmySpire = () => {
      const spire = useArmyAtItsSpire(ARMY);
      return spire && <SpireButton explorerId={ARMY} spire={spire} />;
    };
    const Hud = () => {
      const card = useSelectionCard({ realm, onResearch: () => undefined });
      const { surface, openSurface, showsCard } = useOnePanel(card?.key ?? null, layout === "phone");
      useArmyPanelOpens(realm, () => openSurface("army"), layout === "desktop");
      const selected = useUIStore((state) => state.entityActions.selectedEntityId);
      const armyPanel = layout === "desktop" ? surface === "army" : selected === ARMY && !showsCard && !surface;
      return (
        <>
          {surface && surface !== "army" && <section data-kit-sheet aria-label={surface} />}
          {armyPanel && (
            <section data-kit-sheet aria-label="army">
              <ArmySpire />
            </section>
          )}
          {showsCard && card?.sheet}
        </>
      );
    };
    const host = document.createElement("div");
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider value={{ store, systemCalls: {} } as never} account={{ address: "0x111" } as never}>
          <Hud />
        </GameProvider>,
      ),
    );
    const sheets = () =>
      [...host.querySelectorAll("[data-kit-sheet]")].map((sheet) => sheet.getAttribute("aria-label"));
    const enterButtons = () =>
      [...host.querySelectorAll<HTMLButtonElement>("[data-spire-depths] button")]
        .filter((button) => button.textContent === "Enter")
        .map((button) => !button.disabled);
    const press = (label: string) =>
      act(() =>
        [...host.querySelectorAll<HTMLButtonElement>("button")]
          .find((button) => button.getAttribute("aria-label") === label || button.textContent === label)!
          .click(),
      );
    return {
      sheets,
      enterButtons,
      press,
      unmount: () => {
        act(() => root.unmount());
        giveBack();
      },
    };
  };

  /** The camp the army cleared, on the tile it stands on: the site's row with its receipt, as clear_site leaves it. */
  const clearedCampUnder = (store: ReturnType<typeof spireDay>["store"], tile: { col: number; row: number }) =>
    store.applyFacts([
      {
        model: "ExpeditionSite",
        key: "0x1ab96",
        value: {
          game_id: 1,
          entity_id: 711,
          category: StructureType.Camp,
          initial_guard_count: 1_600n * 1_000_000_000n,
          alt: false,
          ...tile,
          clear: { explorer_id: BigInt(ARMY), home_id: 7n, reward: null },
        },
      },
    ] as never);

  // Owner, 28 October 2026 (brief item 2): tapping a tile with his army on it selects the army, whatever site is under
  // it. The army's panel shows; its spire's card opens from Spire on that panel, and the receipt from the clear's Feed row.
  describe.each(["desktop", "phone"] as const)(
    "the selection matrix on a %s: the army's panel, whatever site is under it",
    (layout) => {
      const cells = [
        { under: "the ground beside its spire", standing: "beside" as const, cleared: false },
        { under: "a cleared site", standing: "away" as const, cleared: true },
      ];
      for (const { under, standing, cleared } of cells)
        it(`shows the army's panel, and no site card, for the army on ${under}, tapped or picked from the dock`, () => {
          const { store, armyTile } = spireDay({ standing });
          if (cleared) clearedCampUnder(store, armyTile);
          const hud = renderLayoutHud(store, layout);
          try {
            // The map's tap on the army's tile: the army selected where it stands (a desktop's panel then lets go of the tile).
            act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: ARMY, tile: "own" }));
            expect(useUIStore.getState().entityActions.selectedEntityId).toBe(ARMY);
            expect(hud.sheets()).toEqual(["army"]);
            // Picked from the dock, with no tile: the same panel.
            act(() => useUIStore.getState().selectOnMap(null));
            act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: ARMY, tile: null }));
            expect(hud.sheets()).toEqual(["army"]);
          } finally {
            hud.unmount();
          }
        });

      // A found spire occupies its tile, so an army stands beside it, never on it.
      it.each(["beside"] as const)(
        "opens the spire's card from Spire on the army's panel, standing %s it",
        (standing) => {
          const { store } = spireDay({ standing });
          const hud = renderLayoutHud(store, layout);
          try {
            act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: ARMY, tile: "own" }));
            hud.press("Spire");
            expect(hud.sheets()).toEqual(["Spire"]);
            expect(hud.enterButtons()).toEqual([true]);
            // Closed, the card hands back the army, still selected.
            hud.press("Close");
            expect(hud.sheets()).not.toContain("Spire");
            expect(useUIStore.getState().entityActions.selectedEntityId).toBe(ARMY);
          } finally {
            hud.unmount();
          }
        },
      );

      it("offers no Spire to an army away from its spire", () => {
        const { store } = spireDay({ standing: "away" });
        const hud = renderLayoutHud(store, layout);
        try {
          act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: ARMY, tile: "own" }));
          expect(hud.sheets()).toEqual(["army"]);
          expect([...document.querySelectorAll("button")].some((button) => button.textContent === "Spire")).toBe(false);
        } finally {
          hud.unmount();
        }
      });
    },
  );

  it("shows the next reveal's rising odds while the spire is still being looked for, and none once found or without lore", () => {
    const { store } = spireDay({ standing: "away" });
    const record = (reveals: number) =>
      store.applyFacts([
        {
          model: "ExpeditionSpire",
          key: "0x5b0",
          value: {
            ...store.require("ExpeditionSpire", { game_id: 1, structure_id: 7, epoch: 0, depth: 0 }),
            reveals,
            location: null,
          },
        },
        { model: "TileOccupancy", key: "0x5c0", value: null },
      ] as never);
    const host = document.createElement("div");
    const root = createRoot(host);
    const draw = () =>
      act(() =>
        root.render(
          <GameProvider value={{ store, systemCalls: {} } as never} account={{ address: "0x111" } as never}>
            <SpireOdds explorerId={ARMY} />
          </GameProvider>,
        ),
      );
    try {
      // Found today: no odds (the army's panel offers Spire once beside it).
      draw();
      expect(host.textContent).toBe("");
      record(3);
      draw();
      expect(host.textContent).toContain("Spire: 40% on the next reveal");
      record(9);
      draw();
      expect(host.textContent).toContain("Spire: 100% on the next reveal");
      // Without Spire lore, reveals find no spire, so no odds are shown.
      act(() =>
        store.applyFacts([
          { model: "RealmKnowledge", key: "0xd", value: { game_id: 1, structure_id: 7, learned: "0" } },
        ] as never),
      );
      draw();
      expect(host.textContent).toBe("");
    } finally {
      act(() => root.unmount());
    }
  });

  it("tells another player whose spire it is, and offers them nothing", () => {
    const { store, spire } = spireDay();
    const hud = renderHud(store, "0x222");
    try {
      act(() => useUIStore.getState().selectOnMap({ kind: "hex", hex: spire }));
      expect(hud.sheet()?.getAttribute("aria-label")).toBe("Spire");
      expect(hud.sheet()!.textContent).toContain("Another realm's spire");
      expect(hud.depths()).toEqual([]);
    } finally {
      hud.unmount();
    }
  });

  it("gives the army beside its spire the order to enter a depth there, and an army away none", () => {
    const plan = (standing: "beside" | "away") => {
      const { store, spire } = spireDay({ standing });
      const paths = new ArmyActionManager(store, {} as never, ARMY).findActionPaths(
        new Map(),
        new Map(),
        new Map(),
        new Map(),
        NOW,
        0x111n as never,
      );
      return paths.get(ActionPaths.posKey(spire));
    };
    // Frontier's command mask enables depth entry; the fixture's preset does not.
    vi.spyOn(configManager, "isCommandEnabled").mockImplementation((command) => command === "EnterDepth");
    const beside = plan("beside");
    expect(beside && ActionPaths.getActionType(beside)).toBe(ActionType.EnterDepth);
    expect(beside?.at(-1)?.staminaCost).toBe(0);
    const away = plan("away");
    expect(away && ActionPaths.getActionType(away)).not.toBe(ActionType.EnterDepth);
  });
});
