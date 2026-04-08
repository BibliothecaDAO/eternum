// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SceneName } from "./types";

const { createRendererRouteRuntime } = await import("./renderer-route-runtime");

describe("renderer route runtime", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/play/map");
  });

  it("registers and removes URL listeners through the runtime lifecycle", () => {
    const addListenerSpy = vi.spyOn(window, "addEventListener");
    const removeListenerSpy = vi.spyOn(window, "removeEventListener");
    const runtime = createRendererRouteRuntime({
      fadeIn: vi.fn(),
      fastTravelEnabled: () => true,
      getCurrentScene: () => SceneName.WorldMap,
      hasFastTravelScene: () => true,
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
      fastTravelEnabled: () => true,
      getCurrentScene: () => SceneName.WorldMap,
      hasFastTravelScene: () => true,
      markLabelsDirty,
      moveCameraForScene,
      switchScene,
    });

    runtime.syncFromLocation("https://example.com/play/map?col=1&row=2");

    expect(moveCameraForScene).toHaveBeenCalledTimes(1);
    expect(fadeIn).toHaveBeenCalledTimes(1);
    expect(switchScene).not.toHaveBeenCalled();
    expect(markLabelsDirty).toHaveBeenCalledTimes(1);
  });

  it("moves the active fast-travel camera instead of switching when the travel route is already active", () => {
    const moveCameraForScene = vi.fn();
    const switchScene = vi.fn();
    const fadeIn = vi.fn();
    const runtime = createRendererRouteRuntime({
      fadeIn,
      fastTravelEnabled: () => true,
      getCurrentScene: () => SceneName.FastTravel,
      hasFastTravelScene: () => true,
      markLabelsDirty: vi.fn(),
      moveCameraForScene,
      switchScene,
    });

    runtime.syncFromLocation("https://example.com/play/travel?col=1&row=2");

    expect(moveCameraForScene).toHaveBeenCalledTimes(1);
    expect(fadeIn).toHaveBeenCalledTimes(1);
    expect(switchScene).not.toHaveBeenCalled();
  });

  it("switches scenes when the requested route differs from the active scene", () => {
    const switchScene = vi.fn();
    const runtime = createRendererRouteRuntime({
      fadeIn: vi.fn(),
      fastTravelEnabled: () => true,
      getCurrentScene: () => SceneName.WorldMap,
      hasFastTravelScene: () => true,
      markLabelsDirty: vi.fn(),
      moveCameraForScene: vi.fn(),
      switchScene,
    });

    runtime.syncFromLocation("https://example.com/play/hex?col=1&row=2");

    expect(switchScene).toHaveBeenCalledWith(SceneName.Hexception);
  });

  it("falls back to world map when fast travel is disabled", () => {
    const switchScene = vi.fn();
    const runtime = createRendererRouteRuntime({
      fadeIn: vi.fn(),
      fastTravelEnabled: () => false,
      getCurrentScene: () => SceneName.Hexception,
      hasFastTravelScene: () => false,
      markLabelsDirty: vi.fn(),
      moveCameraForScene: vi.fn(),
      switchScene,
    });

    runtime.syncFromLocation("https://example.com/play/travel?col=1&row=2");

    expect(switchScene).toHaveBeenCalledWith(SceneName.WorldMap);
  });
});
