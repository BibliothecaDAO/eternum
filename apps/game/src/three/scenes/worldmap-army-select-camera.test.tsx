// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

/** Where the requested army stands on screen: the test moves it into view or out of it. */
const onScreen = vi.hoisted(() => ({ point: { x: 100, y: 100 } }));
vi.mock("@/three/utils/project-hex-to-screen", () => ({ projectHexToScreen: () => onScreen.point }));

const { configManager } = await import("@bibliothecadao/eternum");
const { useAccountStore } = await import("@/hooks/store/use-account-store");
const { useUIStore } = await import("@/hooks/store/use-ui-store");
const { default: WorldmapScene } = await import("./worldmap");

const ARMY = 7;
const ARMY_HEX = { col: 4, row: 5 };

/** The screen's width: a desktop at and above the HUD's desktop width, a phone below it. */
const screen = (desktop: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: desktop && query.includes("min-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

/**
 * The world map taking the HUD's request to select one of the player's armies (a dock's pick): its own decision runs;
 * the camera's moves and the selection itself are recorded instead of drawn.
 */
const worldMap = (frontier: boolean) => {
  const moves: { moveCamera: boolean | undefined }[] = [];
  const framed: unknown[] = [];
  const scene = Object.assign(Object.create(WorldmapScene.prototype), {
    camera: {},
    isFrontierHud: () => frontier,
    getArmyDisplayPosition: () => ARMY_HEX,
    runShortcutArmySelection: async (select: () => Promise<void>) => select(),
    focusAndSelectArmy: async (
      entityId: number,
      _at: unknown,
      _account: unknown,
      options?: { moveCamera?: boolean },
    ) => {
      moves.push({ moveCamera: options?.moveCamera });
      useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, selectedEntityId: entityId } }));
    },
    frameOnOpenMap: (positions: unknown[]) => framed.push(positions),
  }) as { selectRequestedArmy: (entityId: number, forSite: null) => Promise<void> };
  return { scene, moves, framed };
};

beforeEach(() => {
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(2147483646);
  useAccountStore.setState({ account: { address: "0x111" } as never });
  useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, selectedEntityId: null } }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("keeps a Frontier phone's camera still for an army in sight, so the next tap lands where it is aimed", async () => {
  screen(false);
  onScreen.point = { x: 100, y: 100 };
  const { scene, moves, framed } = worldMap(true);
  await scene.selectRequestedArmy(ARMY, null);
  expect([moves, framed.length]).toEqual([[{ moveCamera: false }], 0]);
});

it("frames an army out of sight on a Frontier phone", async () => {
  screen(false);
  onScreen.point = { x: -500, y: -500 };
  const { scene, moves, framed } = worldMap(true);
  await scene.selectRequestedArmy(ARMY, null);
  expect([moves, framed.length]).toEqual([[{ moveCamera: true }], 1]);
});

it.each([
  ["a Frontier desktop", true, true],
  ["a Blitz phone", false, false],
  ["a Blitz desktop", false, true],
])("frames the army on %s, in sight or not, as it always has", async (_, frontier, desktop) => {
  screen(desktop);
  for (const point of [
    { x: 100, y: 100 },
    { x: -500, y: -500 },
  ]) {
    onScreen.point = point;
    const { scene, moves, framed } = worldMap(frontier);
    await scene.selectRequestedArmy(ARMY, null);
    expect([moves, framed.length]).toEqual([[{ moveCamera: true }], 1]);
  }
});
