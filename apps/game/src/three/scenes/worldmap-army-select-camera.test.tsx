// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Where the army and the site stand on screen: the test puts them in the map's open area or out of it. */
const onScreen = vi.hoisted(() => ({ point: { x: 700, y: 450 } }));
vi.mock("@/three/utils/project-hex-to-screen", () => ({ projectHexToScreen: () => onScreen.point }));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: {} } }) }));

const { configManager, Position } = await import("@bibliothecadao/eternum");
const { useUIStore } = await import("@/hooks/store/use-ui-store");
const { usePickArmy } = await import("@/ui/features/frontier/army/army-opens");
const { requestArmySelection, takeArmySelectRequest } = await import("./worldmap-army-select-request");
const { MAP_CENTER, worldMapCamera } = await import("./worldmap-camera.test-support");

const ARMY = 7;
/** The army's tile and a site beside it, as the scene's hexes. */
const ARMY_HEX = { col: 4, row: 5 };
const SITE_HEX = { col: 6, row: 5 };
/** A point in the middle of the map's open area on either screen, and one off the screen. */
const inSight = (desktop: boolean) => (desktop ? { x: 720, y: 400 } : { x: 195, y: 300 });
const OUT_OF_SIGHT = { x: -500, y: -500 };

/** The screen: a desktop at 1440×900, or a phone at 390×844 below the HUD's desktop width. */
const screen = (desktop: boolean) => {
  const [width, height] = desktop ? [1440, 900] : [390, 844];
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: desktop && query.includes("min-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("innerHeight", height);
};

/** The world map taking the HUD's request as its handler does: the scene's own selection and camera run. */
const mapTakesRequest = async (world: ReturnType<typeof worldMapCamera>, frontier: boolean) => {
  Object.assign(world.scene, { isFrontierHud: () => frontier });
  const request = takeArmySelectRequest();
  if (!request) throw new Error("The HUD asked nothing");
  await world.scene.selectRequestedArmy(request);
};

/** A pick in the Armies list or the dock, through the hook both press (usePickArmy), on the world map. */
const pickFromArmiesList = (explorerId: number) => {
  window.history.replaceState({}, "", "/g/0xa1/1/map");
  const Row = () => {
    const pick = usePickArmy();
    return <button onClick={() => pick(explorerId)}>Army</button>;
  };
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<Row />));
  act(() => host.querySelector("button")!.click());
  act(() => root.unmount());
};

const selectedArmy = () => useUIStore.getState().entityActions.selectedEntityId;

const SCREENS = [
  ["a Frontier desktop", true, true],
  ["a Frontier phone", true, false],
  ["a Blitz desktop", false, true],
  ["a Blitz phone", false, false],
] as const;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(MAP_CENTER);
  useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, selectedEntityId: null } }));
});
afterEach(() => {
  takeArmySelectRequest();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Owner, 28 October 2026: "I mean picking from here should center the camera indeed its a player request".
describe("an army picked in the Armies list or the dock", () => {
  it.each(SCREENS)("on %s, is framed and selected, in sight or not", async (_, frontier, desktop) => {
    screen(desktop);
    for (const point of [inSight(desktop), OUT_OF_SIGHT]) {
      onScreen.point = point;
      const world = worldMapCamera(ARMY_HEX, { drawnAround: ARMY_HEX });

      pickFromArmiesList(ARMY);
      await mapTakesRequest(world, frontier);

      expect(selectedArmy()).toBe(ARMY);
      expect(world.aimed[0]).toEqual(ARMY_HEX);
    }
  });

  it("with a coach step's target, frames both and opens the target's card", async () => {
    screen(true);
    const world = worldMapCamera(ARMY_HEX, { drawnAround: ARMY_HEX });

    requestArmySelection(ARMY, Position.fromNormalized({ x: SITE_HEX.col, y: SITE_HEX.row }));
    await mapTakesRequest(world, true);

    expect(world.aimed.length).toBeGreaterThan(1);
    expect(world.openedCards).toEqual([{ col: MAP_CENTER + SITE_HEX.col, row: MAP_CENTER + SITE_HEX.row }]);
  });
});

describe("Tab, the player's key to go to the next army", () => {
  it.each(SCREENS)("on %s, still brings the camera onto it and selects it", async (_, frontier, desktop) => {
    screen(desktop);
    const world = worldMapCamera(ARMY_HEX, { drawnAround: { col: 0, row: 0 } });
    Object.assign(world.scene, {
      isFrontierHud: () => frontier,
      selectableArmies: [{ entityId: ARMY }],
      armyIndex: -1,
      hasOrderInFlight: () => false,
      canArmyAct: () => true,
    });

    await (world.scene as unknown as { selectNextArmy: () => Promise<void> }).selectNextArmy();

    expect(selectedArmy()).toBe(ARMY);
    expect(world.aimed).toEqual([ARMY_HEX]);
  });
});
