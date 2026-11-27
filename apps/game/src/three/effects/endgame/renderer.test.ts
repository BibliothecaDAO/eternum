import { gameRegistryRow } from "../../../../../../packages/core/src/test-support/game-registry";
import { GAME_FAMILIES } from "../../../../../../config/source/common/native-preset-modes";
// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { Group, InstancedMesh, PerspectiveCamera, Scene } from "three";
import { ClientConfigManager } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { TileOccupier } from "@bibliothecadao/types";
import release from "../../../../../../contracts/l3/world-native/schema/release-definition.json";
import { runRendererFrame } from "../../renderer-frame-runtime";
import { SpireManager } from "../../managers/spire-manager";
import { SceneName } from "../../types";
import { resetGameEnd, skipGameEnd } from "./state";
import { markWorldInteractive } from "@/game-entry/world-interactive";

// These spires stand in a game whose first view is up: their models load at once.
markWorldInteractive();

vi.mock("@/three/map-layer", () => ({ activeMapLayer: () => false }));
vi.mock("@/ui/config", () => ({ FELT_CENTER: () => 0, IS_FLAT_MODE: false }));
vi.mock("@/hooks/store/use-ui-store", () => ({ useUIStore: { subscribe: () => () => {} } }));
const owned: Array<() => void> = [];
afterEach(() => {
  owned.splice(0).forEach((dispose) => dispose());
  resetGameEnd();
});
async function harness(ended = false, discovered = false, revealWhilePreparing = false) {
  const store = new NativeFactStore();
  const registry = (settled: boolean) =>
    store.applyFacts([
      {
        model: "GameRegistry",
        key: "1",
        value: gameRegistryRow({
          game_id: 13,
          family: GAME_FAMILIES.blitz,
          start_main_at: "1",
          scheduled_end_at: "0",
          end_at: "0",
          settled,
        }),
      },
    ]);
  registry(ended);
  store.applyFacts([{ model: "SliceRules", key: "2", value: { ...release.definition.rules, game_id: 13 } }]);
  store.applyFacts(
    Array.from({ length: 20 }, (_, i) => ({
      model: "TileOpt",
      key: String(i + 100),
      value: { game_id: 13, alt: false, col: i % 5, row: Math.floor(i / 5), data: String(4n << 41n) },
    })),
  );
  if (discovered)
    store.applyFacts([
      {
        model: "TileOccupancy",
        key: "3",
        value: {
          game_id: 13,
          alt: false,
          col: 1,
          row: 1,
          category: TileOccupier.DormantSpire,
          entity_id: 100,
          is_structure: false,
        },
      },
    ]);
  const config = new ClientConfigManager();
  config.setActiveGame(13);
  config.setStore(store);
  const projection = new WorldSpatialProjection({ store });
  projection.start();
  const scene = new Scene(),
    camera = new PerspectiveCamera();
  const compile = vi.fn(async (object) => {
    expect(object.parent).toBeNull();
    if (revealWhilePreparing)
      store.applyFacts(
        Array.from({ length: 3 }, (_, i) => ({
          model: "TileOccupancy",
          key: String(i + 5000),
          value: {
            game_id: 13,
            alt: false,
            col: i,
            row: 1,
            category: TileOccupier.DormantSpire,
            entity_id: i + 5000,
            is_structure: false,
          },
        })),
      );
  });
  const manager = new SpireManager(scene, projection, new Group(), undefined, undefined, compile);
  owned.push(() => {
    manager.destroy();
    projection.dispose();
  });
  // The world map asks for the veil in the game's last minutes, before its end.
  manager.prepareGameEnd();
  await manager.prepare();
  expect(scene.getObjectByName("Spires")).toBeDefined();
  expect(compile).toHaveBeenCalledWith(scene.getObjectByName("Spires"), scene);
  const preparedCompiles = compile.mock.calls.length;
  expect(preparedCompiles).toBeGreaterThanOrEqual(2);
  const update = vi.fn(),
    paused = vi.fn(),
    advance = vi.fn((frame, delta) => manager.advanceGameEnd(frame, delta, camera, { col: 2, row: 2 }));
  const controller = {
    getCurrentCameraView: () => undefined,
    getInteractionOverlayScene: () => new Scene(),
    getScene: () => scene,
    hasActiveLabelAnimations: () => false,
    setWeatherAtmosphereState: () => {},
    setAnimationsPaused: paused,
    update: () => {},
    advanceGameEnd: advance,
  };
  const render = (delta = 0.1) =>
    runRendererFrame({
      backend: { renderer: {}, renderFrame: vi.fn() } as never,
      camera,
      captureStatsSample: () => {},
      currentScene: SceneName.WorldMap,
      currentTime: performance.now(),
      cycleProgress: 50,
      deltaTime: delta,
      gameEnd: { gameId: 13, ended: config.isGameOver(), frontier: true },
      worldmapScene: controller,
      hexceptionScene: controller,
      hudScene: {
        getCamera: () => camera,
        getScene: () => new Scene(),
        getWeatherState: () => ({ intensity: 0, stormIntensity: 0 }),
        update,
      },
      labelRuntime: { render: () => {}, shouldRender: () => false },
    });
  return { store, registry, manager, render, paused, advance, update, compile, preparedCompiles, scene };
}
it("the native settled fact starts the real renderer event, keeps Results skippable, then holds the map", async () => {
  const h = await harness();
  h.render();
  expect(h.manager.getEndgameSnapshot()).toBeNull();
  expect(h.paused).toHaveBeenLastCalledWith(false);
  h.registry(true);
  const revision = h.store.getRevision();
  h.render(0.4);
  expect(h.advance.mock.lastCall?.[0]).toMatchObject({ phase: "materialising", finished: false });
  const sites = h.manager.getEndgameSnapshot()!.spireSites;
  expect(sites).toHaveLength(2);
  for (const p of sites)
    expect(h.store.get("TileOpt", { game_id: 13, alt: false, col: p.col, row: p.row })).toBeDefined();
  h.render(2);
  expect(h.manager.getEndgameSnapshot()).toMatchObject({ mistDraws: 1, burstDraws: 2, sparedHex: { col: 2, row: 2 } });
  expect(skipGameEnd()).toBe(true);
  h.render(0);
  expect(h.paused).toHaveBeenLastCalledWith(true);
  expect(h.manager.getEndgameSnapshot()).toMatchObject({ mistDraws: 1, burstDraws: 0 });
  expect(h.store.getRevision()).toBe(revision);
  expect(h.compile).toHaveBeenCalledTimes(h.preparedCompiles);
});
it("an already-ended visit renders the final state and reuses a discovered spire without inventing another", async () => {
  const h = await harness(true, true);
  h.render(0);
  expect(h.advance.mock.lastCall?.[0]).toMatchObject({ seconds: 9, finished: true });
  expect(h.manager.getEndgameSnapshot()).toMatchObject({
    spireSites: [{ col: 1, row: 1, materialise: false }],
    mistDraws: 1,
    burstDraws: 0,
  });
  expect(skipGameEnd()).toBe(false);
});

it("keeps spires revealed while their pipelines prepare, including a larger native batch", async () => {
  const h = await harness(false, false, true);
  const native = h.scene.getObjectByName("Spires")!;
  expect(
    native.children
      .filter((mesh): mesh is InstancedMesh => mesh instanceof InstancedMesh && mesh.visible)
      .map((mesh) => mesh.count),
  ).toEqual([3, 3]);
  h.render();
  expect(h.manager.getEndgameSnapshot()).toBeNull();
});
