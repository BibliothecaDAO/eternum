import { GraphicsSettings } from "@/ui/config";
import { resizeRendererBackend } from "./renderer-backend-compat";
import type { RendererSurfaceLike } from "./renderer-backend";
import type { RendererBackendV2 } from "./renderer-backend-v2";
import type { RendererLabelRuntime } from "./renderer-label-runtime";

interface RendererDisplayPolicyInput {
  graphicsSetting: GraphicsSettings;
  isMobileDevice: boolean;
}

interface ResizeRendererDisplayInput {
  backend: RendererBackendV2 & { renderer: RendererSurfaceLike; dispose?: () => void };
  camera: {
    aspect: number;
    updateProjectionMatrix(): void;
  };
  getContainer: () => { clientHeight: number; clientWidth: number } | null;
  hudScene: {
    onWindowResize(width: number, height: number): void;
  };
  labelRuntime?: RendererLabelRuntime;
  markLabelsDirty(): void;
  windowHeight: number;
  windowWidth: number;
}

const MAX_RENDERER_PIXEL_RATIO = 1.5;

export function resolveRendererTargetPixelRatio(
  input: RendererDisplayPolicyInput & { devicePixelRatio: number },
): number {
  const devicePixelRatio = Math.max(input.devicePixelRatio || 1, 1);
  const pixelRatioCap = resolveRendererPixelRatioCap(input);

  switch (input.graphicsSetting) {
    case GraphicsSettings.HIGH:
      return Math.min(devicePixelRatio, 1.5, pixelRatioCap);
    case GraphicsSettings.MID:
      return Math.min(devicePixelRatio, 1.25, pixelRatioCap);
    case GraphicsSettings.ULTRA_LOW:
      return Math.min(0.55, pixelRatioCap);
    case GraphicsSettings.LOW:
      return Math.min(0.9, pixelRatioCap);
    default:
      return Math.min(1, pixelRatioCap);
  }
}

export function resolveRendererTargetFps(input: RendererDisplayPolicyInput): number | null {
  if (input.isMobileDevice) {
    switch (input.graphicsSetting) {
      case GraphicsSettings.HIGH:
        return 45;
      case GraphicsSettings.MID:
        return 30;
      case GraphicsSettings.ULTRA_LOW:
        return 20;
      case GraphicsSettings.LOW:
        return 24;
      default:
        return 30;
    }
  }

  switch (input.graphicsSetting) {
    case GraphicsSettings.LOW:
      return 24;
    case GraphicsSettings.ULTRA_LOW:
      return 20;
    case GraphicsSettings.MID:
      return 30;
    default:
      return 45;
  }
}

export function resolveRendererPixelRatioCap(input: RendererDisplayPolicyInput): number {
  if (!input.isMobileDevice) {
    return MAX_RENDERER_PIXEL_RATIO;
  }

  switch (input.graphicsSetting) {
    case GraphicsSettings.HIGH:
      return 1.25;
    case GraphicsSettings.MID:
      return 1;
    default:
      return 1;
  }
}

export function resizeRendererDisplay(input: ResizeRendererDisplayInput): void {
  input.markLabelsDirty();

  const size = resolveRendererDisplaySize({
    container: input.getContainer(),
    windowHeight: input.windowHeight,
    windowWidth: input.windowWidth,
  });

  input.camera.aspect = size.width / size.height;
  input.camera.updateProjectionMatrix();
  resizeRendererBackend(input.backend, size.width, size.height);
  input.labelRuntime?.resize(size.width, size.height);
  input.hudScene.onWindowResize(size.width, size.height);
}

function resolveRendererDisplaySize(input: {
  container: { clientHeight: number; clientWidth: number } | null;
  windowHeight: number;
  windowWidth: number;
}): {
  height: number;
  width: number;
} {
  if (input.container) {
    return {
      height: input.container.clientHeight,
      width: input.container.clientWidth,
    };
  }

  return {
    height: input.windowHeight,
    width: input.windowWidth,
  };
}
