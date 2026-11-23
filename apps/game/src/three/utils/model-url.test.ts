import { DefaultLoadingManager } from "three";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("has every three.js loader fetch a model at the URL the build serves it at, a glTF's own buffer included", async () => {
  vi.stubGlobal("__MODEL_URLS__", {
    "/models/realms/city.glb": "/models/realms/city.1f2e3d4c5b6a.glb",
    "/models/characters/dragon/scene.bin": "/models/characters/dragon/scene.0a1b2c3d4e5f.bin",
  });
  const { modelUrl } = await import("./model-url");

  expect(modelUrl("/models/realms/city.glb")).toBe("/models/realms/city.1f2e3d4c5b6a.glb");
  expect(DefaultLoadingManager.resolveURL("/models/characters/dragon/scene.bin")).toBe(
    "/models/characters/dragon/scene.0a1b2c3d4e5f.bin",
  );
  expect(DefaultLoadingManager.resolveURL("blob:https://realms.invalid/0b4c")).toBe("blob:https://realms.invalid/0b4c");
});

it("keeps each model's own URL where no build named it, as in development", async () => {
  const { modelPath, modelUrl } = await import("./model-url");
  expect(modelPath("realms/city.glb")).toBe("/models/realms/city.glb");
  expect(modelPath("models/realms/city.glb")).toBe("/models/realms/city.glb");
  expect(modelUrl(modelPath("realms/city.glb"))).toBe("/models/realms/city.glb");
});

it("fetches a model manifest at its hashed build URL and retries once after a deployment updates /model-urls.json", async () => {
  vi.stubGlobal("__MODEL_URLS__", {
    "/models/terrain-flora/manifest.json": "/models/terrain-flora/manifest.oldhash12345.json",
  });
  const fetchSpy = vi.fn(async (input: string) => {
    if (input === "/models/terrain-flora/manifest.oldhash12345.json") {
      return new Response("Not found", { status: 404 });
    }
    if (input === "/model-urls.json") {
      return new Response(
        JSON.stringify({
          "/models/terrain-flora/manifest.json": "/models/terrain-flora/manifest.newhash67890.json",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (input === "/models/terrain-flora/manifest.newhash67890.json") {
      return new Response(JSON.stringify({ species: [] }), { status: 200 });
    }
    throw new Error(`Unexpected fetch: ${input}`);
  });
  vi.stubGlobal("fetch", fetchSpy);
  const { fetchModel, modelPath } = await import("./model-url");
  const response = await fetchModel(modelPath("terrain-flora/manifest.json"));
  expect(response.status).toBe(200);
  expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual([
    "/models/terrain-flora/manifest.oldhash12345.json",
    "/model-urls.json",
    "/models/terrain-flora/manifest.newhash67890.json",
  ]);
});
