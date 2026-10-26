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
  const { modelUrl } = await import("./model-url");
  expect(modelUrl("/models/realms/city.glb")).toBe("/models/realms/city.glb");
});
