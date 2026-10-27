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
import { TileOccupier } from "@bibliothecadao/types";
import { useArmyPanelOpens } from "./army/army-opens";
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
      expect(second.line).toMatch(/^Needs 40 stamina, has 3\d$/);
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
   * The desktop HUD's panels as it composes them: the selection's card, and the army's panel that selecting one of
   * the realm's armies opens, through the one panel.
   */
  const renderDesktopHud = (store: ReturnType<typeof spireDay>["store"]) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useAccountStore.setState({ account: { address: "0x111" } as never });
    const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
    const Hud = () => {
      const card = useSelectionCard({ realm, onResearch: () => undefined });
      const { surface, openSurface, showsCard } = useOnePanel(card?.key ?? null);
      useArmyPanelOpens(realm, () => openSurface("army"), true);
      return (
        <>
          <button type="button" onClick={() => openSurface("research")}>
            Research
          </button>
          {surface && <section data-kit-sheet aria-label={surface} />}
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
    return { sheets, enterButtons, press, unmount: () => act(() => root.unmount()) };
  };

  it.each(["on", "beside"] as const)(
    "opens the spire's card, not the army's panel, for its army selected %s the spire, by its tile or from the dock",
    (standing) => {
      const { store, armyTile } = spireDay({ standing });
      const hud = renderDesktopHud(store);
      try {
        // A tap on the army's tile selects the army: deployed onto the spire, that is the spire's own tile.
        act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: ARMY, tile: armyTile }));
        expect(hud.sheets()).toEqual(["Spire"]);
        expect(hud.enterButtons()).toEqual([true, true]);
        // Research stands alone over it, and the card waits put away.
        hud.press("Research");
        expect(hud.sheets()).toEqual(["research"]);

        // Picked from the dock, with no tile, the army opens the same card.
        act(() => useUIStore.getState().selectOnMap(null));
        act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: ARMY, tile: null }));
        expect(hud.sheets()).toEqual(["Spire"]);
        // Closed, the card lets go of the army, so nothing opens it again.
        hud.press("Close");
        expect(hud.sheets()).toEqual([]);
        expect(useUIStore.getState().entityActions.selectedEntityId).toBeNull();
      } finally {
        hud.unmount();
      }
    },
  );

  it("opens the army's panel, and no spire card, for its army selected away from the spire", () => {
    const { store, armyTile } = spireDay({ standing: "away" });
    const hud = renderDesktopHud(store);
    try {
      act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: ARMY, tile: armyTile }));
      expect(hud.sheets()).toEqual(["army"]);
    } finally {
      hud.unmount();
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
    expect(beside?.at(-1)?.staminaCost).toBe(30);
    const away = plan("away");
    expect(away && ActionPaths.getActionType(away)).not.toBe(ActionType.EnterDepth);
  });
});
