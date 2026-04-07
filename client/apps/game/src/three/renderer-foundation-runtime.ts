import type { GraphicsSettings } from "@/ui/config";
import { createRendererInteractionRuntime, type RendererInteractionRuntime } from "./renderer-interaction-runtime";
import { createRendererLabelRuntime, type RendererLabelRuntime } from "./renderer-label-runtime";
import type { SceneName } from "./types";

export interface RendererFoundationRuntime {
  camera: RendererInteractionRuntime["camera"];
  interactionRuntime: RendererInteractionRuntime;
  labelRuntime: RendererLabelRuntime;
  pointer: RendererInteractionRuntime["pointer"];
  raycaster: RendererInteractionRuntime["raycaster"];
}

interface CreateRendererFoundationRuntimeInput {
  graphicsSetting: GraphicsSettings;
  isMobileDevice: boolean;
  onControlsChange: () => void;
  resolveCurrentSceneName: () => SceneName | undefined;
  warn: (message: string, error: unknown) => void;
}

export function createRendererFoundationRuntime(
  input: CreateRendererFoundationRuntimeInput,
): RendererFoundationRuntime {
  const interactionRuntime = createRendererInteractionRuntime({
    graphicsSetting: input.graphicsSetting,
    onControlsChange: input.onControlsChange,
    resolveCurrentSceneName: input.resolveCurrentSceneName,
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
