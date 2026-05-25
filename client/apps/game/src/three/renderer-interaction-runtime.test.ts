// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const { controlsInstances, currentZoomSetting, subscribeMock, unsubscribeMock, zoomSubscriber } = vi.hoisted(() => ({
  controlsInstances: [] as MockMapControls[],
  currentZoomSetting: { value: true },
  subscribeMock: vi.fn(),
  unsubscribeMock: vi.fn(),
  zoomSubscriber: { current: undefined as ((enableMapZoom: boolean) => void) | undefined },
}));

class MockMapControls {
  public enableRotate = false;
  public enableZoom = false;
  public enablePan = false;
  public enableDamping = false;
  public zoomToCursor = false;
  public minDistance = 0;
  public maxDistance = 0;
  public dampingFactor = 0;
  public keyPanSpeed = 0;
  public keys = {};
  public readonly target = {
    set: vi.fn(),
  };
  public readonly addEventListener = vi.fn((eventName: string, callback: () => void) => {
    if (eventName === "change") {
      this.changeHandler = callback;
    }
  });
  public readonly listenToKeyEvents = vi.fn();
  public readonly stopListenToKeyEvents = vi.fn();
  public readonly dispose = vi.fn();
  private changeHandler?: () => void;

  constructor(
    public readonly camera: unknown,
    public readonly domElement: unknown,
  ) {
    controlsInstances.push(this);
  }

  fireChange(): void {
    this.changeHandler?.();
  }
}

vi.mock("@/three/constants", () => ({
  CAMERA_CONFIG: {
    defaultAngle: Math.PI / 6,
    defaultDistance: 24,
    fov: 70,
    near: 0.1,
  },
  CAMERA_FAR_PLANE: 2048,
  CONTROL_CONFIG: {
    dampingFactor: 0.15,
    enableDamping: true,
    enablePan: true,
    enableRotate: false,
    keyPanSpeed: 12,
    maxDistance: 64,
    minDistance: 4,
    panSpeed: 0.8,
    zoomToCursor: true,
  },
}));

vi.mock("@/ui/config", () => ({
  GraphicsSettings: {
    HIGH: "HIGH",
    LOW: "LOW",
    MID: "MID",
  },
}));

vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: {
    getState: () => ({
      enableMapZoom: currentZoomSetting.value,
    }),
    subscribe: subscribeMock,
  },
}));

vi.mock("three/examples/jsm/controls/MapControls.js", () => ({
  MapControls: MockMapControls,
}));

const { createRendererInteractionRuntime } = await import("./renderer-interaction-runtime");
const { GraphicsSettings } = await import("@/ui/config");
const { SceneName } = await import("./types");

describe("createRendererInteractionRuntime", () => {
  beforeEach(() => {
    controlsInstances.length = 0;
    currentZoomSetting.value = true;
    unsubscribeMock.mockReset();
    subscribeMock.mockReset();
    zoomSubscriber.current = undefined;
    subscribeMock.mockImplementation((_selector, listener) => {
      zoomSubscriber.current = listener;
      return unsubscribeMock;
    });
  });

  it("configures shared camera, picking primitives, and control change wiring", () => {
    const onControlsChange = vi.fn();
    const runtime = createRendererInteractionRuntime({
      graphicsSetting: GraphicsSettings.HIGH,
      onControlsChange,
      resolveCurrentSceneName: () => SceneName.FastTravel,
    });

    const surface = document.createElement("canvas");
    runtime.attachSurface(surface);
    const controls = controlsInstances[0];

    expect(runtime.controls).toBe(controls);
    expect(runtime.camera.position.y).toBeGreaterThan(0);
    expect(runtime.raycaster).toBeDefined();
    expect(runtime.pointer).toBeDefined();
    expect(controls?.enableRotate).toBe(false);
    expect(controls?.enableZoom).toBe(true);
    expect(controls?.enablePan).toBe(true);
    expect(controls?.enableDamping).toBe(true);
    expect(controls?.keyPanSpeed).toBe(12);
    expect(controls?.listenToKeyEvents).toHaveBeenCalledWith(document.body);

    controls?.fireChange();
    expect(onControlsChange).toHaveBeenCalledTimes(1);
  });

  it("preserves the current world map zoom lockout when the zoom preference changes", () => {
    let currentSceneName = SceneName.WorldMap;
    const runtime = createRendererInteractionRuntime({
      graphicsSetting: GraphicsSettings.MID,
      onControlsChange: vi.fn(),
      resolveCurrentSceneName: () => currentSceneName,
    });

    runtime.attachSurface(document.createElement("canvas"));
    const controls = controlsInstances[0];

    expect(controls?.enableZoom).toBe(true);

    zoomSubscriber.current?.(true);
    expect(controls?.enableZoom).toBe(false);

    currentSceneName = SceneName.Hexception;
    zoomSubscriber.current?.(true);
    expect(controls?.enableZoom).toBe(true);

    zoomSubscriber.current?.(false);
    expect(controls?.enableZoom).toBe(false);
    expect(controls?.enableDamping).toBe(false);
  });

  it("removes document listeners, unsubscribes zoom sync, and disposes controls once", () => {
    const addDocumentListenerSpy = vi.spyOn(document, "addEventListener");
    const removeDocumentListenerSpy = vi.spyOn(document, "removeEventListener");
    const runtime = createRendererInteractionRuntime({
      graphicsSetting: GraphicsSettings.HIGH,
      onControlsChange: vi.fn(),
      resolveCurrentSceneName: () => SceneName.FastTravel,
    });

    runtime.attachSurface(document.createElement("canvas"));
    const controls = controlsInstances[0];
    const input = document.createElement("input");
    const focusHandler = addDocumentListenerSpy.mock.calls.find((call) => call[0] === "focus")?.[1] as
      | ((event: FocusEvent) => void)
      | undefined;
    const blurHandler = addDocumentListenerSpy.mock.calls.find((call) => call[0] === "blur")?.[1] as
      | ((event: FocusEvent) => void)
      | undefined;

    focusHandler?.({ target: input } as unknown as FocusEvent);
    blurHandler?.({ target: input } as unknown as FocusEvent);

    expect(controls?.stopListenToKeyEvents).toHaveBeenCalledTimes(1);
    expect(controls?.listenToKeyEvents).toHaveBeenNthCalledWith(2, document.body);

    runtime.dispose();
    runtime.dispose();

    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    expect(controls?.dispose).toHaveBeenCalledTimes(1);
    expect(removeDocumentListenerSpy).toHaveBeenCalledWith("focus", focusHandler, true);
    expect(removeDocumentListenerSpy).toHaveBeenCalledWith("blur", blurHandler, true);
  });
});
