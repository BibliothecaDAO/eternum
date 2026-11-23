import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: { getInstance: () => ({ play: () => Promise.resolve(null) }) },
}));

import { GameProvider } from "@/hooks/context/game-context";
import { inFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { toast } from "@/ui/features/event-feed/notify";
import { disposeGameSyncSession, installActiveGameClient } from "@/sync/active-game-client";
import { configManager, type GameClient, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { type GameClientSetup, nativeResearchConstants } from "@bibliothecadao/eternum/game-client";
import { buildingName, BuildingType, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import release from "../../../../../../../contracts/l3/world-native/schema/release-definition.json";
import { buildingCounts, realmBoard } from "./build-fixture";
import { BuildingsInFlight, BuildSheet } from "./build-sheet";

afterEach(() => {
  disposeGameSyncSession();
  setBlockTimestampSource(null);
  useUIStore.getState().setPreviewBuilding(null);
});

const atKingdom = (realm: ReturnType<typeof realmBoard>["realm"]) => ({
  ...realm,
  base: { ...realm.base, level: nativeResearchConstants.SUPPLY_YARD_LEVEL },
});

describe("the build sheet", () => {
  it("stands the chosen building on the plot as a ghost, builds it there and takes the ghost away", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, realm } = realmBoard();
    const plot = { col: 11, row: 10 };
    const placeBuilding = vi.fn(() => Promise.resolve({ transaction_hash: "0x1" }));
    installActiveGameClient({
      connect() {},
      disconnect() {},
      dispose() {},
      actions: { placeBuilding },
      waitForAction: () => Promise.resolve({ hash: "0x1", block: 9, status: "SUCCEEDED" }),
    } as unknown as GameClient);
    const onClose = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <BuildSheet realm={realm} plot={plot} onClose={onClose} />
        </GameProvider>,
      ),
    );
    const card = (name: string) =>
      [...host.querySelectorAll<HTMLButtonElement>(".ui-card__choose")].find(
        (card) => card.querySelector(".ui-card__title")?.textContent === name,
      )!;
    expect(card("Farm").getAttribute("aria-pressed")).toBe("true");
    expect(useUIStore.getState().previewBuilding).toEqual({ type: BuildingType.ResourceWheat, plot });

    act(() => card("Barracks").click());
    expect(useUIStore.getState().previewBuilding).toEqual({ type: BuildingType.ResourceKnightT1, plot });
    act(() => card("Farm").click());

    const build = [...host.querySelectorAll("button")].find((button) => button.textContent?.startsWith("Build"))!;
    await act(async () => build.click());
    expect(placeBuilding).toHaveBeenCalledWith(
      expect.objectContaining({ structureId: 7, buildingType: BuildingType.ResourceWheat, hex: plot }),
    );
    expect(onClose).toHaveBeenCalledOnce();
    act(() => root.unmount());
    expect(useUIStore.getState().previewBuilding).toBeNull();
    host.remove();
  });

  /** A build sheet whose build is sent and whose outcome the test settles, beside the HUD's ghost of builds in flight. */
  const buildInFlight = () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, realm } = realmBoard();
    const plot = { col: 11, row: 10 };
    let settle: (outcome: unknown) => void = () => {};
    const placeBuilding = vi.fn(() => Promise.resolve({ transaction_hash: "0x1" }));
    installActiveGameClient({
      connect() {},
      disconnect() {},
      dispose() {},
      actions: { placeBuilding },
      waitForAction: () => new Promise((resolve) => (settle = resolve)),
    } as unknown as GameClient);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const draw = (sheetOpen: boolean) =>
      act(() =>
        root.render(
          <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
            {sheetOpen && <BuildSheet realm={realm} plot={plot} onClose={() => draw(false)} />}
            <BuildingsInFlight />
          </GameProvider>,
        ),
      );
    draw(true);
    const build = () => [...host.querySelectorAll("button")].find((button) => /^Build/.test(button.textContent ?? ""));
    const unmount = () => {
      act(() => root.unmount());
      host.remove();
    };
    return { host, plot, placeBuilding, build, draw, unmount, settle: (o: unknown) => act(async () => settle(o)) };
  };
  const ghost = () => useUIStore.getState().previewBuilding;

  it("places one building for two presses, closes as it leaves, and keeps its ghost on the plot until the outcome", async () => {
    const { host, plot, placeBuilding, build, unmount, settle } = buildInFlight();
    await act(async () => {
      build()!.click();
      build()!.click();
    });
    expect(placeBuilding).toHaveBeenCalledTimes(1);
    // The sheet is gone, as it always was once the building left; the plot still shows what is being built.
    expect(host.querySelector("section")).toBeNull();
    expect(ghost()).toEqual({ type: BuildingType.ResourceWheat, plot });
    expect(inFlight("plot", "7:11,10")).toEqual({ type: BuildingType.ResourceWheat, plot });
    await settle({ hash: "0x1", block: 9, status: "SUCCEEDED" });
    expect(ghost()).toBeNull();
    expect(inFlight("plot", "7:11,10")).toBeUndefined();
    unmount();
  });

  it("reads Building… on the plot's own sheet while its build is in flight, and cannot send a second", async () => {
    const { placeBuilding, build, draw, unmount, settle } = buildInFlight();
    await act(async () => build()!.click());
    draw(true);
    expect(build()?.textContent).toBe("Building…");
    expect(build()?.disabled).toBe(true);
    await act(async () => build()!.click());
    expect(placeBuilding).toHaveBeenCalledTimes(1);
    await settle({ hash: "0x1", block: 9, status: "SUCCEEDED" });
    unmount();
  });

  it("says why a refused build did not happen, takes the ghost away and frees the plot", async () => {
    const refused = vi.spyOn(toast, "error").mockImplementation(() => "");
    const { build, draw, unmount, settle } = buildInFlight();
    await act(async () => build()!.click());
    await settle({ hash: "0x1", block: 9, status: "REJECTED", revertReason: "Not enough labor" });
    expect(refused.mock.lastCall?.[0]).toBe("Not enough labor");
    expect(ghost()).toBeNull();
    draw(true);
    expect(build()?.disabled).toBe(false);
    unmount();
    refused.mockRestore();
  });

  /**
   * whole-review-2-ui P2-2: an answer to one plot's Build closes only the card that sent it. The real sheet, its send
   * held at the network; the HUD's own close (frontier-selection-sheet) clears whatever plot is selected.
   */
  describe("an answer to a Build that arrives late", () => {
    const heldSend = () => {
      (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
      const { store, realm } = realmBoard();
      let answer: (sent: { transaction_hash: string }) => void = () => {};
      const placeBuilding = vi.fn(() => new Promise((resolve) => (answer = resolve)));
      installActiveGameClient({
        connect() {},
        disconnect() {},
        dispose() {},
        actions: { placeBuilding },
        waitForAction: () => Promise.resolve({ hash: "0x1", block: 1, status: "SUCCEEDED" }),
      } as unknown as GameClient);
      const host = document.createElement("div");
      document.body.append(host);
      const root = createRoot(host);
      const select = (col: number | null) =>
        useUIStore
          .getState()
          .setSelectedBuildingHex(col === null ? null : { structureId: 7, innerCol: col, innerRow: 10 });
      const close = () => {
        useUIStore.getState().closeSelectedTile();
        useUIStore.getState().setSelectedBuildingHex(null);
      };
      const Hud = () => {
        const at = useUIStore((state) => state.selectedBuildingHex);
        return (
          <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
            {at && <BuildSheet realm={realm} plot={{ col: at.innerCol, row: at.innerRow }} onClose={close} />}
          </GameProvider>
        );
      };
      act(() => root.render(<Hud />));
      const build = () =>
        act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Build")!.click());
      const selected = () => useUIStore.getState().selectedBuildingHex?.innerCol ?? null;
      const end = () => {
        act(() => root.unmount());
        host.remove();
        select(null);
      };
      return {
        placeBuilding,
        select: (col: number | null) => act(() => select(col)),
        build,
        selected,
        end,
        answer: () => act(async () => answer({ transaction_hash: "0x1" })),
      };
    };

    it("leaves plot B's card open when plot A's answer arrives after B was chosen", async () => {
      const life = heldSend();
      life.select(11);
      await life.build();
      expect(life.placeBuilding).toHaveBeenCalledWith(expect.objectContaining({ hex: { col: 11, row: 10 } }));
      life.select(12);
      await life.answer();
      expect(life.selected()).toBe(12);
      life.end();
    });

    it("leaves a card opened anew open when the card that sent was closed before the answer", async () => {
      const life = heldSend();
      life.select(11);
      await life.build();
      // A's card closes (the sheet unmounts), then plot B opens its own card.
      life.select(null);
      life.select(12);
      await life.answer();
      expect(life.selected()).toBe(12);
      life.end();
    });

    it("closes the card that sent once the answer arrives while it still shows that plot", async () => {
      const life = heldSend();
      life.select(11);
      await life.build();
      expect(life.selected()).toBe(11);
      await life.answer();
      expect(life.selected()).toBeNull();
      life.end();
    });
  });

  const fact = (key: string, model: string, value: Record<string, unknown>) => ({ model, key, value });
  const labor = (store: ReturnType<typeof realmBoard>["store"], amount: bigint) =>
    store.applyFacts([
      fact("0x75", "ResourceBalance", {
        game_id: 1,
        entity_id: 7,
        resource_type: ResourcesIds.Labor,
        balance: String(amount * BigInt(RESOURCE_PRECISION)),
      }),
    ] as never);

  const countsWith = buildingCounts;

  const open = (store: ReturnType<typeof realmBoard>["store"], realm: ReturnType<typeof realmBoard>["realm"]) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <BuildSheet realm={realm} plot={{ col: 11, row: 10 }} onClose={() => undefined} />
        </GameProvider>,
      ),
    );
    const card = (name: string) =>
      [...host.querySelectorAll<HTMLButtonElement>(".ui-card__choose")].find(
        (card) => card.querySelector(".ui-card__title")?.textContent === name,
      )!;
    const button = (starts: string) =>
      [...host.querySelectorAll("button")].find((candidate) => candidate.textContent?.startsWith(starts));
    const close = () => {
      act(() => root.unmount());
      host.remove();
    };
    return { host, card, button, close };
  };

  it("opens on the realm's first build while it has none, else on the first building, and keeps a pick over either", () => {
    const { store, realm } = realmBoard();
    labor(store, 10_000n);
    const pressedOn = (sheet: ReturnType<typeof open>) =>
      [...sheet.host.querySelectorAll('.ui-card__choose[aria-pressed="true"]')].map(
        (card) => card.querySelector(".ui-card__title")?.textContent,
      );
    useUIStore.setState({ firstBuild: BuildingType.ResourceKnightT1 });
    const first = open(store, realm);
    expect(pressedOn(first)).toEqual(["Barracks"]);
    act(() => first.card("Farm").click());
    expect(pressedOn(first)).toEqual(["Farm"]);
    first.close();
    useUIStore.setState({ firstBuild: null });
    const later = open(store, realm);
    expect(pressedOn(later)).toEqual(["Farm"]);
    later.close();
  });

  it("separates higher-tier unlocks from the build grid and summarizes the chosen building", () => {
    const { store, realm } = realmBoard();
    const sheet = open(store, realm);
    const gridTitles = [...sheet.host.querySelectorAll("[data-build-grid] .ui-card__title")].map(
      (title) => title.textContent,
    );
    expect(gridTitles).toContain("Farm");
    expect(gridTitles).toContain("Barracks");
    expect(gridTitles).not.toContain("Scouts' lodge");
    expect(gridTitles).not.toContain("Range");
    expect(gridTitles).not.toContain("Rations depot");
    expect(sheet.host.querySelector("[data-build-chosen]")?.textContent).toMatch(/^Farm: Wheat \+/);

    const lockedButtons = [...sheet.host.querySelectorAll<HTMLButtonElement>("[data-build-locked] button")];
    const rangeButton = lockedButtons.find((button) => button.textContent?.includes("Range"))!;
    expect(rangeButton).toBeDefined();
    expect(sheet.host.querySelector("[data-build-locked]")?.textContent).toContain("City");
    expect(sheet.host.querySelector("[data-build-locked]")?.textContent).toContain("Kingdom");

    act(() => rangeButton.click());
    expect(rangeButton.getAttribute("aria-pressed")).toBe("true");
    expect(sheet.host.querySelector("[data-build-chosen]")?.textContent).toContain("Range:");
    expect(sheet.host.querySelector('[role="status"]')?.textContent).toBe("Requires City");
    sheet.close();
  });

  it("offers Build for a Workshop on a realm whose own resources make no labor, as the contract allows on a board", () => {
    const { store, realm } = realmBoard();
    labor(store, 50_000n);
    const workshop = release.definition.structures.buildings.find(
      ({ category }) => category === BuildingType.ResourceLabor,
    )!;
    store.applyFacts([
      fact(`0x6${BuildingType.ResourceLabor}`, "BuildingRule", {
        ...workshop.rule,
        simple_cost: [{ resource_type: ResourcesIds.Labor, amount: String(2_000n * BigInt(RESOURCE_PRECISION)) }],
        category: BuildingType.ResourceLabor,
        game_id: 1,
      }),
    ] as never);
    const sheet = open(store, realm);
    act(() => sheet.card("Workshop").click());
    expect(sheet.host.querySelector('[role="status"]')).toBeNull();
    expect(sheet.button("Build")!.textContent).toBe("Build");
    expect(sheet.host.querySelector(".ui-cost")?.textContent).toBe("2,000 Labor");
    // Build and its price stand in the sheet's foot, outside the body that scrolls: the verb never scrolls away.
    expect(sheet.button("Build")!.closest(".ui-window__foot")).not.toBeNull();
    expect(sheet.host.querySelector(".ui-window__foot .ui-cost")?.textContent).toBe("2,000 Labor");
    sheet.close();
  });

  it("says on each card what the building does, and marks a risen price with the rule that raised it", () => {
    const { store, realm } = realmBoard();
    const sheet = open(store, atKingdom(realm));
    expect(sheet.card("Farm").closest("[data-tip]")!.getAttribute("data-tip")).toMatch(
      /^Farm: Wheat \+[\d,.]+\/(?:s|min)$/,
    );
    expect(sheet.card("Supply yard").closest("[data-tip]")!.getAttribute("data-tip")).toBe(
      "Supply yard: new armies start with Logistics I",
    );
    // The tier is the tooltip's gem, not a numeral in the words.
    const ranks = JSON.parse(sheet.card("Supply yard").closest("[data-tip]")!.getAttribute("data-tip-ranks")!);
    expect(ranks.slice(0, 3)).toEqual(["Supply yard: ", "new armies start with Logistics ", { rank: 1 }]);
    // No Farm stands on the board yet (the fixture's wheat comes with the realm): its price is its base.
    expect(sheet.card("Farm").querySelector('[aria-label="price raised"]')).toBeNull();
    expect(document.querySelector("[data-price-raised]")).toBeNull();
    const base = sheet.card("Farm").querySelector(".ui-chip")!.textContent;
    sheet.close();

    store.applyFacts([
      fact("0x72", "StructureBuildings", {
        game_id: 1,
        entity_id: 7,
        ...countsWith(BuildingType.ResourceWheat, 2),
        population: { current: 2, max: 6 },
      }),
    ] as never);
    const risen = open(store, realm);
    const arrow = risen.card("Farm").querySelector('[aria-label="price raised"]')!;
    // One line of why, never the sum behind it (owner, 26 October: "its a game not a math demo").
    expect(arrow.getAttribute("data-tip")).toBe("Costs more with each one standing: 2");
    // The Farm chosen, its foot says it in sight, for a phone that has no hover (owner, 30 October).
    expect(document.querySelector("[data-price-raised]")?.textContent).toBe("Costs more with each one standing: 2");
    expect(risen.card("Farm").querySelector(".ui-chip")!.textContent).not.toBe(base);
    risen.close();
  });

  it("says on each card what one more gives and its price with the wait or the lack", () => {
    const { store, realm } = realmBoard();
    // No labor yet, growing 100 an hour.
    labor(store, 0n);
    store.applyFacts([
      fact("0x78", "ResourceProduction", {
        remainder: 0,

        game_id: 1,
        entity_id: 7,
        resource_type: ResourcesIds.Labor,
        building_count: 1,
        production_rate: String((100n * BigInt(RESOURCE_PRECISION)) / 3_600n),
        output_amount_left: (1n << 128n) - 1n,
        last_settled_at: 350,
      }),
    ] as never);
    const band = (sheet: ReturnType<typeof open>, name: string) => sheet.card(name).querySelector(".ui-chip")!;
    const sheet = open(store, atKingdom(realm));
    expect(sheet.card("Farm").textContent).toMatch(/\+[\d,.]+\/(?:s|min)/);
    expect(band(sheet, "Farm").getAttribute("data-tone")).toBe("bad");
    expect(band(sheet, "Farm").textContent).toMatch(/\d+[mhd]$/);
    // Training names its purchases against the gate instead of a building rarity.
    expect(band(sheet, "Supply yard").textContent).not.toContain("research");
    sheet.close();

    // A training building standing: a tick on a green band.
    store.applyFacts([
      fact("0x72", "StructureBuildings", {
        game_id: 1,
        entity_id: 7,
        ...countsWith(BuildingType.SupplyYard, 1),
        population: { current: 2, max: 6 },
      }),
    ] as never);
    const built = open(store, atKingdom(realm));
    expect(band(built, "Supply yard").getAttribute("data-tone")).toBe("good");
    expect(band(built, "Supply yard").querySelector('[data-icon="check"]')).not.toBeNull();
    built.close();
  });

  it("shows each type's one gem and never words for it, and no gem on the Storeroom, which has no research", () => {
    const { store, realm } = realmBoard();
    store.applyFacts([fact("0x77", "RealmKnowledge", { game_id: 1, structure_id: 7, learned: String(2n) })] as never);
    const gems = (sheet: ReturnType<typeof open>, name: string) =>
      [...sheet.card(name).querySelectorAll(".ui-tier")].map((gem) =>
        gem.getAttribute("data-tier") === "0" ? "Untrained" : gem.textContent,
      );
    const sheet = open(store, atKingdom(realm));
    expect(gems(sheet, "Farm")).toEqual(["II"]);
    expect(gems(sheet, "Workshop")).toEqual(["Untrained"]);
    expect(gems(sheet, "Barracks")).toEqual(["I"]);
    expect(gems(sheet, "Supply yard")).toEqual(["I"]);
    expect(gems(sheet, "Storeroom")).toEqual([]);
    expect(sheet.host.textContent).not.toMatch(/ from (Fields|Tools)/);
    sheet.close();
  });

  it("says how much labor a building needs against what is held, and sends nobody to the map for it", () => {
    const { store, realm } = realmBoard();
    labor(store, 0n);
    // Even in a game whose reveals pay labor, the line is the whole answer: no Explore button (owner, 27 October).
    vi.spyOn(configManager, "paysRevealSupplies").mockReturnValue(true);
    const short = open(store, realm);
    expect(short.host.querySelector('[role="status"]')!.textContent).toMatch(/^Needs [\d,]+ Labor, have 0$/);
    expect(short.button("Build")).toBeUndefined();
    expect(short.host.textContent).not.toContain("Explore");
    short.close();
    vi.restoreAllMocks();
  });
});

it("reds only the price lines the realm holds less of, so a training building short of Essence keeps its Labor white", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store, realm } = realmBoard();
  const kingdom = atKingdom(realm);
  const balance = (resource: number, amount: bigint) => ({
    model: "ResourceBalance",
    // The fixture's own row keys: one per resource balance of the realm.
    key: resource === ResourcesIds.Labor ? "0x75" : "0x7638",
    value: { game_id: 1, entity_id: 7, resource_type: resource, balance: amount * BigInt(RESOURCE_PRECISION) },
  });
  // The Barracks' two research purchases bought, so training buildings show their price.
  store.applyFacts([
    {
      model: "RealmKnowledge",
      key: "0x77",
      value: { game_id: 1, structure_id: 7, learned: 2n << 14n },
    },
  ] as never);
  const supplyYard = store.require("BuildingRule", { game_id: 1, category: BuildingType.SupplyYard });
  store.applyFacts([
    {
      model: "BuildingRule",
      key: `0x6${BuildingType.SupplyYard}`,
      value: {
        ...supplyYard,
        simple_cost: [
          { resource_type: ResourcesIds.Essence, amount: 6000n * BigInt(RESOURCE_PRECISION) },
          { resource_type: ResourcesIds.Labor, amount: 1500n * BigInt(RESOURCE_PRECISION) },
        ],
      },
    },
  ]);
  const lines = () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <BuildSheet realm={kingdom} plot={{ col: 11, row: 10 }} onClose={() => undefined} />
        </GameProvider>,
      ),
    );
    const card = [...host.querySelectorAll<HTMLButtonElement>(".ui-card__choose")].find((button) =>
      button.textContent?.includes(buildingName(BuildingType.SupplyYard, true)),
    )!;
    const line = (label: string) => {
      const element = card.querySelector(`[aria-label="${label}"]`)!;
      // Its own color, never the band's: a line without one would take the red band's.
      const color = element.classList.contains("text-hud-bad")
        ? "red"
        : element.classList.contains("text-hud-ink")
          ? "white"
          : "band's";
      return { short: element.hasAttribute("data-short"), color };
    };
    const state = {
      essence: line("6,000 Essence"),
      labor: line("1,500 Labor"),
      band: card.querySelector(".ui-chip")!.getAttribute("data-tone"),
    };
    act(() => root.unmount());
    host.remove();
    return state;
  };

  // The owner's realm on 3 November: Labor enough, Essence not.
  store.applyFacts([balance(ResourcesIds.Labor, 100_000n), balance(ResourcesIds.Essence, 2_000n)] as never);
  expect(lines()).toEqual({
    essence: { short: true, color: "red" },
    labor: { short: false, color: "white" },
    band: "bad",
  });

  // Both held: every line white, and the band no longer red.
  store.applyFacts([balance(ResourcesIds.Essence, 12_000n)] as never);
  expect(lines()).toEqual({
    essence: { short: false, color: "white" },
    labor: { short: false, color: "white" },
    band: null,
  });

  // Labor short too: both lines red.
  store.applyFacts([balance(ResourcesIds.Labor, 1_000n), balance(ResourcesIds.Essence, 2_000n)] as never);
  expect(lines()).toEqual({
    essence: { short: true, color: "red" },
    labor: { short: true, color: "red" },
    band: "bad",
  });
});
