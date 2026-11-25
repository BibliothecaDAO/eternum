import { act } from "react";
import { raceRules } from "@/lab/game/race-scenario";
import { nativeOathConstants, nativeRaceConstants } from "@bibliothecadao/eternum/game-client";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { spatialTiles } = vi.hoisted(() => ({
  spatialTiles: {
    current: [] as { occupierType: number; occupierId: number; hexCoords: { col: number; row: number } }[],
  },
}));
vi.mock("@/hooks/use-world-spatial-tiles", () => ({
  useWorldSpatialTiles: (hexes: { col: number; row: number }[]) =>
    spatialTiles.current.filter((tile) =>
      hexes.some((hex) => hex.col === tile.hexCoords.col && hex.row === tile.hexCoords.row),
    ),
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
  expeditionDayEndsAt,
  expeditionSpires,
  armyRealmSpire,
  armySpireChance,
  setBlockTimestampSource,
} from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";
import { attachMapSelectionPositions } from "@/hooks/store/map-selection";
import { useArmyPanelOpens } from "./army/army-opens";
import { useArmySpireStatus } from "./spire-card";
import { useSelectionCard } from "./frontier-selection-sheet";
import { useOnePanel } from "./hud/one-panel";
import { SPIRE_ARMY, SPIRE_DAY_NOW, discoveredSpireDay, spireDay as spireFixture } from "./spire-fixture";
import { SPIRE_WORDS } from "../../design-system/kit/words";

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
  spatialTiles.current = [];
  vi.restoreAllMocks();
  useUIStore.getState().selectOnMap(null);
  useAccountStore.setState({ account: null });
  setBlockTimestampSource(null);
});

describe("a realm's spire, from the player's path", () => {
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
      const spire = useArmySpireStatus(ARMY);
      return spire;
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
    const press = (label: string) =>
      act(() =>
        [...host.querySelectorAll<HTMLButtonElement>("button")]
          .find((button) => button.getAttribute("aria-label") === label || button.textContent === label)!
          .click(),
      );
    return {
      host,
      sheets,
      press,
      unmount: () => {
        act(() => root.unmount());
        giveBack();
      },
    };
  };

  it.each(["desktop", "phone"] as const)("shows rising Spire odds on a %s from the native counter", (layout) => {
    const { store } = discoveredSpireDay(0);
    setBlockTimestampSource(() => NOW);
    useBlockTimestampStore.setState({ currentBlockTimestamp: NOW, currentDefaultTick: NOW });
    const key = { game_id: 1, structure_id: 7, epoch: 0, depth: 0 };
    const found = store.require("ExpeditionSpire", key);
    const wireKey = store.wireKeyOf("ExpeditionSpire", key)!;
    store.applyFacts([{ model: "ExpeditionSpire", key: wireKey, value: null }]);
    const hud = renderLayoutHud(store, layout);
    try {
      act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: ARMY, tile: "own" }));
      expect(hud.host.textContent).toContain(SPIRE_WORDS.nextReveal("10"));
      for (const [reveals, chance] of [
        [3, 40],
        [9, 100],
      ]) {
        act(() =>
          store.applyFacts([{ model: "ExpeditionSpire", key: wireKey, value: { ...found, reveals, location: null } }]),
        );
        expect(hud.host.textContent).toContain(`Spire · next reveal ${chance}%`);
      }
      act(() => store.applyFacts([{ model: "ExpeditionSpire", key: wireKey, value: found }]));
      expect(hud.host.querySelector("[data-spire-chance]")).toBeNull();
      expect(hud.host.querySelector("button")?.textContent).toBe("Spire");
    } finally {
      hud.unmount();
    }
  });

  it.each(["desktop", "phone"] as const)("keeps the spire's fixed odds on a Clear Mist day on a %s", (layout) => {
    const { store } = discoveredSpireDay(0);
    setBlockTimestampSource(() => NOW);
    useBlockTimestampStore.setState({ currentBlockTimestamp: NOW, currentDefaultTick: NOW });
    const key = { game_id: 1, structure_id: 7, epoch: 0, depth: 0 };
    const found = store.require("ExpeditionSpire", key);
    const wireKey = store.wireKeyOf("ExpeditionSpire", key)!;
    store.applyFacts([
      { model: "ExpeditionSpire", key: wireKey, value: null },
      { model: "RaceRules", key: "0xc100", value: raceRules() },
      { model: "HomeAspect", key: "0xc101", value: { game_id: 1, home: 7, aspect: 1 } },
      {
        model: "TriumphDay",
        key: "0xc102",
        value: { game_id: 1, aspect: 1, stage: nativeRaceConstants.CLEAR_MIST_STAGE, day: 0 },
      },
    ]);
    const hud = renderLayoutHud(store, layout);
    try {
      act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: ARMY, tile: "own" }));
      expect(hud.host.textContent).toContain(SPIRE_WORDS.nextReveal("10"));
      for (const [reveals, chance] of [
        [3, 40],
        [9, 100],
      ]) {
        act(() =>
          store.applyFacts([{ model: "ExpeditionSpire", key: wireKey, value: { ...found, reveals, location: null } }]),
        );
        expect(hud.host.textContent).toContain(`Spire · next reveal ${chance}%`);
      }
    } finally {
      hud.unmount();
    }
  });

  it("does not borrow another day's or layer's odds, or invent an unsynchronized counter", () => {
    const { store } = discoveredSpireDay(1);
    const key = { game_id: 1, structure_id: 7, epoch: 0, depth: 1 };
    const row = store.require("ExpeditionSpire", key);
    const wireKey = store.wireKeyOf("ExpeditionSpire", key)!;
    store.applyFacts([
      { model: "ExpeditionSpire", key: wireKey, value: null },
      { model: "ExpeditionSpire", key: "0x5f04", value: { ...row, depth: 0, reveals: 9, location: null } },
      { model: "ExpeditionSpire", key: "0x5f05", value: { ...row, epoch: 1, reveals: 9, location: null } },
    ]);
    expect(armySpireChance(store, 1, ARMY, NOW)).toBe(10);
    store.setSnapshot({ gameId: 1, complete: false, actor: "0x111", timestamp: NOW });
    expect(armySpireChance(store, 1, ARMY, NOW)).toBeNull();
    store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: NOW });
    const knowledge = store.require("RealmKnowledge", { game_id: 1, structure_id: 7 });
    store.applyFacts([
      {
        model: "RealmKnowledge",
        key: store.wireKeyOf("RealmKnowledge", knowledge)!,
        value: { ...knowledge, learned: 2n << 48n },
      },
    ]);
    expect(armySpireChance(store, 1, ARMY, NOW)).toBeNull();
    expect(armySpireChance(store, 1, ARMY, NOW + 86400)).toBeNull();
  });

  it("leaves the next reveal's chance the same under Detection", () => {
    const { store } = discoveredSpireDay(1);
    const spire = { game_id: 1, structure_id: 7, epoch: 0, depth: 1 };
    store.applyFacts([{ model: "ExpeditionSpire", key: store.wireKeyOf("ExpeditionSpire", spire)!, value: null }]);
    expect(armySpireChance(store, 1, ARMY, NOW)).toBe(10);
    const army = { game_id: 1, explorer_id: ARMY };
    const progress = store.require("ArmyProgress", army);
    store.applyFacts([
      {
        model: "ArmyProgress",
        key: store.wireKeyOf("ArmyProgress", army)!,
        value: { ...progress, oaths: 1 << (nativeOathConstants.DETECTION - 1) },
      },
    ]);
    expect(armySpireChance(store, 1, ARMY, NOW)).toBe(10);
  });

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
});

describe("discovered expedition Spires", () => {
  it.each([0, 1] as const)("offers only the next layer from a discovered layer %i Spire", async (depth) => {
    const { store, spire } = discoveredSpireDay(depth);
    const portal = store.get("TileOccupancy", { game_id: 1, alt: false, ...spire })!;
    spatialTiles.current = [{ occupierType: portal.category, occupierId: Number(portal.entity_id), hexCoords: spire }];
    setBlockTimestampSource(() => NOW);
    useBlockTimestampStore.setState({ currentBlockTimestamp: NOW, currentDefaultTick: NOW });
    const hud = renderHud(store);
    try {
      tapSpireWithArmy(spire);
      const title = depth === 0 ? "Veil" : "Hollow";
      expect(hud.depths()).toEqual([{ depth: title, line: undefined, button: "Enter", enabled: true }]);
      expect(armyRealmSpire(store, 1, ARMY, NOW)).toMatchObject({ ...spire, targetDepth: depth + 1 });
      await hud.press(`Enter ${title}`);
      expect(hud.enter).toHaveBeenCalledTimes(1);
      expect(hud.enter).toHaveBeenCalledWith(expect.objectContaining({ explorerId: ARMY, depth: depth + 1 }));
    } finally {
      hud.unmount();
    }
  });

  it("does not invent a portal before discovery or carry it into tomorrow", () => {
    const { store, rules } = discoveredSpireDay();
    expect(expeditionSpires(store, 1, NOW)).toHaveLength(1);
    expect(expeditionSpires(store, 1, expeditionDayEndsAt(rules, NOW))).toEqual([]);
    store.applyFacts([{ model: "ExpeditionSpire", key: "0x5f01", value: null }]);
    expect(expeditionSpires(store, 1, NOW)).toEqual([]);
    expect(armyRealmSpire(store, 1, ARMY, NOW)).toBeNull();
  });
});
