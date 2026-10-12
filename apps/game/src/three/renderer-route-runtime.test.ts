import { configManager } from "@bibliothecadao/eternum";
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SceneName } from "./types";

vi.stubGlobal(
  "fetch",
  vi.fn(async () => ({
    ok: true,
    json: async () => [],
  })),
);

vi.spyOn(configManager, "getMapCenter").mockReturnValue(2010831280);

const { createRendererRouteRuntime } = await import("./renderer-route-runtime");

describe("renderer route runtime", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/g/0xa1/3/map");
  });

  it("registers and removes URL listeners through the runtime lifecycle", () => {
    const addListenerSpy = vi.spyOn(window, "addEventListener");
    const removeListenerSpy = vi.spyOn(window, "removeEventListener");
    const runtime = createRendererRouteRuntime({
      fadeIn: vi.fn(),
      getCurrentScene: () => SceneName.WorldMap,
      markLabelsDirty: vi.fn(),
      moveCameraForScene: vi.fn(),
      switchScene: vi.fn(),
    });

    runtime.start();
    runtime.dispose();

    expect(addListenerSpy).toHaveBeenCalledWith("urlChanged", expect.any(Function));
    expect(addListenerSpy).toHaveBeenCalledWith("popstate", expect.any(Function));
    expect(removeListenerSpy).toHaveBeenCalledWith("urlChanged", expect.any(Function));
    expect(removeListenerSpy).toHaveBeenCalledWith("popstate", expect.any(Function));
  });

  it("moves the active map camera instead of switching scenes when the route stays on map", () => {
    const moveCameraForScene = vi.fn();
    const switchScene = vi.fn();
    const fadeIn = vi.fn();
    const markLabelsDirty = vi.fn();
    const runtime = createRendererRouteRuntime({
      fadeIn,
      getCurrentScene: () => SceneName.WorldMap,
      markLabelsDirty,
      moveCameraForScene,
      switchScene,
    });

    runtime.syncFromLocation("https://example.com/g/0xa1/3/map?col=1&row=2");

    expect(moveCameraForScene).toHaveBeenCalledTimes(1);
    expect(fadeIn).toHaveBeenCalledTimes(1);
    expect(switchScene).not.toHaveBeenCalled();
    expect(markLabelsDirty).toHaveBeenCalledTimes(1);
  });

  it("switches scenes when the requested route differs from the active scene", () => {
    const switchScene = vi.fn();
    const runtime = createRendererRouteRuntime({
      fadeIn: vi.fn(),
      getCurrentScene: () => SceneName.WorldMap,
      markLabelsDirty: vi.fn(),
      moveCameraForScene: vi.fn(),
      switchScene,
    });

    runtime.syncFromLocation("https://example.com/g/0xa1/3/hex?col=1&row=2");

    expect(switchScene).toHaveBeenCalledWith(SceneName.Hexception);
  });

  it("switches Hexception again when a canonical hex route changes target coordinates", () => {
    const switchScene = vi.fn();
    const runtime = createRendererRouteRuntime({
      fadeIn: vi.fn(),
      getCurrentScene: () => SceneName.Hexception,
      markLabelsDirty: vi.fn(),
      moveCameraForScene: vi.fn(),
      switchScene,
    });

    runtime.syncFromLocation("https://example.com/g/0xa1/3/hex?col=6&row=8");

    expect(switchScene).toHaveBeenCalledWith(SceneName.Hexception);
  });

  it("leaves the camera alone on a history step between entries of one address, as a sheet's close makes", () => {
    const moveCameraForScene = vi.fn();
    const runtime = createRendererRouteRuntime({
      fadeIn: vi.fn(),
      getCurrentScene: () => SceneName.WorldMap,
      markLabelsDirty: vi.fn(),
      moveCameraForScene,
      switchScene: vi.fn(),
    });
    runtime.start();
    runtime.syncFromLocation();
    expect(moveCameraForScene).toHaveBeenCalledTimes(1);

    window.history.pushState({ kitSheets: ["sheet"] }, "");
    window.history.replaceState({}, "");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(moveCameraForScene).toHaveBeenCalledTimes(1);

    window.history.replaceState({}, "", "/g/0xa1/3/map?col=4&row=5");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(moveCameraForScene).toHaveBeenCalledTimes(2);
    runtime.dispose();
  });
});
