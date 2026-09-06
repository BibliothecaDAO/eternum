import { createRendererInteractionRuntime, type RendererInteractionRuntime } from "./renderer-interaction-runtime";
import { createRendererLabelRuntime, type RendererLabelRuntime } from "./renderer-label-runtime";

export interface RendererFoundationRuntime {
  camera: RendererInteractionRuntime["camera"];
  interactionRuntime: RendererInteractionRuntime;
  labelRuntime: RendererLabelRuntime;
  pointer: RendererInteractionRuntime["pointer"];
  raycaster: RendererInteractionRuntime["raycaster"];
}

interface CreateRendererFoundationRuntimeInput {
  isMobileDevice: boolean;
  onControlsChange: () => void;
  warn: (message: string, error: unknown) => void;
}

export function createRendererFoundationRuntime(
  input: CreateRendererFoundationRuntimeInput,
): RendererFoundationRuntime {
  const interactionRuntime = createRendererInteractionRuntime({
    onControlsChange: input.onControlsChange,
  });
  const labelRuntime = createRendererLabelRuntime({
    isMobileDevice: input.isMobileDevice,
  });

  labelRuntime.initialize().catch((error) => {
    input.warn("GameRenderer: Failed to initialize label renderer:", error);
  });

  return {
    camera: interactionRuntime.camera,
    interactionRuntime,
    labelRuntime,
    pointer: interactionRuntime.pointer,
    raycaster: interactionRuntime.raycaster,
  };
}
