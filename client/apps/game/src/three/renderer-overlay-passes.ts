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
    // A pass whose scene holds nothing drawable (empty, or lights only) still
    // costs a full encoder begin/end + attachment load/store per frame.
    if (!hasRenderableOverlayContent(overlayPass.scene)) {
      continue;
    }
    renderer.clearDepth();
    renderer.render(overlayPass.scene, overlayPass.camera);
  }
}

function hasRenderableOverlayContent(scene: Object3D): boolean {
  return scene.children.some((child) => !(child as { isLight?: boolean }).isLight);
}
