// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

// Documented load-sensitive file (see instanced-model.material-semantics):
// full-suite contention pushes setup past the default 5s on green code.
vi.setConfig({ testTimeout: 30_000 });

const stubBrowserPreloadGlobals = () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      json: async () => ({}),
      ok: true,
    })),
  );

  Object.defineProperty(navigator, "getBattery", {
    configurable: true,
    value: vi.fn(async () => ({ charging: true })),
  });
};

beforeEach(() => {
  vi.restoreAllMocks();
  stubBrowserPreloadGlobals();
});

describe("play-asset-manifest", () => {
  it("includes the shared HDR environment map in the dashboard fetch set", async () => {
    const { DASHBOARD_SHARED_PLAY_FETCH_ASSETS } = await import("./play-asset-manifest");

    expect(DASHBOARD_SHARED_PLAY_FETCH_ASSETS).toContain("/textures/environment/models_env.hdr");
  });

  it("prefetches the procedural ground arrays and their provenance manifest", async () => {
    const { DASHBOARD_SHARED_PLAY_FETCH_ASSETS } = await import("./play-asset-manifest");
    const { TERRAIN_GROUND_MANIFEST_PATH, TERRAIN_GROUND_TEXTURE_PATHS } =
      await import("@/three/terrain/terrain-ground-catalog");

    TERRAIN_GROUND_TEXTURE_PATHS.forEach((assetPath) => {
      expect(DASHBOARD_SHARED_PLAY_FETCH_ASSETS).toContain(assetPath);
    });
    expect(DASHBOARD_SHARED_PLAY_FETCH_ASSETS).toContain(TERRAIN_GROUND_MANIFEST_PATH);
  });

  it("warms terrain while leaving entity models to the selected game's visible scene", async () => {
    const { DASHBOARD_SHARED_PLAY_MODEL_ASSETS } = await import("./play-asset-manifest");
    const { TERRAIN_PROP_CATALOG_PATH } = await import("@/three/terrain/terrain-prop-catalog");

    expect(DASHBOARD_SHARED_PLAY_MODEL_ASSETS).toContain(TERRAIN_PROP_CATALOG_PATH);
    expect(DASHBOARD_SHARED_PLAY_MODEL_ASSETS).not.toContain("/models/ethereal/spire.glb");
    expect(DASHBOARD_SHARED_PLAY_MODEL_ASSETS).not.toContain("/models/reward-tiles/chest.glb");
    expect(
      DASHBOARD_SHARED_PLAY_MODEL_ASSETS.some((path) => /\/(settlements|units|ships|new-buildings-opt)\//.test(path)),
    ).toBe(false);
  });

  it("keeps Blitz-only exclusions out of local model loading and spires out of Blitz", async () => {
    const { getGameModeConfig } = await import("@/config/game-modes");
    const { BuildingType } = await import("@bibliothecadao/types");
    const { BUILDINGS_GROUPS } = await import("@/three/constants/scene-constants");
    const blitz = getGameModeConfig({ modeId: "blitz" }).assets;
    const eternum = getGameModeConfig({ modeId: "eternum" }).assets;
    for (const type of [BuildingType.ResourceFish, BuildingType.ResourceResearch]) {
      expect(blitz.buildingModelPaths[BUILDINGS_GROUPS.BUILDINGS][type]).toBeUndefined();
      expect(eternum.buildingModelPaths[BUILDINGS_GROUPS.BUILDINGS][type]).toBeDefined();
    }
    expect(blitz.buildingModelPaths[BUILDINGS_GROUPS.BUILDINGS][BuildingType.Storehouse]).toBeDefined();
    const paths = [
      ...Object.values(blitz.structureModelPaths).flat(),
      ...Object.values(blitz.buildingModelPaths).flatMap((group) => Object.values(group)),
    ];
    expect(paths).not.toContain("/models/ethereal/spire.glb");
    expect(paths).not.toContain("/models/new-buildings-opt/fishery.glb");
  });

  it("excludes audio, videos, cosmetics, and landing-only promo art from dashboard preloads", async () => {
    const {
      DASHBOARD_SHARED_PLAY_FETCH_ASSETS,
      DASHBOARD_SHARED_PLAY_IMAGE_ASSETS,
      DASHBOARD_SHARED_PLAY_MODEL_ASSETS,
    } = await import("./play-asset-manifest");
    const dashboardAssets = [
      ...DASHBOARD_SHARED_PLAY_FETCH_ASSETS,
      ...DASHBOARD_SHARED_PLAY_MODEL_ASSETS,
      ...DASHBOARD_SHARED_PLAY_IMAGE_ASSETS,
    ];

    dashboardAssets.forEach((assetPath) => {
      expect(assetPath).not.toMatch(/^\/sound\//);
      expect(assetPath).not.toMatch(/\.mp4$/);
      expect(assetPath).not.toMatch(/^\/models\/cosmetics\//);
    });

    expect(dashboardAssets).not.toContain("/images/covers/og-image.png");
    expect(dashboardAssets).not.toContain("/images/logos/argent-x.svg");
    expect(dashboardAssets).not.toContain("/images/logos/braavos.svg");
    expect(dashboardAssets).not.toContain("/images/logos/daydreams.png");
  });
});
