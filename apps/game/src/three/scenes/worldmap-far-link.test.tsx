// @vitest-environment jsdom
import { configManager, Position } from "@bibliothecadao/eternum";
import gsap from "gsap";
import { act } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { createRendererRouteRuntime } from "@/three/renderer-route-runtime";
import { SceneName } from "@/three/types";
import { WORLD_HEX_SPACE } from "@/three/utils/utils";
import { isWithinWorldOriginReach, setWorldOrigin } from "@/three/world-origin";

import { createCameraTransitionState } from "./hexagon-scene-camera-transition";
import WorldmapScene from "./worldmap";

import { worldMapCamera } from "./worldmap-camera.test-support";

vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: { get: () => undefined } } }) }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0 }));

const { FeedRowLine } = await import("@/ui/features/event-feed/feed-row-line");

/** Prod's Frontier game: its map centre, and two realms' sites on day 2 (regions 973,167 and 1,508,272). */
const CENTER = 1_596_960_486;
const HOME = { x: 97_316_650, y: 850 };
const FAR = { x: 150_827_150, y: 850 };
const sceneHex = ({ x, y }: { x: number; y: number }) => ({ col: x - CENTER, row: y - CENTER });

/** What a case started, stopped after it however it ends. */
const started: (() => void)[] = [];

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(CENTER);
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  useUIStore.getState().selectOnMap(null);
});
afterEach(() => {
  started.splice(0).forEach((stop) => stop());
  vi.restoreAllMocks();
});

/**
 * The player's map, drawn around their realm, with the game's route runtime moving its camera as the address changes,
 * and the map clearing its selection as it moves (WorldmapScene's urlChanged handler).
 */
const theMapAtHome = () => {
  const { x: col, y: row } = Position.fromContract(HOME).getNormalized();
  window.history.replaceState({}, "", `/g/0xa1/1/map?col=${col}&row=${row}`);
  const map = worldMapCamera({ col, row }, { drawnAround: { col, row } });
  const route = createRendererRouteRuntime({
    fadeIn: () => {},
    getCurrentScene: () => SceneName.WorldMap,
    markLabelsDirty: () => {},
    moveCameraForScene: () => map.scene.moveCameraToURLLocation({ requestRefresh: false }),
    ownPage: () => {},
    switchScene: () => {},
  });
  const clearsSelection = () => useUIStore.getState().selectOnMap(null);
  window.addEventListener("urlChanged", clearsSelection);
  route.start();
  started.push(() => {
    route.dispose();
    window.removeEventListener("urlChanged", clearsSelection);
  });
  return map;
};

/** The row as the Events card and the Log draw it, mounted for the case. */
const drawRow = async (event: ProcessedStoryEvent) => {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<FeedRowLine event={event} />));
  started.push(() => act(() => root.unmount()));
  return { click: () => act(async () => host.querySelector("button")!.click()) };
};

/** A fight on another realm's site, as the Events card and the Log draw its row. */
const fightAt = (coord: { x: number; y: number }) =>
  ({
    id: "fight",
    event_id: "fight",
    story: "BattleEvent",
    owner: "0x2",
    participants: ["0x2"],
    entity_id: 0,
    timestamp: "100",
    timestampMs: 100_000,
    storyPayload: { coord },
    presentation: { title: "A fight · Guard holds", description: "" },
  }) as unknown as ProcessedStoryEvent;

describe("an event on a realm millions of hexes away, opened from its row", () => {
  it("moves the map there in the page, its camera and selection on the event's tile", async () => {
    const map = theMapAtHome();
    const row = await drawRow(fightAt(FAR));

    await row.click();

    // The link names the tile in the URL's own space: the owner's address, normalized from the contract hex.
    expect(window.location.pathname + window.location.search).toBe("/g/0xa1/1/map?col=-1446133336&row=-1596959636");
    expect(map.aimed).toEqual([sceneHex(FAR)]);
    // The world is drawn again around the event's tile, which stands within the origin's reach.
    expect(map.redrawnAround).toHaveLength(1);
    expect(isWithinWorldOriginReach(sceneHex(FAR))).toBe(true);
    expect(useUIStore.getState().selectedHex).toEqual({ col: FAR.x, row: FAR.y });
  });

  it("goes straight there, drawing nothing again, when the tile is within the origin's reach", async () => {
    const map = theMapAtHome();
    const near = { x: HOME.x + 300, y: HOME.y };
    const row = await drawRow(fightAt(near));

    await row.click();

    expect(map.aimed).toEqual([sceneHex(near)]);
    expect(map.redrawnAround).toEqual([]);
    expect(useUIStore.getState().selectedHex).toEqual({ col: near.x, row: near.y });
  });
});

/**
 * The player's map at home with its own camera: the scene's camera moves and their animations run on the page's
 * animation clock (gsap), as the map flies the camera; only drawing is left out.
 */
const theMapWithItsCamera = () => {
  const home = sceneHex(HOME);
  setWorldOrigin(home);
  window.history.replaceState({}, "", `/g/0xa1/1/map?col=${home.col}&row=${home.row}`);
  const { x, y, z } = WORLD_HEX_SPACE.positionForHex(home);
  const camera = new PerspectiveCamera();
  camera.position.set(x, y + 40, z + 30);
  const scene = Object.assign(Object.create(WorldmapScene.prototype), {
    worldOriginLocked: true,
    hasInitialized: true,
    camera,
    controls: { object: camera, target: new Vector3(x, y, z) },
    cameraTransitionState: createCameraTransitionState(),
    cameraTransitionTimeline: null,
    cameraTransitionStatus: "idle",
    cameraTransitionListeners: new Set(),
    notifyControlsChanged: () => {},
    redrawWorld: () => {},
  }) as {
    moveCameraToURLLocation: (options: { requestRefresh: boolean }) => void;
    moveCameraToMapPosition: (position: Position, reason: "dev-tools", duration: number) => void;
    getCameraTargetHex: () => { col: number; row: number };
    isCameraTransitionInProgress: () => boolean;
  };
  const route = createRendererRouteRuntime({
    fadeIn: () => {},
    getCurrentScene: () => SceneName.WorldMap,
    markLabelsDirty: () => {},
    moveCameraForScene: () => scene.moveCameraToURLLocation({ requestRefresh: false }),
    ownPage: () => {},
    switchScene: () => {},
  });
  route.start();
  started.push(() => route.dispose());
  return { scene, flying: () => scene.isCameraTransitionInProgress() };
};

/** The page's animation clock moved on by `seconds`, as frames would move it. */
const animate = (seconds: number) => gsap.updateRoot(gsap.ticker.time + seconds);

describe("a far event pressed while the camera is still flying somewhere near", () => {
  it("ends that flight: the camera stays on the event's tile as the animations run on", async () => {
    const map = theMapWithItsCamera();
    map.scene.moveCameraToMapPosition(Position.fromContract({ x: HOME.x + 300, y: HOME.y }), "dev-tools", 2);
    animate(1);
    expect(map.flying()).toBe(true);
    const row = await drawRow(fightAt(FAR));

    await row.click();
    animate(5);

    expect(map.scene.getCameraTargetHex()).toEqual(sceneHex(FAR));
    expect(map.flying()).toBe(false);
    expect(useUIStore.getState().selectedHex).toEqual({ col: FAR.x, row: FAR.y });
  });
});
