// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const GraphicsSettings = {
  HIGH: "HIGH",
  LOW: "LOW",
  MID: "MID",
} as const;

const resizeRendererBackend = vi.fn();

vi.mock("@/ui/config", () => ({
  GraphicsSettings,
}));

vi.mock("./renderer-backend-compat", () => ({
  resizeRendererBackend,
}));

const {
  resolveRendererPixelRatioCap,
  resolveRendererTargetFps,
  resolveRendererTargetPixelRatio,
  resizeRendererDisplay,
} = await import("./renderer-display-runtime");

describe("renderer display runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves target pixel ratio with the mobile cap policy", () => {
    expect(
      resolveRendererTargetPixelRatio({
        devicePixelRatio: 3,
        graphicsSetting: GraphicsSettings.HIGH,
        isMobileDevice: true,
      }),
    ).toBe(1.5);

    expect(
      resolveRendererTargetPixelRatio({
        devicePixelRatio: 1.2,
        graphicsSetting: GraphicsSettings.MID,
        isMobileDevice: false,
      }),
    ).toBe(1.2);
  });

  it("resolves frame caps for desktop and mobile graphics settings", () => {
    expect(
      resolveRendererTargetFps({
        graphicsSetting: GraphicsSettings.HIGH,
        isMobileDevice: false,
      }),
    ).toBeNull();
    expect(
      resolveRendererTargetFps({
        graphicsSetting: GraphicsSettings.MID,
        isMobileDevice: false,
      }),
    ).toBe(45);
    expect(
      resolveRendererTargetFps({
        graphicsSetting: GraphicsSettings.HIGH,
        isMobileDevice: true,
      }),
    ).toBe(45);
    expect(
      resolveRendererTargetFps({
        graphicsSetting: GraphicsSettings.LOW,
        isMobileDevice: true,
      }),
    ).toBe(30);
  });

  it("exposes the pixel-ratio cap for runtime quality application", () => {
    expect(
      resolveRendererPixelRatioCap({
        graphicsSetting: GraphicsSettings.MID,
        isMobileDevice: true,
      }),
    ).toBe(1.25);
    expect(
      resolveRendererPixelRatioCap({
        graphicsSetting: GraphicsSettings.LOW,
        isMobileDevice: false,
      }),
    ).toBe(Number.POSITIVE_INFINITY);
  });

  it("resizes using the renderer container when available", () => {
    const camera = { aspect: 0, updateProjectionMatrix: vi.fn() };
    const labelRuntime = { resize: vi.fn() };
    const hudScene = { onWindowResize: vi.fn() };
    const markLabelsDirty = vi.fn();
    const container = {
      clientHeight: 200,
      clientWidth: 320,
    };

    resizeRendererDisplay({
      backend: {} as never,
      camera: camera as never,
      getContainer: () => container as never,
      hudScene: hudScene as never,
      labelRuntime: labelRuntime as never,
      markLabelsDirty,
      windowHeight: 720,
      windowWidth: 1280,
    });

    expect(markLabelsDirty).toHaveBeenCalledTimes(1);
    expect(camera.aspect).toBe(1.6);
    expect(camera.updateProjectionMatrix).toHaveBeenCalledTimes(1);
    expect(resizeRendererBackend).toHaveBeenCalledWith({}, 320, 200);
    expect(labelRuntime.resize).toHaveBeenCalledWith(320, 200);
    expect(hudScene.onWindowResize).toHaveBeenCalledWith(320, 200);
  });

  it("falls back to the window size when the renderer container is missing", () => {
    const camera = { aspect: 0, updateProjectionMatrix: vi.fn() };
    const hudScene = { onWindowResize: vi.fn() };

    resizeRendererDisplay({
      backend: {} as never,
      camera: camera as never,
      getContainer: () => null,
      hudScene: hudScene as never,
      markLabelsDirty: vi.fn(),
      windowHeight: 900,
      windowWidth: 1600,
    });

    expect(camera.aspect).toBe(1600 / 900);
    expect(resizeRendererBackend).toHaveBeenCalledWith({}, 1600, 900);
    expect(hudScene.onWindowResize).toHaveBeenCalledWith(1600, 900);
  });
});
