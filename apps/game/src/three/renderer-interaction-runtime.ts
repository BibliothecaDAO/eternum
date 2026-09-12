import { CAMERA_CONFIG, CAMERA_FAR_PLANE, CONTROL_CONFIG } from "@/three/constants";
import { PerspectiveCamera, Raycaster, Vector2 } from "three";
import { MapControls } from "three/addons/controls/MapControls.js";

export interface RendererInteractionRuntime {
  camera: PerspectiveCamera;
  controls?: MapControls;
  pointer: Vector2;
  raycaster: Raycaster;
  attachSurface(surface: HTMLElement): void;
  dispose(): void;
}

interface CreateRendererInteractionRuntimeInput {
  onControlsChange: () => void;
}

export function createRendererInteractionRuntime(
  input: CreateRendererInteractionRuntimeInput,
): RendererInteractionRuntime {
  return new GameRendererInteractionRuntime(input);
}

class GameRendererInteractionRuntime implements RendererInteractionRuntime {
  public readonly camera = createRendererCamera();
  public readonly raycaster = new Raycaster();
  public readonly pointer = new Vector2();
  public controls?: MapControls;
  private hasDocumentKeyboardLifecycle = false;
  private surface?: HTMLElement;
  // Active scene input handles touches in capture phase. Unowned touches must never enter MapControls.
  private readonly blockNativeTouchNavigation = (event: PointerEvent) => {
    if (event.pointerType !== "touch") return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  private readonly handleDocumentFocus = (event: FocusEvent) => {
    if (event.target instanceof HTMLInputElement && this.controls) {
      this.controls.stopListenToKeyEvents();
    }
  };

  private readonly handleDocumentBlur = (event: FocusEvent) => {
    if (event.target instanceof HTMLInputElement && this.controls) {
      this.controls.listenToKeyEvents(document.body);
    }
  };

  constructor(private readonly input: CreateRendererInteractionRuntimeInput) {}

  public attachSurface(surface: HTMLElement): void {
    this.disposeControls();
    this.surface = surface;
    surface.addEventListener("pointerdown", this.blockNativeTouchNavigation, { passive: false });
    this.controls = createConfiguredMapControls({
      camera: this.camera,
      onControlsChange: this.input.onControlsChange,
      surface,
    });
    this.registerDocumentKeyboardLifecycle();
  }

  public dispose(): void {
    this.disposeControls();
  }

  private disposeControls(): void {
    this.surface?.removeEventListener("pointerdown", this.blockNativeTouchNavigation);
    this.surface = undefined;
    if (this.hasDocumentKeyboardLifecycle) {
      document.removeEventListener("focus", this.handleDocumentFocus, true);
      document.removeEventListener("blur", this.handleDocumentBlur, true);
      this.hasDocumentKeyboardLifecycle = false;
    }

    this.controls?.dispose();
    this.controls = undefined;
  }

  private registerDocumentKeyboardLifecycle(): void {
    if (this.hasDocumentKeyboardLifecycle) {
      return;
    }

    document.addEventListener("focus", this.handleDocumentFocus, true);
    document.addEventListener("blur", this.handleDocumentBlur, true);
    this.hasDocumentKeyboardLifecycle = true;
  }
}

function createRendererCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(
    CAMERA_CONFIG.fov,
    window.innerWidth / window.innerHeight,
    CAMERA_CONFIG.near,
    CAMERA_FAR_PLANE,
  );
  const cameraHeight = Math.sin(CAMERA_CONFIG.defaultAngle) * CAMERA_CONFIG.defaultDistance;
  const cameraDepth = Math.cos(CAMERA_CONFIG.defaultAngle) * CAMERA_CONFIG.defaultDistance;

  camera.position.set(0, cameraHeight, cameraDepth);
  camera.lookAt(0, 0, 0);
  camera.up.set(0, 1, 0);

  return camera;
}

function createConfiguredMapControls(input: {
  camera: PerspectiveCamera;
  onControlsChange: () => void;
  surface: HTMLElement;
}): MapControls {
  const controls = new MapControls(input.camera, input.surface);

  controls.enableRotate = CONTROL_CONFIG.enableRotate;
  controls.enableZoom = true;
  controls.enablePan = CONTROL_CONFIG.enablePan;
  controls.panSpeed = CONTROL_CONFIG.panSpeed;
  controls.zoomToCursor = CONTROL_CONFIG.zoomToCursor;
  controls.minDistance = CONTROL_CONFIG.minDistance;
  controls.maxDistance = CONTROL_CONFIG.maxDistance;
  controls.enableDamping = CONTROL_CONFIG.enableDamping;
  controls.dampingFactor = CONTROL_CONFIG.dampingFactor;
  controls.target.set(0, 0, 0);
  controls.addEventListener("change", input.onControlsChange);
  controls.keys = {
    LEFT: "KeyA",
    UP: "KeyW",
    RIGHT: "KeyD",
    BOTTOM: "KeyS",
  };
  controls.keyPanSpeed = CONTROL_CONFIG.keyPanSpeed;
  controls.listenToKeyEvents(document.body);

  return controls;
}
