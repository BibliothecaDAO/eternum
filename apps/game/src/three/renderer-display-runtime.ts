import type { RendererSurfaceLike } from "./renderer-backend";
import type { RendererBackend } from "./renderer-backend";
import type { RendererLabelRuntime } from "./renderer-label-runtime";

interface ResizeRendererDisplayInput {
  backend: RendererBackend & { renderer: RendererSurfaceLike };
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

export function resolveRendererTargetPixelRatio(input: { devicePixelRatio: number; cap: number }): number {
  return Math.min(input.devicePixelRatio || 1, input.cap);
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
  input.backend.resize(size.width, size.height);
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
