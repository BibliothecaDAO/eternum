// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { configManager } = await import("@bibliothecadao/eternum");
const { Direction } = await import("@bibliothecadao/types");
const { DEPLOY_ON_MAP_EVENT, readDeployOnMap, showDeployOnMap } = await import("./worldmap-deploy-request");
const { MAP_CENTER, worldMapCamera } = await import("./worldmap-camera.test-support");

const REALM = 9;
/** The realm's tile, far from where the player has the camera, as scene hexes. */
const REALM_HEX = { col: 40, row: -30 };
const LOOKING_AT = { col: 0, row: 0 };

/** The screen's width: a desktop at and above the HUD's desktop width, a phone below it. */
const screen = (desktop: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: desktop && query.includes("min-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

/**
 * Frontier's world map hearing its Deploy sheet open, as the sheet tells it (showDeployOnMap): the map's own handling
 * runs, and every camera move it makes is recorded (worldMapCamera). The realm's selection itself is left out.
 */
const worldMap = () => {
  const { aimed, scene } = worldMapCamera(LOOKING_AT, { drawnAround: LOOKING_AT });
  const map = Object.assign(scene, {
    getStructureHexPosition: () => REALM_HEX,
    onStructureSelection: () => {},
  }) as unknown as { camera: { position: { clone: () => unknown } }; showDeployOrder: (order: unknown) => void };
  // The map's own listener: what its deploy handler does with the sheet's order.
  const hear = (event: Event) => map.showDeployOrder(readDeployOnMap(event));
  window.addEventListener(DEPLOY_ON_MAP_EVENT, hear);
  return { aimed, map, stop: () => window.removeEventListener(DEPLOY_ON_MAP_EVENT, hear) };
};

let stop = () => {};
beforeEach(() => {
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(MAP_CENTER);
});
afterEach(() => {
  stop();
  showDeployOnMap(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Owner, 27 October 2026: "when I right click to deploy an army stop centering the camera on the realm ffs".
it.each([
  ["a desktop's right-click", true],
  ["a phone's tap", false],
])("Deploy opened by %s on a lit tile beside the realm leaves the camera where the player had it", (_, desktop) => {
  screen(desktop);
  const world = worldMap();
  stop = world.stop;
  const before = world.map.camera.position.clone();

  showDeployOnMap({ structureId: REALM, direction: Direction.EAST });
  showDeployOnMap({ structureId: REALM, direction: Direction.SOUTH_EAST });

  expect(world.aimed).toEqual([]);
  expect(world.map.camera.position).toEqual(before);
});
