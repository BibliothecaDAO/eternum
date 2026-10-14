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
const { SCENE_ADDRESS_EVENT } = await import("@/scene-address");

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
      ownPage: vi.fn(),
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
      ownPage: vi.fn(),
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
      ownPage: vi.fn(),
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
      ownPage: vi.fn(),
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
      ownPage: vi.fn(),
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

  it("gives the page back on any address outside a match and takes it again on the way back in", () => {
    const ownPage = vi.fn();
    const switchScene = vi.fn();
    const moveCameraForScene = vi.fn();
    const runtime = createRendererRouteRuntime({
      fadeIn: vi.fn(),
      getCurrentScene: () => SceneName.WorldMap,
      markLabelsDirty: vi.fn(),
      moveCameraForScene,
      ownPage,
      switchScene,
    });
    runtime.start();
    runtime.syncFromLocation();
    expect(ownPage.mock.calls).toEqual([[true]]);

    // The app's own navigation moves history with no event of the browser's: the scene's frame announces it.
    for (const outside of [
      "/learn",
      "/",
      "/blitz/slot-blitz-1",
      "/season",
      "/scroll",
      "/profile",
      "/sign-in",
      "/terms",
    ]) {
      ownPage.mockClear();
      moveCameraForScene.mockClear();
      window.history.pushState({}, "", outside);
      window.dispatchEvent(new Event(SCENE_ADDRESS_EVENT));
      expect(ownPage.mock.calls, outside).toEqual([[false]]);
      // Outside a match nothing of the scene moves.
      expect(moveCameraForScene).not.toHaveBeenCalled();
      expect(switchScene).not.toHaveBeenCalled();

      // The doorway's own address is not a scene yet: the page stays the app's.
      window.history.pushState({}, "", "/g/0xa1/3");
      window.dispatchEvent(new Event(SCENE_ADDRESS_EVENT));
      expect(ownPage.mock.calls, outside).toEqual([[false]]);

      window.history.replaceState({}, "", "/g/0xa1/3/map");
      window.dispatchEvent(new Event(SCENE_ADDRESS_EVENT));
      expect(ownPage.mock.calls, outside).toEqual([[false], [true]]);
      expect(moveCameraForScene).toHaveBeenCalledTimes(1);
    }
    runtime.dispose();
  });

  it("gives the page back when the browser's back button leaves the match", () => {
    const ownPage = vi.fn();
    const runtime = createRendererRouteRuntime({
      fadeIn: vi.fn(),
      getCurrentScene: () => SceneName.WorldMap,
      markLabelsDirty: vi.fn(),
      moveCameraForScene: vi.fn(),
      ownPage,
      switchScene: vi.fn(),
    });
    runtime.start();
    runtime.syncFromLocation();
    window.history.replaceState({}, "", "/learn");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(ownPage.mock.calls).toEqual([[true], [false]]);
    runtime.dispose();
  });

  it("keeps the page while an address changes inside the match", () => {
    const ownPage = vi.fn();
    const moveCameraForScene = vi.fn();
    const runtime = createRendererRouteRuntime({
      fadeIn: vi.fn(),
      getCurrentScene: () => SceneName.WorldMap,
      markLabelsDirty: vi.fn(),
      moveCameraForScene,
      ownPage,
      switchScene: vi.fn(),
    });
    runtime.start();
    runtime.syncFromLocation();
    // The frame announces the address it already shows: the scene's own route event answers moves inside a match.
    window.dispatchEvent(new Event(SCENE_ADDRESS_EVENT));
    expect(ownPage.mock.calls).toEqual([[true]]);
    expect(moveCameraForScene).toHaveBeenCalledTimes(1);
    runtime.dispose();
  });
});
