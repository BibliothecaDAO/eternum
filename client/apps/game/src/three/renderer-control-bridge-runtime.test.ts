import { SceneName } from "./types";
import { describe, expect, it, vi } from "vitest";

const getContactShadowResources = vi.fn();
const setupRendererDevGui = vi.fn();

vi.mock("./utils/contact-shadow", () => ({
  getContactShadowResources,
}));

vi.mock("./renderer-dev-gui-runtime", () => ({
  setupRendererDevGui,
}));

const { createRendererControlBridgeRuntime } = await import("./renderer-control-bridge-runtime");

describe("renderer control bridge runtime", () => {
  it("marks labels dirty on every interaction change and refreshes fast travel only for that scene", () => {
    const markLabelsDirty = vi.fn();
    const requestFastTravelSceneRefresh = vi.fn();
    const runtime = createRendererControlBridgeRuntime({
      changeCameraView: vi.fn(),
      createFolder: vi.fn(),
      fastTravelEnabled: () => true,
      getCurrentScene: () => SceneName.FastTravel,
      getRenderer: () => undefined,
      markLabelsDirty,
      moveCameraToColRow: vi.fn(),
      moveCameraToXYZ: vi.fn(),
      requestFastTravelSceneRefresh,
      switchScene: vi.fn(),
      updateContactShadowOpacity: vi.fn(),
    });

    runtime.handleInteractionChange();

    expect(markLabelsDirty).toHaveBeenCalledTimes(1);
    expect(requestFastTravelSceneRefresh).toHaveBeenCalledTimes(1);
  });

  it("does not request a fast-travel refresh outside the fast-travel scene", () => {
    const markLabelsDirty = vi.fn();
    const requestFastTravelSceneRefresh = vi.fn();
    const runtime = createRendererControlBridgeRuntime({
      changeCameraView: vi.fn(),
      createFolder: vi.fn(),
      fastTravelEnabled: () => true,
      getCurrentScene: () => SceneName.WorldMap,
      getRenderer: () => undefined,
      markLabelsDirty,
      moveCameraToColRow: vi.fn(),
      moveCameraToXYZ: vi.fn(),
      requestFastTravelSceneRefresh,
      switchScene: vi.fn(),
      updateContactShadowOpacity: vi.fn(),
    });

    runtime.handleInteractionChange();

    expect(markLabelsDirty).toHaveBeenCalledTimes(1);
    expect(requestFastTravelSceneRefresh).not.toHaveBeenCalled();
  });

  it("forwards the current control and contact-shadow state into the dev gui runtime", () => {
    const material = { opacity: 0.24 };
    getContactShadowResources.mockReturnValue({ material });
    const createFolder = vi.fn();
    const changeCameraView = vi.fn();
    const moveCameraToColRow = vi.fn();
    const moveCameraToXYZ = vi.fn();
    const switchScene = vi.fn();
    const renderer = { toneMapping: 1, toneMappingExposure: 0.8 };
    const runtime = createRendererControlBridgeRuntime({
      changeCameraView,
      createFolder,
      fastTravelEnabled: () => false,
      getCurrentScene: () => SceneName.WorldMap,
      getRenderer: () => renderer as never,
      markLabelsDirty: vi.fn(),
      moveCameraToColRow,
      moveCameraToXYZ,
      requestFastTravelSceneRefresh: vi.fn(),
      switchScene,
      updateContactShadowOpacity: (opacity) => {
        material.opacity = opacity;
      },
    });

    runtime.setupGuiControls();

    expect(setupRendererDevGui).toHaveBeenCalledWith({
      changeCameraView,
      contactShadowOpacity: 0.24,
      createFolder,
      fastTravelEnabled: false,
      moveCameraToColRow,
      moveCameraToXYZ,
      renderer,
      switchScene,
      updateContactShadowOpacity: expect.any(Function),
    });

    const updateOpacity = setupRendererDevGui.mock.calls[0][0].updateContactShadowOpacity as (opacity: number) => void;
    updateOpacity(0.42);
    expect(material.opacity).toBe(0.42);
  });
});
