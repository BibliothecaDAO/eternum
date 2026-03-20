import type { RendererBackendV2, RendererFramePipeline, RendererPostProcessController, RendererPostProcessPlan } from "./renderer-backend-v2";
import type { RendererEnvironmentTargets, RendererSurfaceLike } from "./renderer-backend";
import { renderRendererOverlayPasses } from "./renderer-overlay-passes";

type CompatibleRendererBackend = RendererBackendV2 & {
  dispose?: () => void;
  renderer: RendererSurfaceLike;
};

const NOOP_POST_PROCESS_CONTROLLER: RendererPostProcessController = {
  setColorGrade: () => {},
  setVignette: () => {},
};

export async function applyRendererBackendEnvironment(
  backend: CompatibleRendererBackend,
  targets: RendererEnvironmentTargets,
): Promise<void> {
  await backend.applyEnvironment?.(targets);
}

export function applyRendererBackendPostProcessPlan(
  backend: CompatibleRendererBackend,
  plan: RendererPostProcessPlan,
): RendererPostProcessController {
  return backend.applyPostProcessPlan?.(plan) ?? NOOP_POST_PROCESS_CONTROLLER;
}

export function applyRendererBackendQuality(
  backend: CompatibleRendererBackend,
  input: { pixelRatio: number; shadows: boolean; width: number; height: number },
): void {
  if (backend.applyQuality) {
    backend.applyQuality(input);
    return;
  }

  backend.renderer.setPixelRatio(input.pixelRatio);
  backend.renderer.shadowMap.enabled = input.shadows;
  backend.renderer.setSize(input.width, input.height);
}

export function resizeRendererBackend(backend: CompatibleRendererBackend, width: number, height: number): void {
  if (backend.resize) {
    backend.resize(width, height);
    return;
  }

  backend.renderer.setSize(width, height);
}

export function renderRendererBackendFrame(
  backend: CompatibleRendererBackend,
  pipeline: RendererFramePipeline,
): void {
  if (backend.renderFrame) {
    backend.renderFrame(pipeline);
    return;
  }

  backend.renderer.info.reset();
  backend.renderer.clear();
  backend.renderer.render(pipeline.mainScene, pipeline.mainCamera);
  renderRendererOverlayPasses(backend.renderer, pipeline);
}

export function disposeRendererBackend(backend: CompatibleRendererBackend): void {
  if (backend.dispose) {
    backend.dispose();
    return;
  }

  backend.renderer.dispose();
}
