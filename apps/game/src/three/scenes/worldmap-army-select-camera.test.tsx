// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Where the army and the site stand on screen: the test puts them in the map's open area or out of it. */
const onScreen = vi.hoisted(() => ({ point: { x: 700, y: 450 } }));
vi.mock("@/three/utils/project-hex-to-screen", () => ({ projectHexToScreen: () => onScreen.point }));

const { configManager, Position } = await import("@bibliothecadao/eternum");
const { useUIStore } = await import("@/hooks/store/use-ui-store");
const { pickArmyFor } = await import("@/ui/features/frontier/sites/selected-army");
const { requestArmyShown, takeArmySelectRequest } = await import("./worldmap-army-select-request");
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

const selectedArmy = () => useUIStore.getState().entityActions.selectedEntityId;

const SCREENS = [
  ["a Frontier desktop", true, true],
  ["a Frontier phone", true, false],
  ["a Blitz desktop", false, true],
  ["a Blitz phone", false, false],
] as const;

beforeEach(() => {
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(MAP_CENTER);
  useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, selectedEntityId: null } }));
});
afterEach(() => {
  takeArmySelectRequest();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Owner, 28 October 2026: "it moves the camera when I fight for example".
describe("an army picked on a site's card to fight it", () => {
  it.each(SCREENS)(
    "on %s, is the card's actor and the camera stays where the player had it",
    async (_, frontier, desktop) => {
      screen(desktop);
      for (const point of [inSight(desktop), OUT_OF_SIGHT]) {
        onScreen.point = point;
        const world = worldMapCamera(ARMY_HEX, { drawnAround: ARMY_HEX });
        const before = world.scene.camera.position.clone();

        pickArmyFor(ARMY, { col: MAP_CENTER + SITE_HEX.col, row: MAP_CENTER + SITE_HEX.row });
        await mapTakesRequest(world, frontier);

        expect(selectedArmy()).toBe(ARMY);
        expect(world.openedCards).toEqual([{ col: MAP_CENTER + SITE_HEX.col, row: MAP_CENTER + SITE_HEX.row }]);
        expect(world.aimed).toEqual([]);
        expect(world.scene.camera.position).toEqual(before);
      }
    },
  );

  it("is brought into view when the map does not draw it where the camera looks, since only a drawn army is selected", async () => {
    screen(true);
    const world = worldMapCamera(ARMY_HEX, { drawnAround: ARMY_HEX, armyDrawn: false });

    pickArmyFor(ARMY, { col: MAP_CENTER + SITE_HEX.col, row: MAP_CENTER + SITE_HEX.row });
    await mapTakesRequest(world, true);

    expect(world.aimed.length).toBeGreaterThan(0);
    expect(world.openedCards).toEqual([{ col: MAP_CENTER + SITE_HEX.col, row: MAP_CENTER + SITE_HEX.row }]);
  });
});

describe("an army shown from the HUD (its dock token, Next up, idle armies)", () => {
  it.each(SCREENS)("on %s, in sight, is selected where it stands, the camera unmoved", async (_, frontier, desktop) => {
    screen(desktop);
    onScreen.point = inSight(desktop);
    const world = worldMapCamera(ARMY_HEX, { drawnAround: ARMY_HEX });

    requestArmyShown(ARMY);
    await mapTakesRequest(world, frontier);

    expect(selectedArmy()).toBe(ARMY);
    expect(world.aimed).toEqual([]);
  });

  it.each(SCREENS)("on %s, out of sight, is framed and selected", async (_, frontier, desktop) => {
    screen(desktop);
    onScreen.point = OUT_OF_SIGHT;
    const world = worldMapCamera(ARMY_HEX, { drawnAround: ARMY_HEX });

    requestArmyShown(ARMY);
    await mapTakesRequest(world, frontier);

    expect(selectedArmy()).toBe(ARMY);
    expect(world.aimed[0]).toEqual(ARMY_HEX);
  });

  it("with its target, frames both when the target is out of sight, and opens the target's card", async () => {
    screen(true);
    onScreen.point = OUT_OF_SIGHT;
    const world = worldMapCamera(ARMY_HEX, { drawnAround: ARMY_HEX });

    requestArmyShown(ARMY, Position.fromNormalized({ x: SITE_HEX.col, y: SITE_HEX.row }));
    await mapTakesRequest(world, true);

    expect(world.aimed.length).toBeGreaterThan(1);
    expect(world.openedCards).toEqual([{ col: MAP_CENTER + SITE_HEX.col, row: MAP_CENTER + SITE_HEX.row }]);
  });
});
