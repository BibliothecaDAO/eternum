// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const resizeRendererBackend = vi.fn();
vi.mock("./renderer-backend-compat", () => ({ resizeRendererBackend }));

const { resolveRendererPixelRatioCap, resolveRendererTargetPixelRatio, resizeRendererDisplay } =
  await import("./renderer-display-runtime");

describe("renderer display runtime", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps a single visual pixel-ratio policy", () => {
    expect(resolveRendererTargetPixelRatio({ devicePixelRatio: 3 })).toBe(1.25);
    expect(resolveRendererTargetPixelRatio({ devicePixelRatio: 1 })).toBe(1);
    expect(resolveRendererPixelRatioCap()).toBe(1.25);
  });

  it("resizes using the renderer container when available", () => {
    const camera = { aspect: 0, updateProjectionMatrix: vi.fn() };
    const labelRuntime = { resize: vi.fn() };
    const hudScene = { onWindowResize: vi.fn() };
    const markLabelsDirty = vi.fn();

    resizeRendererDisplay({
      backend: {} as never,
      camera,
      getContainer: () => ({ clientHeight: 200, clientWidth: 320 }),
      hudScene,
      labelRuntime: labelRuntime as never,
      markLabelsDirty,
      windowHeight: 720,
      windowWidth: 1280,
    });

    expect(camera.aspect).toBe(1.6);
    expect(camera.updateProjectionMatrix).toHaveBeenCalledTimes(1);
    expect(resizeRendererBackend).toHaveBeenCalledWith({}, 320, 200);
    expect(labelRuntime.resize).toHaveBeenCalledWith(320, 200);
    expect(hudScene.onWindowResize).toHaveBeenCalledWith(320, 200);
    expect(markLabelsDirty).toHaveBeenCalledTimes(1);
  });
});
