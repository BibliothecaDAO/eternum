// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { initializeProceduralCharacterRendererRuntime } from "./procedural-character-renderer-runtime";

const runtimeMocks = vi.hoisted(() => ({
  createUnitRuntime: vi.fn(),
  initializeRenderer: vi.fn(),
}));

vi.mock("../../../env", () => ({
  env: { VITE_PUBLIC_RENDERER_BUILD_MODE: "webgpu-auto" },
}));

vi.mock("@/three/renderer-backend-runtime", () => ({
  initializeRendererBackendRuntime: runtimeMocks.initializeRenderer,
}));

vi.mock("./procedural-unit-runtime", () => ({
  ProceduralUnitRuntime: { create: runtimeMocks.createUnitRuntime },
}));

describe("procedural character renderer initialization", () => {
  beforeEach(() => {
    runtimeMocks.createUnitRuntime.mockReset();
    runtimeMocks.initializeRenderer.mockReset();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        devicePixelRatio: 2,
        location: { search: "?rendererMode=webgpu-auto" },
        matchMedia: vi.fn(() => ({ matches: false })),
      },
    });
  });

  it("returns both initialized owners with the requested pixel and physics policy", async () => {
    const backend = { dispose: vi.fn() };
    const unitRuntime = { dispose: vi.fn() };
    runtimeMocks.initializeRenderer.mockResolvedValue({ backend, renderer: {} });
    runtimeMocks.createUnitRuntime.mockResolvedValue(unitRuntime);

    await expect(
      initializeProceduralCharacterRendererRuntime({ pixelRatioCap: 1.5, preloadPhysics: true }),
    ).resolves.toEqual({
      unitRuntime,
      rendererRuntime: { backend, renderer: {} },
    });
    expect(runtimeMocks.initializeRenderer).toHaveBeenCalledWith(
      expect.objectContaining({ pixelRatio: 1.5, search: "?rendererMode=webgpu-auto" }),
    );
    expect(runtimeMocks.createUnitRuntime).toHaveBeenCalledWith({ preloadPhysics: true });
  });

  it("disposes a loaded character runtime when renderer initialization fails", async () => {
    const unitRuntime = { dispose: vi.fn() };
    runtimeMocks.initializeRenderer.mockRejectedValue(new Error("renderer failed"));
    runtimeMocks.createUnitRuntime.mockResolvedValue(unitRuntime);

    await expect(
      initializeProceduralCharacterRendererRuntime({ pixelRatioCap: 2, preloadPhysics: false }),
    ).rejects.toThrow("renderer failed");
    expect(unitRuntime.dispose).toHaveBeenCalledOnce();
  });

  it("disposes an initialized renderer when character loading fails", async () => {
    const backend = { dispose: vi.fn() };
    runtimeMocks.initializeRenderer.mockResolvedValue({ backend, renderer: {} });
    runtimeMocks.createUnitRuntime.mockRejectedValue(new Error("characters failed"));

    await expect(
      initializeProceduralCharacterRendererRuntime({ pixelRatioCap: 2, preloadPhysics: true }),
    ).rejects.toThrow("characters failed");
    expect(backend.dispose).toHaveBeenCalledOnce();
  });
});
