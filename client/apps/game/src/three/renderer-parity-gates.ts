import type { RendererCapabilityFeature, RendererFeatureDegradation } from "./renderer-backend-v2";

export const REQUIRED_RENDERER_PARITY_FEATURES: RendererCapabilityFeature[] = ["environmentIbl", "toneMappingControl"];

const REQUIRED_RENDERER_PARITY_FEATURE_SET = new Set<RendererCapabilityFeature>(REQUIRED_RENDERER_PARITY_FEATURES);

export function evaluateRendererParityGates(degradations: RendererFeatureDegradation[]): {
  advisory: RendererFeatureDegradation[];
  blocking: RendererFeatureDegradation[];
  ok: boolean;
} {
  const blocking = degradations.filter((degradation) => REQUIRED_RENDERER_PARITY_FEATURE_SET.has(degradation.feature));
  const advisory = degradations.filter((degradation) => !REQUIRED_RENDERER_PARITY_FEATURE_SET.has(degradation.feature));

  return {
    advisory,
    blocking,
    ok: blocking.length === 0,
  };
}
