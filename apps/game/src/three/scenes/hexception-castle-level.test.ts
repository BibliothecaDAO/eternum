// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";

const { TileManager } = await import("@bibliothecadao/eternum");
const { frontierDay } = await import("@/ui/features/frontier/deploy/deploy-fixture");
const { default: HexceptionScene } = await import("./hexception");
const { localCameraMaxDistance } = await import("./local-camera-reach");
const { SceneName } = await import("../types");

/** The scene the game shows now: the realm view unless a test has gone to the map. */
const shown = { scene: SceneName.Hexception as string };

const REALM = 7;
const REALM_TILE = { col: 5, row: 5 };

type Fixture = ReturnType<typeof frontierDay>;

/**
 * The realm view as a player holds it: realm 7 selected before the scene exists (as Frontier's one realm is from
 * entry), the scene following the game's facts as its constructor wires it, and each grid build recorded with the
 * castle level it was laid out for instead of drawn.
 */
const realmView = ({ store }: Fixture) => {
  const builds: { level: number; ringToLight: number | null }[] = [];
  const scene = Object.assign(Object.create(HexceptionScene.prototype), {
    game: { store },
    state: { structureEntityId: REALM, setSelectedBuildingHex: () => {} },
    shownRealmId: REALM,
    structureStage: 0,
    newRingRadius: null,
    isEntered: true,
    isInitialized: true,
    destroyed: false,
    lastRealmKey: `${REALM_TILE.col},${REALM_TILE.row}`,
    hexceptionRadius: 4,
    shownMapHexes: new Set(),
    labels: [],
    buildingInstances: new Map(),
    wonderAuras: new Map(),
    buildingMixers: new Map(),
    scene: { add: () => {}, remove: () => {} },
    hoverLabelManager: { clear: () => {} },
    controls: {} as { maxDistance?: number },
    // A phone held upright: the castle's reach decides how far the camera may pull back.
    camera: { aspect: 390 / 844, fov: 45 },
    sceneManager: { getCurrentScene: () => shown.scene },
    inputManager: { activate: () => {} },
    tileManager: TileManager.forStructure(store, {} as never, REALM),
    gridBuilds: {
      start: () => builds.push({ level: scene.structureStage, ringToLight: scene.newRingRadius }),
    },
    // Entering the realm view again: the route names the realm, and the scene's presentation is already prepared.
    startLocalAssets: () => {},
    selectRouteStructure: () => ({
      structure: store.require("Structure", { game_id: 1, entity_id: REALM }),
      position: REALM_TILE,
    }),
    bootstrapSceneOwnership: () => {},
    moveCameraToURLLocation: () => {},
    standCameraAtPreferredZoom: () => {},
    getThunderBoltManager: () => ({ setConfig: () => {} }),
    localPresentation: Promise.resolve(),
    presentation: Promise.resolve(),
    reconcileAllBuildingInstances: () => {},
  });
  const stop = store.subscribe((changes) => scene.answerFactChanges(changes));
  return { scene, builds, stop };
};

/** The contract's level_up, as Herald delivers it: realm 7's row with its level one higher. */
const raiseCastle = ({ store }: Fixture) => {
  const realm = store.require("Structure", { game_id: 1, entity_id: REALM });
  store.applyFacts([
    { model: "Structure", key: "0x7", value: { ...realm, base: { ...realm.base, level: realm.base.level + 1 } } },
  ] as never);
};

let view: ReturnType<typeof realmView> | undefined;
beforeEach(() => window.history.replaceState(null, "", "/g/0x1/1/hex?col=5&row=5"));
afterEach(() => {
  view?.stop();
  shown.scene = SceneName.Hexception;
});

it("redraws an open realm view for a castle raised to City: its grid laid out at City, the new second ring lit", () => {
  const fixture = frontierDay();
  view = realmView(fixture);
  raiseCastle(fixture);
  expect(view.builds).toEqual([{ level: 1, ringToLight: 2 }]);
  // City's second ring fits on the phone: the camera may now pull back that far.
  expect(view.scene.controls.maxDistance).toBe(
    localCameraMaxDistance({ plotRadius: 2, aspect: 390 / 844, fovDegrees: 45 }),
  );
});

it("shows a castle raised while the player was on the map once they come back to the realm view", async () => {
  const fixture = frontierDay();
  view = realmView(fixture);
  view.scene.onSwitchOff();
  raiseCastle(fixture);
  expect(view.builds).toEqual([]);
  await view.scene.setup();
  expect(view.builds).toEqual([{ level: 1, ringToLight: 2 }]);
});

it("leaves the grid alone when the realm's row changes but its level does not", () => {
  const fixture = frontierDay();
  view = realmView(fixture);
  const realm = fixture.store.require("Structure", { game_id: 1, entity_id: REALM });
  fixture.store.applyFacts([{ model: "Structure", key: "0x7", value: { ...realm, resources_packed: "0x1" } }] as never);
  expect(view.builds).toEqual([]);
});

it("fits the farthest zoom again when the phone turns in the realm view, at Kingdom and at Empire", () => {
  for (const [level, plotRadius] of [
    [2, 3],
    [3, 4],
  ] as const) {
    const fixture = frontierDay();
    const realm = fixture.store.require("Structure", { game_id: 1, entity_id: REALM });
    fixture.store.applyFacts([
      { model: "Structure", key: "0x7", value: { ...realm, base: { ...realm.base, level } } },
    ] as never);
    view = realmView(fixture);
    // Entered with the phone on its side: the board already fits at the view's own limit.
    view.scene.camera.aspect = 844 / 390;
    view.scene.updateCastleLevel();
    expect(view.scene.controls.maxDistance).toBe(20);
    // Turned upright, as the renderer's resize reports it: the whole board fits again, with no leaving and no level up.
    view.scene.camera.aspect = 390 / 844;
    view.scene.followScreenShape();
    expect(view.scene.controls.maxDistance).toBe(
      localCameraMaxDistance({ plotRadius, aspect: 390 / 844, fovDegrees: 45 }),
    );
    view.stop();
  }
});

it("leaves the zoom limit alone when the screen turns while the map is shown, whose controls these are then", () => {
  view = realmView(frontierDay());
  view.scene.controls.maxDistance = 65;
  shown.scene = SceneName.WorldMap;
  view.scene.camera.aspect = 844 / 390;
  view.scene.followScreenShape();
  expect(view.scene.controls.maxDistance).toBe(65);
});

it("fits the farthest zoom to a phone turned while the realm was still being entered, once the realm is shown", () => {
  const fixture = frontierDay();
  const realm = fixture.store.require("Structure", { game_id: 1, entity_id: REALM });
  fixture.store.applyFacts([
    { model: "Structure", key: "0x7", value: { ...realm, base: { ...realm.base, level: 2 } } },
  ] as never);
  view = realmView(fixture);
  // Entry has begun from the map with the phone on its side: setup fits the Kingdom to landscape, its presentation pending.
  shown.scene = SceneName.WorldMap;
  view.scene.camera.aspect = 844 / 390;
  view.scene.updateCastleLevel();
  expect(view.scene.controls.maxDistance).toBe(20);
  // The phone turns upright before the realm is shown: the renderer's resize reaches a scene the map still owns.
  view.scene.camera.aspect = 390 / 844;
  view.scene.followScreenShape();
  expect(view.scene.controls.maxDistance).toBe(20);
  // Entry completes: the scene manager makes the realm current and activates it, and the limit is the upright Kingdom's.
  shown.scene = SceneName.Hexception;
  view.scene.activateInputSurface();
  expect(view.scene.controls.maxDistance).toBe(
    localCameraMaxDistance({ plotRadius: 3, aspect: 390 / 844, fovDegrees: 45 }),
  );
});
