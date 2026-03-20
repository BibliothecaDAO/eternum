import type { Camera, Object3D } from "three";
import type { RendererFramePipeline, RendererOverlayPass } from "./renderer-backend-v2";

interface OverlayPassRenderer {
  clearDepth(): void;
  render(scene: Object3D, camera: Camera): void;
}

export function getRendererOverlayPasses(
  pipeline: Pick<RendererFramePipeline, "overlayPasses">,
): RendererOverlayPass[] {
  return [...(pipeline.overlayPasses ?? [])];
}

export function renderRendererOverlayPasses(
  renderer: OverlayPassRenderer,
  pipeline: Pick<RendererFramePipeline, "overlayPasses">,
): void {
  for (const overlayPass of getRendererOverlayPasses(pipeline)) {
    renderer.clearDepth();
    renderer.render(overlayPass.scene, overlayPass.camera);
  }
}
