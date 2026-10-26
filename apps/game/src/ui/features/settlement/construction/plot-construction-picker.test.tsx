// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: { getInstance: () => ({ play: () => Promise.resolve(null) }) },
}));

import { GameProvider } from "@/hooks/context/game-context";
import { type SurfaceAnchor, usePopoverStore } from "@/hooks/store/use-popover-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { SurfaceHost } from "@/ui/design-system/molecules/popover";
import { panelOf } from "@/ui/design-system/molecules/surface-panel-testing";
import { disposeGameSyncSession, installActiveGameClient } from "@/sync/active-game-client";
import { type GameClient, readBuildingTiles } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { BuildingType } from "@bibliothecadao/types";

import { BLITZ_PLOT, BLITZ_REALM_ID, installBlitzBuildRealm } from "../../debug/kit-lab/blitz-build-fixture";
import { PLAYER } from "../../debug/kit-lab/fixture-game";
import { installLabGame } from "../../debug/kit-lab/fixture-game";
import { PlotConstructionPicker } from "./plot-construction-picker";

afterEach(() => disposeGameSyncSession());

/** The lab's Blitz realm (preset 2, the owner's nine resources) as the game holds it, and its build call. */
const installPickerGame = (stocked: boolean) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const store = installLabGame(2, false);
  installBlitzBuildRealm(store, stocked);
  useUIStore.setState({ useSimpleCost: false, isSpectating: false });
  const placeBuilding = vi.fn(() => Promise.resolve({ transaction_hash: "0x1" }));
  installActiveGameClient({
    connect() {},
    disconnect() {},
    dispose() {},
    actions: { placeBuilding },
    waitForAction: () => Promise.resolve({ hash: "0x1", block: 9, status: "SUCCEEDED" }),
  } as unknown as GameClient);
  return { store, placeBuilding };
};

/** The picker on the realm's plot, as its tiles read it. */
const picker = (store: ReturnType<typeof installLabGame>) => (
  <PlotConstructionPicker
    entityId={BLITZ_REALM_ID}
    spot={BLITZ_PLOT}
    tileManager={readBuildingTiles(store, {} as Parameters<typeof readBuildingTiles>[1], BLITZ_REALM_ID)}
    isCurrentTarget={() => true}
  />
);

/** The real picker on the lab's Blitz realm, drawn alone. */
const openPicker = (stocked: boolean) => {
  const { store, placeBuilding } = installPickerGame(stocked);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: PLAYER } as never}>
        {picker(store)}
      </GameProvider>,
    ),
  );
  const tab = (name: string) =>
    act(() =>
      [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((each) => each.textContent === name)!.click(),
    );
  const tiles = () => [...host.querySelectorAll<HTMLButtonElement>("button[data-building]")];
  const tile = (building: BuildingType) => tiles().find((each) => each.dataset.building === String(building))!;
  const order = () => tiles().map((each) => Number(each.dataset.building));
  const button = (name: string) => [...host.querySelectorAll("button")].find((each) => each.textContent === name);
  const close = () => {
    act(() => root.unmount());
    host.remove();
  };
  return { host, tab, tile, order, button, placeBuilding, close };
};

const RESOURCE_LINES = [
  BuildingType.ResourceWood,
  BuildingType.ResourceCoal,
  BuildingType.ResourceCopper,
  BuildingType.ResourceIronwood,
  BuildingType.ResourceColdIron,
  BuildingType.ResourceGold,
  BuildingType.ResourceAdamantine,
  BuildingType.ResourceMithral,
  BuildingType.ResourceDragonhide,
];

describe("Blitz's Build on this plot panel", () => {
  it("lays the resources in their lines, a tier a row, in the same places whatever the realm can raise", () => {
    // Little held: most cannot rise. Stocked: the commons can. The places never change.
    for (const stocked of [false, true]) {
      const panel = openPicker(stocked);
      expect([...panel.host.querySelectorAll('[role="tab"]')].map((each) => each.textContent)).toEqual([
        "Resources",
        "Economic",
        "Military",
      ]);
      expect(panel.order()).toEqual(RESOURCE_LINES);
      // The tab opens on its grid's first building, Wood, whatever order the realm lists its resources in.
      expect(panel.tile(BuildingType.ResourceWood).getAttribute("aria-pressed")).toBe("true");
      // A building the realm cannot raise stays in its place, locked.
      expect(panel.tile(BuildingType.ResourceDragonhide).querySelector('[data-icon="lock"]')).not.toBeNull();
      expect(panel.tile(BuildingType.ResourceWood).querySelector('[data-icon="lock"]') === null).toBe(stocked);
      panel.close();
    }
  });

  it("lays the army a troop type a column, Paladin, Knight, Crossbowman, and a tier a row", () => {
    const panel = openPicker(true);
    panel.tab("Military");
    const heads = [...panel.host.querySelectorAll('[role="columnheader"]')].map((each) => each.textContent);
    expect(heads).toEqual(["Paladin", "Knight", "Crossbowman"]);
    expect(panel.order()).toEqual([
      BuildingType.ResourcePaladinT1,
      BuildingType.ResourceKnightT1,
      BuildingType.ResourceCrossbowmanT1,
      BuildingType.ResourcePaladinT2,
      BuildingType.ResourceKnightT2,
      BuildingType.ResourceCrossbowmanT2,
      BuildingType.ResourcePaladinT3,
      BuildingType.ResourceKnightT3,
      BuildingType.ResourceCrossbowmanT3,
    ]);
    // A troop building is named by its tier under its type's head, so no name truncates.
    expect(panel.tile(BuildingType.ResourceCrossbowmanT3).textContent).toBe("T3");
    panel.close();
  });

  it("stands the chosen building whole below, and builds it on the plot; one it cannot raise says why", async () => {
    const panel = openPicker(true);
    act(() => panel.tile(BuildingType.ResourceCoal).click());
    expect(panel.tile(BuildingType.ResourceCoal).getAttribute("aria-pressed")).toBe("true");
    expect(panel.host.querySelector('[aria-label="Build cost"]')).not.toBeNull();
    await act(async () => panel.button("Build")!.click());
    expect(panel.placeBuilding).toHaveBeenCalledWith(
      expect.objectContaining({
        structureId: BLITZ_REALM_ID,
        buildingType: BuildingType.ResourceCoal,
        hex: BLITZ_PLOT,
      }),
    );

    act(() => panel.tile(BuildingType.ResourceDragonhide).click());
    expect(panel.button("Build")).toBeUndefined();
    expect(panel.host.querySelector('[role="status"]')!.textContent).toBe("Insufficient resources to build.");
    panel.close();
  });

  it("lists the economy a row a building, with what one more gives and its cost", () => {
    const panel = openPicker(true);
    panel.tab("Economic");
    const rows = [...panel.host.querySelectorAll('[role="listbox"] .ui-row')];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].textContent).toMatch(/^Farm/);
    expect(rows[0].textContent).toMatch(/Wheat \+[\d,.]+\/(?:s|min)/);
    // The building's model artwork and its cost painted, a resource icon with its amount.
    expect(rows[0].querySelector("[data-building-thumbnail]")?.getAttribute("src")).toBe(
      "/images/buildings/construction/farm.png",
    );
    expect(rows[0].querySelector("[data-icon]")?.getAttribute("src")).toContain("/icons/facets/");
    panel.close();
  });
});

describe("the panel hanging from a plot", () => {
  /** A plot low in the middle of a 1267×1014 screen, as the player's report shows it. */
  const PLOT: SurfaceAnchor = { left: 640, right: 640, top: 600, bottom: 600 };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** The picker as the realm view opens it from a plot, in the game's one surface host. */
  const openOnPlot = () => {
    const { store } = installPickerGame(true);
    vi.stubGlobal("innerWidth", 1267);
    vi.stubGlobal("innerHeight", 1014);
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    // The panel's height is its open tab's: the resources' grid stands taller than the economy's rows.
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.textContent?.includes("Ironwood") ? 490 : 380;
    });
    let contentResized = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          contentResized = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: PLAYER } as never}>
          <SurfaceHost />
        </GameProvider>,
      ),
    );
    act(() =>
      usePopoverStore.getState().openSurface({ id: "plot-construction", anchor: PLOT, content: picker(store) }),
    );
    const panel = () => panelOf("plot-construction")!;
    const tab = (name: string) => {
      act(() =>
        [...panel().querySelectorAll<HTMLButtonElement>('[role="tab"]')]
          .find((each) => each.textContent === name)!
          .click(),
      );
      act(() => contentResized());
    };
    const close = () => {
      act(() => usePopoverStore.getState().close("plot-construction"));
      act(() => root.unmount());
      host.remove();
    };
    return { panel, tab, close };
  };

  it("stays where it opened when another tab is shorter or taller, so the tabs stay under the pointer", () => {
    const opened = openOnPlot();
    // No room below the plot for the resources' 490 px, so it hangs above it: 600 - 8 - 490.
    expect(opened.panel().style.top).toBe("102px");
    opened.tab("Economic");
    expect(opened.panel().style.top).toBe("102px");
    opened.tab("Resources");
    expect(opened.panel().style.top).toBe("102px");
    opened.close();
  });
});
