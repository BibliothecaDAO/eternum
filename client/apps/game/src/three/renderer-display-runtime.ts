import { resizeRendererBackend } from "./renderer-backend-compat";
import type { RendererSurfaceLike } from "./renderer-backend";
import type { RendererBackendV2 } from "./renderer-backend-v2";
import type { RendererLabelRuntime } from "./renderer-label-runtime";
import { RENDERER_PIXEL_RATIO_CAP } from "./render-profile";

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

export function resolveRendererTargetPixelRatio(input: { devicePixelRatio: number }): number {
  const devicePixelRatio = Math.max(input.devicePixelRatio || 1, 1);
  return Math.min(devicePixelRatio, resolveRendererPixelRatioCap());
}

export function resolveRendererPixelRatioCap(): number {
  return RENDERER_PIXEL_RATIO_CAP;
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
