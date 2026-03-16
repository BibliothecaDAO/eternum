import type { AtmosphereSnapshot } from "./atmosphere-controller";

export interface StormVisualPolicyResult {
  allowLightning: boolean;
  allowStormFill: boolean;
  ambientFlicker: number;
  hemisphereFlicker: number;
  shouldScheduleLightning: boolean;
  stormFillIntensity: number;
}

export function resolveStormVisualPolicy(input: {
  hasScheduledLightning: boolean;
  lightningActive: boolean;
  snapshot: AtmosphereSnapshot;
  timeSinceLastLightningMs: number;
}): StormVisualPolicyResult {
  const isSemanticStorm =
    input.snapshot.weatherType === "storm" &&
    input.snapshot.stormIntensity >= 0.15 &&
    input.snapshot.weatherPhase !== "clear";

  if (!isSemanticStorm) {
    return {
      allowLightning: false,
      allowStormFill: false,
      ambientFlicker: 1,
      hemisphereFlicker: 1,
      shouldScheduleLightning: false,
      stormFillIntensity: 0,
    };
  }

  const stormDepth = Math.max(input.snapshot.intensity * 0.35, input.snapshot.stormIntensity);
  const flickerStrength = Math.max(0, stormDepth * 0.06);

  return {
    allowLightning: stormDepth >= 0.45,
    allowStormFill: stormDepth > 0.05,
    ambientFlicker: 1 + flickerStrength,
    hemisphereFlicker: 1 + flickerStrength,
    shouldScheduleLightning:
      stormDepth >= 0.45 &&
      !input.lightningActive &&
      !input.hasScheduledLightning &&
      input.timeSinceLastLightningMs >= 4000,
    stormFillIntensity: Math.max(0.2, Math.min(1.2, 0.25 + stormDepth * 0.65)),
  };
}
