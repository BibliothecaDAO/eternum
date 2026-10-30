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
import { configManager, type GameClient, setBlockTimestampSource, learnResearch } from "@bibliothecadao/eternum";
import { nativeResearchConstants as research, type GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { BuildingType, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import preset from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { buildingCounts, realmBoard } from "./build-fixture";
import { BuildingsInFlight, BuildSheet } from "./build-sheet";

afterEach(() => {
  disposeGameSyncSession();
  setBlockTimestampSource(null);
  useUIStore.getState().setPreviewBuilding(null);
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

  it("opens on the building Next up asks for and stands it on the plot, until the player picks another", async () => {
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
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <BuildSheet realm={realm} plot={plot} asked={BuildingType.ResourceKnightT1} onClose={() => undefined} />
        </GameProvider>,
      ),
    );
    const pressed = () =>
      [...host.querySelectorAll<HTMLButtonElement>('.ui-card__choose[aria-pressed="true"]')].map(
        (card) => card.querySelector(".ui-card__title")?.textContent,
      );
    expect(pressed()).toEqual(["Barracks"]);
    expect(useUIStore.getState().previewBuilding).toEqual({ type: BuildingType.ResourceKnightT1, plot });
    // The player's own pick then holds over Next up's.
    const farm = [...host.querySelectorAll<HTMLButtonElement>(".ui-card__choose")].find(
      (card) => card.querySelector(".ui-card__title")?.textContent === "Farm",
    )!;
    act(() => farm.click());
    expect(pressed()).toEqual(["Farm"]);
    act(() => root.unmount());
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
    await settle({ hash: "0x1", block: 9, status: "REJECTED", revertReason: "Not enough population" });
    expect(refused.mock.lastCall?.[0]).toBe("Not enough population");
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
  const population = (store: ReturnType<typeof realmBoard>["store"], current: number) =>
    store.applyFacts([
      fact("0x72", "StructureBuildings", {
        game_id: 1,
        entity_id: 7,
        packed_counts_1: "0",
        packed_counts_2: "0",
        packed_counts_3: "0",
        population: { current, max: 6 },
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

  it("keeps the realm's population in its head, used of all it can hold", () => {
    const { store, realm } = realmBoard();
    const total = 6 + configManager.getBasePopulationCapacity();
    population(store, 4);
    const sheet = open(store, realm);
    expect(sheet.host.querySelector(`[aria-label="population 4/${total}"]`)).not.toBeNull();
    sheet.close();
  });

  it("offers Build for a Workshop on a realm whose own resources make no labor, as the contract allows on a board", () => {
    const { store, realm } = realmBoard();
    labor(store, 50_000n);
    const workshop = preset.buildings.find(({ category }) => category === BuildingType.ResourceLabor)!;
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
    expect(sheet.host.querySelector(".ui-cost")?.textContent).toBe("2,000 labor");
    // Build and its price stand in the sheet's foot, outside the body that scrolls: the verb never scrolls away.
    expect(sheet.button("Build")!.closest(".ui-window__foot")).not.toBeNull();
    expect(sheet.host.querySelector(".ui-window__foot .ui-cost")?.textContent).toBe("2,000 labor");
    sheet.close();
  });

  it("says what a building needs of the population that is free, and Build Hut on the gold button chooses the Hut", () => {
    const { store, realm } = realmBoard();
    labor(store, 50_000n);
    const total = 6 + configManager.getBasePopulationCapacity();
    population(store, total - 1);
    const sheet = open(store, realm);
    act(() => sheet.card("Barracks").click());
    const cost = configManager.getBuildingCategoryConfig(BuildingType.ResourceKnightT1).population_cost;
    expect(sheet.host.querySelector('[role="status"]')!.textContent).toBe(`Needs ${cost} population, 1 free`);
    expect(sheet.button("Build")!.textContent).toContain("Build Hut");
    // Why, and the way past it, stand together in the foot, in view however many cards the body holds.
    expect(sheet.button("Build Hut")!.closest(".ui-window__foot")).not.toBeNull();
    expect(sheet.host.querySelector('.ui-window__foot [role="status"]')!.textContent).toBe(
      `Needs ${cost} population, 1 free`,
    );
    act(() => sheet.button("Build Hut")!.click());
    expect(sheet.card("Hut").getAttribute("aria-pressed")).toBe("true");
    // A Hut takes no population: it is the fix, and Build stands under it.
    expect(sheet.host.querySelector('[role="status"]')).toBeNull();
    sheet.close();
  });

  it("says on each card what the building does, and marks a risen price with the rule that raised it", () => {
    const { store, realm } = realmBoard();
    const sheet = open(store, realm);
    const farm = configManager.getBuildingCategoryConfig(BuildingType.ResourceWheat).population_cost;
    expect(sheet.card("Farm").closest("[data-tip]")!.getAttribute("data-tip")).toMatch(
      new RegExp(`^Farm: wheat \\+[\\d,.]+/(?:s|min), takes ${farm} population$`),
    );
    expect(sheet.card("Hut").closest("[data-tip]")!.getAttribute("data-tip")).toMatch(/^Hut: \+\d+ population$/);
    expect(sheet.card("War hall").closest("[data-tip]")!.getAttribute("data-tip")).toMatch(
      /^War hall: new armies start with Battle I(, takes \d+ population)?$/,
    );
    // No Farm stands on the board yet (the fixture's wheat comes with the realm): its price is its base.
    expect(sheet.card("Farm").querySelector('[aria-label="price raised"]')).toBeNull();
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
    expect(risen.card("Farm").querySelector(".ui-chip")!.textContent).not.toBe(base);
    risen.close();
  });

  it("says on each card what one more gives, the population it takes, and its price with the wait or the lack", () => {
    const { store, realm } = realmBoard();
    // No labor yet, growing 100 an hour.
    labor(store, 0n);
    store.applyFacts([
      fact("0x78", "ResourceProduction", {
        game_id: 1,
        entity_id: 7,
        resource_type: ResourcesIds.Labor,
        building_count: 1,
        production_rate: String((100n * BigInt(RESOURCE_PRECISION)) / 3_600n),
        output_amount_left: "0",
        last_settled_at: 350,
      }),
    ] as never);
    const band = (sheet: ReturnType<typeof open>, name: string) => sheet.card(name).querySelector(".ui-chip")!;
    const sheet = open(store, realm);
    const farm = configManager.getBuildingCategoryConfig(BuildingType.ResourceWheat).population_cost;
    // What one more Farm makes, the population it takes, then its price in red with the wait at a glance ("7m").
    expect(sheet.card("Farm").textContent).toMatch(/\+[\d,.]+\/(?:s|min)/);
    // The population it takes stands in the card's corner, beside its painting.
    expect(
      sheet.card("Farm").closest(".ui-card")!.querySelector(`.ui-card__corner [aria-label="population ${farm}"]`),
    ).not.toBeNull();
    expect(band(sheet, "Farm").getAttribute("data-tone")).toBe("bad");
    expect(band(sheet, "Farm").textContent).toMatch(/\d+[mhd]$/);
    // Training names its purchase count instead of a building rarity.
    expect(band(sheet, "War hall").textContent).toBe("2 research");
    sheet.close();

    // Labor for all; the population full: a building that takes some says so in amber, the Hut stands ready.
    labor(store, 1_000_000n);
    population(store, 6 + configManager.getBasePopulationCapacity());
    const full = open(store, realm);
    expect(band(full, "Farm").getAttribute("data-tone")).toBe("warn");
    expect(band(full, "Hut").getAttribute("data-tone")).toBeNull();
    full.close();

    // A training building standing: a tick on a green band.
    store.applyFacts([
      fact("0x72", "StructureBuildings", {
        game_id: 1,
        entity_id: 7,
        ...countsWith(BuildingType.WarHall, 1),
        population: { current: 2, max: 6 },
      }),
    ] as never);
    const built = open(store, realm);
    expect(band(built, "War hall").getAttribute("data-tone")).toBe("good");
    expect(band(built, "War hall").querySelector('[data-icon="check"]')).not.toBeNull();
    built.close();
  });

  it("shows each side's own gem where a row has two, else the type's one gem, and never words for them", () => {
    const { store, realm } = realmBoard();
    const learn = (learned: bigint) =>
      store.applyFacts([
        fact("0x77", "RealmKnowledge", { game_id: 1, structure_id: 7, learned: String(learned) }),
      ] as never);
    // A side's gem with its mark, as the card draws them: "fields III".
    const gems = (sheet: ReturnType<typeof open>, name: string) =>
      [...sheet.card(name).querySelectorAll(".ui-tier")].map((gem) =>
        [
          gem.closest("[data-side]")?.getAttribute("data-side"),
          gem.getAttribute("data-tier") === "0" ? "Untrained" : gem.textContent,
        ]
          .filter(Boolean)
          .join(" "),
      );
    // Independent Farm ranks occupy bits 0–2 and 3–5; the Hut rank starts at bit 21.
    // Two Fields purchases and one Granary purchase show different ranks.
    learn(2n | (1n << 3n) | (3n << 21n));
    const mixed = open(store, realm);
    expect(gems(mixed, "Farm")).toEqual(["fields II", "granary I"]);
    expect(gems(mixed, "Workshop")).toEqual(["tools Untrained", "storehouse Untrained"]);
    expect(gems(mixed, "Barracks")).toEqual(["drill Untrained", "rations Untrained"]);
    // A row without sides keeps its type's one gem: the Hut at Rare III, a training building at Common I.
    expect(gems(mixed, "Hut")).toEqual(["III"]);
    expect(gems(mixed, "War hall")).toEqual(["I"]);
    // Gems, never words for them (owner, 27 October: "why no gems instead of the text ?").
    expect(mixed.host.textContent).not.toMatch(/ from (Fields|Tools|Drill)/);
    mixed.close();
    // Two Fields purchases with Granary untrained.
    learn(2n);
    const fields = open(store, realm);
    expect(gems(fields, "Farm")).toEqual(["fields II", "granary Untrained"]);
    fields.close();
  });

  it("says on the Hut's card what the chain grants for one more: its grant and the change in the rounded bonus", () => {
    const { store, realm } = realmBoard();
    const grant = configManager.getBuildingCategoryConfig(BuildingType.WorkersHut).capacity_grant;
    // The Hut row at its first tier (research.cairo: bit 21), on the fixture board's 2,500 bps step.
    store.applyFacts([
      fact("0x77", "RealmKnowledge", { game_id: 1, structure_id: 7, learned: String(1n << 21n) }),
    ] as never);
    const hutGives = (standing: number) => {
      store.applyFacts([
        fact("0x72", "StructureBuildings", {
          game_id: 1,
          entity_id: 7,
          ...countsWith(BuildingType.WorkersHut, standing),
          population: { current: 0, max: 6 },
        }),
      ] as never);
      const sheet = open(store, realm);
      // What one more gives stands beside its painting (a Hut takes no population, so the only person mark).
      const gives = sheet
        .card("Hut")
        .querySelector('[data-icon="person"]')!
        .parentElement!.textContent!.replace("+", "");
      sheet.close();
      return Number(gives);
    };
    // buildings.cairo's hut_bonus over all standing Huts, the difference granted: floor(2 × 6 × 0.25) − floor(6 × 0.25)
    // = 3 − 1 with one standing, floor(3 × 6 × 0.25) − floor(2 × 6 × 0.25) = 4 − 3 with two.
    expect(grant).toBe(6);
    expect(hutGives(1)).toBe(6 + 2);
    expect(hutGives(2)).toBe(6 + 1);
  });

  it("says what opens a locked training building, with the way there on the gold button", () => {
    const { store, realm } = realmBoard();
    const onResearch = vi.fn();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const render = () =>
      act(() =>
        root.render(
          <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
            <BuildSheet realm={realm} plot={{ col: 11, row: 10 }} onResearch={onResearch} onClose={() => undefined} />
          </GameProvider>,
        ),
      );
    const card = (name: string) =>
      [...host.querySelectorAll<HTMLButtonElement>(".ui-card__choose")].find(
        (card) => card.querySelector(".ui-card__title")?.textContent === name,
      )!;
    const gold = () => [...host.querySelectorAll("button")].at(-1)!;
    render();
    act(() => card("War hall").click());
    // Training needs two Barracks purchases; no Barracks stands yet.
    expect(host.querySelector('[role="status"]')!.textContent).toBe("Needs 2 Barracks research purchases");
    expect(gold().textContent).toMatch(/^Build Barracks/);
    act(() => gold().click());
    expect(card("Barracks").getAttribute("aria-pressed")).toBe("true");

    store.applyFacts([
      fact("0x72", "StructureBuildings", {
        game_id: 1,
        entity_id: 7,
        ...countsWith(BuildingType.ResourceKnightT1, 1),
        population: { current: 3, max: 6 },
      }),
    ] as never);
    render();
    act(() => card("War hall").click());
    expect(gold().textContent).toBe("Research");
    act(() => gold().click());
    expect(onResearch).toHaveBeenCalledOnce();
    act(() => root.unmount());
    host.remove();
  });

  it("says how much labor a building needs against what is held, and sends nobody to the map for it", () => {
    const { store, realm } = realmBoard();
    labor(store, 0n);
    // Even in a game whose reveals pay labor, the line is the whole answer: no Explore button (owner, 27 October).
    vi.spyOn(configManager, "paysRevealSupplies").mockReturnValue(true);
    const short = open(store, realm);
    expect(short.host.querySelector('[role="status"]')!.textContent).toMatch(/^Needs [\d,]+ labor, have 0$/);
    expect(short.button("Build")).toBeUndefined();
    expect(short.host.textContent).not.toContain("Explore");
    short.close();
    vi.restoreAllMocks();
  });
});

it("chooses the free Scouts kind on the build sheet and submits it with construction", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store, realm } = realmBoard();
  store.applyFacts([
    {
      model: "RealmKnowledge",
      key: "0x77",
      value: { game_id: 1, structure_id: 7, learned: (1n << 14n) | (1n << 17n) },
    },
    {
      model: "ResourceBalance",
      key: "0x75",
      value: {
        game_id: 1,
        entity_id: 7,
        resource_type: ResourcesIds.Labor,
        balance: 100000n * BigInt(RESOURCE_PRECISION),
      },
    },
  ] as never);
  const game = store.require("GameRegistry", { game_id: 1 });
  store.applyFacts([{ model: "GameRegistry", key: "0x3", value: { ...game, preset_id: 5 } }]);
  configManager.setActiveGame(1, 5);
  configManager.setStore(store);
  const lodge = store.require("BuildingRule", { game_id: 1, category: BuildingType.ScoutsLodge });
  store.applyFacts([
    {
      model: "BuildingRule",
      key: `0x6${BuildingType.ScoutsLodge}`,
      value: {
        ...lodge,
        population_cost: 2,
        simple_cost: [
          { resource_type: ResourcesIds.Essence, amount: 6000n * BigInt(RESOURCE_PRECISION) },
          { resource_type: ResourcesIds.Labor, amount: 1500n * BigInt(RESOURCE_PRECISION) },
        ],
      },
    },
  ]);
  store.applyFacts([
    {
      model: "ResourceBalance",
      key: "0x7638",
      value: {
        game_id: 1,
        entity_id: 7,
        resource_type: ResourcesIds.Essence,
        balance: 12000n * BigInt(RESOURCE_PRECISION),
      },
    },
  ]);
  const placeBuilding = vi.fn(() => Promise.resolve({ transaction_hash: "0x2" }));
  installActiveGameClient({
    connect() {},
    disconnect() {},
    dispose() {},
    actions: { placeBuilding },
    waitForAction: () => Promise.resolve({ hash: "0x2", block: 10, status: "SUCCEEDED" }),
  } as unknown as GameClient);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <BuildSheet realm={realm} plot={{ col: 11, row: 10 }} onClose={() => {}} />
        </GameProvider>,
      ),
    );
    const card = [...host.querySelectorAll<HTMLButtonElement>(".ui-card__choose")].find((button) =>
      button.textContent?.includes("Scouts"),
    )!;
    act(() => card.click());
    expect(card.querySelector(".ui-tier")?.textContent).toBe("I");
    expect(card.querySelector('[aria-label="6,000 Essence"]')).not.toBeNull();
    expect(card.querySelector('[aria-label="1,500 labor"]')).not.toBeNull();
    expect(host.textContent).not.toContain("Beasts");
    expect(host.textContent).not.toContain("Sanctuaries");
    const knowledge = store.require("RealmKnowledge", { game_id: 1, structure_id: 7 });
    act(() =>
      store.applyFacts([
        {
          model: "RealmKnowledge",
          key: "0x77",
          value: { ...knowledge, learned: learnResearch(knowledge.learned, research.ROW_SHRINE, 0) },
        },
      ]),
    );
    const sanctuaries = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "Sanctuaries",
    )!;
    expect(sanctuaries.querySelectorAll("img[data-icon]").length).toBe(2);
    act(() => sanctuaries.click());
    expect(sanctuaries.getAttribute("aria-pressed")).toBe("true");
    const build = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "Build",
    )!;
    expect(build, host.textContent ?? "").toBeDefined();
    await act(async () => build.click());
    expect(placeBuilding).toHaveBeenCalledWith(
      expect.objectContaining({ buildingType: BuildingType.ScoutsLodge, scoutingKind: 2 }),
    );
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
