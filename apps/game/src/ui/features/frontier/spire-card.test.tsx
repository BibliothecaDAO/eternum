import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

// The world's tiles: none hold anything here, as a rule-drawn spire's tile holds nothing.
vi.mock("@/hooks/use-world-spatial-tiles", () => ({ useWorldSpatialTiles: () => [] }));
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
import { SpireButton, useArmyAtItsSpire } from "./spire-card";
import { useSelectionCard } from "./frontier-selection-sheet";
import { useOnePanel } from "./hud/one-panel";
import { SPIRE_ARMY, SPIRE_DAY_NOW, spireDay as spireFixture } from "./spire-fixture";

const ARMY = SPIRE_ARMY;
const NOW = SPIRE_DAY_NOW;

/** The fixture's day, read at its second as the HUD reads the clock. */
const spireDay = (options?: Parameters<typeof spireFixture>[0]) => {
  const day = spireFixture(options);
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
  const Hud = () => useSelectionCard({ realm, asked: null, onResearch: research, onArmyBack: () => {} })?.sheet ?? null;
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
  it("offers the selected army each researched depth with its stamina, enters the one picked, and shows it there", async () => {
    const { store, rules, spire, armyTile } = spireDay();
    const hud = renderHud(store);
    try {
      tapSpireWithArmy(spire);
      expect(hud.sheet()?.getAttribute("aria-label")).toBe("Spire");
      expect(hud.sheet()!.textContent).toContain("Army");
      expect(hud.depths()).toEqual([
        { depth: "Ethereal I", line: "30 stamina", button: "Enter", enabled: true },
        { depth: "Ethereal II", line: "40 stamina", button: "Enter", enabled: true },
        // The next depth is its research's, through Research.
        { depth: "Ethereal III", line: "Research it to open it", button: "Research", enabled: true },
      ]);
      // What entering commits the army to, before it goes: the rest of the day, with no way back up.
      expect(hud.host.querySelector("[data-spire-commitment]")?.textContent).toMatch(
        /^Army( \d+)? stays until the day ends \(.+\)$/,
      );

      await hud.press("Enter Ethereal II");
      expect(hud.enter).toHaveBeenCalledTimes(1);
      expect(hud.enter).toHaveBeenCalledWith(expect.objectContaining({ explorerId: ARMY, depth: 2 }));

      // The chain's answer: the army lands straight below, two regions down.
      const landing = { col: armyTile.col, row: armyTile.row + 2 * rules.spacing };
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
      const at = store.entityOccupancy(1, ARMY)!;
      expect(expeditionDepth(rules, { y: at.row })).toBe(2);
      expect(hud.sheet()!.textContent).toMatch(/Army( \d+)? is in Ethereal II today/);
      expect(hud.depths()).toEqual([]);
    } finally {
      hud.unmount();
    }
  });

  it("says what each depth lacks: the stamina for it, or a free landing", () => {
    const { store, rules, spire, armyTile } = spireDay({ stamina: 35n });
    // Something already stands where the army would land in Ethereal I.
    store.applyFacts([
      {
        model: "TileOccupancy",
        key: "0x905",
        value: {
          game_id: 1,
          alt: false,
          col: armyTile.col,
          row: armyTile.row + rules.spacing,
          entity_id: 990,
          category: TileOccupier.Camp,
          is_structure: true,
        },
      },
    ] as never);
    const hud = renderHud(store);
    try {
      tapSpireWithArmy(spire);
      const [first, second] = hud.depths();
      expect(first).toEqual({ depth: "Ethereal I", line: "Its landing is taken", button: "Enter", enabled: false });
      expect(second.depth).toBe("Ethereal II");
      expect(second.line).toMatch(/^Needs 40 stamina, have 3\d$/);
      expect(second.enabled).toBe(false);
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
      expect(
        hud
          .depths()
          .slice(0, 2)
          .every((depth) => depth.enabled),
      ).toBe(true);
    } finally {
      hud.unmount();
    }

    const away = spireDay({ standing: "away" });
    hud = renderHud(away.store);
    try {
      // No army selected and none beside: what to do, and every depth's price still shown.
      act(() => useUIStore.getState().selectOnMap({ kind: "hex", hex: away.spire }));
      expect(hud.sheet()!.textContent).toContain("Select an army beside the spire");
      expect(hud.depths().map(({ line, enabled }) => ({ line, enabled }))).toEqual([
        { line: "30 stamina", enabled: false },
        { line: "40 stamina", enabled: false },
        { line: "Research it to open it", enabled: true },
      ]);
      // The army selected away from the spire: it must stand beside it, and nothing commits it yet.
      tapSpireWithArmy(away.spire);
      expect(hud.sheet()!.textContent).toMatch(/Army( \d+)? must be beside the spire/);
      expect(hud.host.querySelector("[data-spire-commitment]")).toBeNull();
      expect(
        hud
          .depths()
          .slice(0, 2)
          .some((depth) => depth.enabled),
      ).toBe(false);
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
      const card = useSelectionCard({ realm, asked: null, onResearch: () => undefined, onArmyBack: () => {} });
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
        { under: "its spire", standing: "on" as const, cleared: false },
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

      it.each(["on", "beside"] as const)(
        "opens the spire's card from Spire on the army's panel, standing %s it",
        (standing) => {
          const { store } = spireDay({ standing });
          const hud = renderLayoutHud(store, layout);
          try {
            act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: ARMY, tile: "own" }));
            hud.press("Spire");
            expect(hud.sheets()).toEqual(["Spire"]);
            expect(hud.enterButtons()).toEqual([true, true]);
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
    expect(beside?.at(-1)?.staminaCost).toBe(30);
    const away = plan("away");
    expect(away && ActionPaths.getActionType(away)).not.toBe(ActionType.EnterDepth);
  });
});
