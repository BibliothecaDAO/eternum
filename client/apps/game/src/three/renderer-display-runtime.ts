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

export function resolveRendererTargetPixelRatio(
  input: RendererDisplayPolicyInput & { devicePixelRatio: number },
): number {
  const devicePixelRatio = Math.max(input.devicePixelRatio || 1, 1);
  const mobileCap = resolveRendererPixelRatioCap(input);

  switch (input.graphicsSetting) {
    case GraphicsSettings.HIGH:
      return Math.min(devicePixelRatio, 2, mobileCap);
    case GraphicsSettings.MID:
      return Math.min(devicePixelRatio, 1.5, mobileCap);
    default:
      return Math.min(1, mobileCap);
  }
}

export function resolveRendererTargetFps(input: RendererDisplayPolicyInput): number | null {
  if (input.isMobileDevice) {
    switch (input.graphicsSetting) {
      case GraphicsSettings.HIGH:
        return 45;
      case GraphicsSettings.MID:
        return 30;
      default:
        return 30;
    }
  }

  switch (input.graphicsSetting) {
    case GraphicsSettings.LOW:
      return 30;
    case GraphicsSettings.MID:
      return 45;
    default:
      return null;
  }
}

export function resolveRendererPixelRatioCap(input: RendererDisplayPolicyInput): number {
  if (!input.isMobileDevice) {
    return Number.POSITIVE_INFINITY;
  }

  switch (input.graphicsSetting) {
    case GraphicsSettings.HIGH:
      return 1.5;
    case GraphicsSettings.MID:
      return 1.25;
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
