// @vitest-environment jsdom
import { BUILDINGS_CENTER, StructureType } from "@bibliothecadao/types";
import gsap from "gsap";
import { PerspectiveCamera, Vector3 } from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { configManager, TileManager } = await import("@bibliothecadao/eternum");

const { createCameraTransitionState } = await import("./hexagon-scene-camera-transition");
const { createRendererRouteRuntime } = await import("../renderer-route-runtime");
const { SceneFlight } = await import("../managers/scene-flight");
const { TransitionManager } = await import("../managers/transition-manager");
const { SceneManager } = await import("../scene-manager");
const { useWorldAppearanceStore } = await import("@/hooks/store/use-world-appearance-store");
const { HexagonScene } = await import("./hexagon-scene");
const { SceneName } = await import("../types");
const { default: HexceptionScene } = await import("./hexception");

const { frontierDay } = await import("@/ui/features/frontier/deploy/deploy-fixture");

const REALM = { entityId: 7, category: StructureType.Realm, position: { x: 5, y: 5 } };
const MAP_PITCH = (42 * Math.PI) / 180;

/**
 * The realm view of a player with one realm, as the game holds it: its keys registered, its camera shared with the
 * world map and standing where the map left it, and an address change answered by the renderer setting the view up
 * again (the route runtime's switch to the realm view). Its presentation and drawing are already prepared.
 */
const realmView = () => {
  const camera = new PerspectiveCamera();
  const target = new Vector3(3, 0, 4);
  camera.position.set(target.x, Math.sin(MAP_PITCH) * 10, target.z + Math.cos(MAP_PITCH) * 10);
  const scene = Object.assign(Object.create(HexceptionScene.prototype), {
    camera,
    controls: { object: camera, target, minDistance: 2, maxDistance: 40 },
    sceneManager: { getCurrentScene: () => SceneName.Hexception },
    state: { structureEntityId: REALM.entityId, setStructureEntityId: () => {} },
    shownRealmId: REALM.entityId,
    playerStructures: [REALM],
    structureIndex: 0,
    labels: [],
    isInitialized: true,
    lastRealmKey: "5,5",
    destroyed: false,
    gridIsStale: false,
    cameraAngle: MAP_PITCH,
    cameraTransitionState: createCameraTransitionState(),
    cameraTransitionTimeline: null,
    cameraTransitionStatus: "idle",
    cameraTransitionListeners: new Set(),
    localPresentation: Promise.resolve(),
    startLocalAssets: () => {},
    selectRouteStructure: () => ({ structure: { entity_id: REALM.entityId }, position: { col: 5, row: 5 } }),
    bootstrapSceneOwnership: () => {},
    getThunderBoltManager: () => ({ setConfig: () => {} }),
    tileManager: TileManager.forStructure(frontierDay().store, {} as never, REALM.entityId),
    reconcileAllBuildingInstances: () => {},
    notifyControlsChanged: () => {},
  });
  scene.registerRealmShortcuts();
  let settingUp: Promise<void> = Promise.resolve();
  const route = createRendererRouteRuntime({
    fadeIn: () => {},
    getCurrentScene: () => SceneName.Hexception,
    markLabelsDirty: () => {},
    moveCameraForScene: () => {},
    ownPage: () => {},
    switchScene: () => {
      settingUp = scene.setup();
    },
  });
  route.syncFromLocation();
  route.start();
  return { scene, route, setUp: () => settingUp };
};

/** Time enough for every camera move under way to finish. */
const finishCameraMoves = () => gsap.globalTimeline.getChildren().forEach((move) => move.progress(1));

/** Where the camera looks from: its distance, pitch and heading around its target, and the target itself. */
const poseOf = ({ controls }: ReturnType<typeof realmView>["scene"]) => {
  const offset = controls.object.position.clone().sub(controls.target);
  return {
    distance: Number(offset.length().toFixed(3)),
    pitchDegrees: Number(((Math.asin(offset.y / offset.length()) * 180) / Math.PI).toFixed(3)),
    headingDegrees: Number(((Math.atan2(offset.x, offset.z) * 180) / Math.PI).toFixed(3)),
    target: controls.target.toArray().map((value: number) => Number(value.toFixed(3))),
  };
};

/** The player enters from the world map: the view is set up, then the flight reveals the camera where setup left it. */
const enterFromMap = async (view: ReturnType<typeof realmView>) => {
  await view.setUp();
  new SceneFlight(view.scene, SceneName.Hexception).reveal(view.scene);
  await Promise.resolve();
  await Promise.resolve();
  finishCameraMoves();
};

let view: ReturnType<typeof realmView> | undefined;
beforeEach(() => {
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(2147483646);
  window.history.replaceState(null, "", "/g/0x1/1/hex?col=5&row=5");
});
afterEach(() => {
  view?.route.dispose();
  gsap.globalTimeline.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("leaves the realm view's camera where it stands when the player presses Tab", async () => {
  view = realmView();
  await enterFromMap(view);
  const entered = poseOf(view.scene);

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
  await view.setUp();
  finishCameraMoves();

  expect(poseOf(view.scene)).toEqual(entered);
});

it("stands the camera at the realm view's own pitch and the player's zoom on entering from the map", async () => {
  view = realmView();
  await enterFromMap(view);
  expect(poseOf(view.scene)).toMatchObject({ distance: 14, pitchDegrees: 52, headingDegrees: 0 });
});

it("lets no move the map left running carry the camera past the realm view's pose: a minimap pan, reduced motion", async () => {
  view = realmView();
  await view.setUp();
  view.route.dispose();
  const transitions = new TransitionManager();
  const manager = new SceneManager(transitions);
  // The world map, sharing the realm view's camera, mid-way through the minimap's 0.25 s pan (worldmap.tsx).
  const map = Object.assign(Object.create(HexagonScene.prototype), {
    camera: view.scene.camera,
    controls: view.scene.controls,
    cameraTransitionState: createCameraTransitionState(),
    cameraTransitionTimeline: null,
    cameraTransitionStatus: "idle",
    cameraTransitionListeners: new Set(),
    notifyControlsChanged: () => {},
    onSwitchOff: () => {},
    deactivateInputSurface: () => {},
  });
  manager.addScene(SceneName.WorldMap, map);
  manager.addScene(SceneName.Hexception, view.scene);
  manager._updateCurrentScene(SceneName.WorldMap);
  view.scene.sceneManager = manager;
  const motion = useWorldAppearanceStore.getState().reducedMotion;
  useWorldAppearanceStore.setState({ reducedMotion: true });
  try {
    // The map's own pose, 42° at distance 10, from which its pan starts.
    const { camera, controls } = view.scene;
    camera.position.copy(controls.target).add(new Vector3(0, Math.sin(MAP_PITCH) * 10, Math.cos(MAP_PITCH) * 10));
    map.moveCameraToXYZ(100, 0, 100, 0.25);
    map.cameraTransitionTimeline.progress(0.1);
    manager.switchScene(SceneName.Hexception);
    finishCameraMoves();
    await vi.waitFor(() => expect(manager.getCurrentScene()).toBe(SceneName.Hexception));
    const centre = view.scene.hexSpace.positionForHex({ col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] });
    expect(poseOf(view.scene)).toMatchObject({
      distance: 14,
      pitchDegrees: 52,
      target: [centre.x, centre.y, centre.z].map((value) => Number(value.toFixed(3))),
    });
    // The pan was stopped through its own scene, whose transition is closed, not left running.
    expect(map.cameraTransitionStatus).toBe("idle");
    const arrived = poseOf(view.scene);
    finishCameraMoves();
    expect(poseOf(view.scene)).toEqual(arrived);
  } finally {
    transitions.destroy();
    useWorldAppearanceStore.setState({ reducedMotion: motion });
  }
});

it("leaves the camera on the castle when the player taps a plot at the board's edge on a phone", async () => {
  vi.stubGlobal("innerWidth", 390);
  vi.stubGlobal("innerHeight", 844);
  view = realmView();
  await enterFromMap(view);
  Object.assign(view.scene.state, { setSelectedBuildingHex: () => {}, setLeftNavigationView: () => {} });
  const entered = poseOf(view.scene);

  // The board's foot, four rows below the castle, which an open sheet would cover.
  await view.scene.onHexagonClick({ col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] + 4 });
  await new Promise((frame) => requestAnimationFrame(() => requestAnimationFrame(frame)));
  finishCameraMoves();

  expect(poseOf(view.scene)).toEqual(entered);
});
