export type FogPolicyCameraView = "close" | "medium" | "far";

export interface FogPolicyResult {
  enabled: boolean;
  far: number | null;
  near: number | null;
  reason?: "camera-close" | "quality-disabled";
}

export function resolveFogPolicy(input: {
  cameraFar: number;
  cameraView: FogPolicyCameraView;
  qualityEnabled: boolean;
  weatherFogFactor: number;
}): FogPolicyResult {
  if (!input.qualityEnabled) {
    return {
      enabled: false,
      far: null,
      near: null,
      reason: "quality-disabled",
    };
  }

  if (input.cameraView === "close") {
    return {
      enabled: false,
      far: null,
      near: null,
      reason: "camera-close",
    };
  }

  const fogFactor = Math.max(0, Math.min(1, input.weatherFogFactor));
  const clipFar = Math.max(1, input.cameraFar);
  const baseStartFactor = input.cameraView === "medium" ? 0.35 : 0.45;
  const baseEndFactor = input.cameraView === "medium" ? 0.85 : 0.9;

  const startFactor = Math.max(0.18, baseStartFactor - fogFactor * 0.16);
  const endFactor = Math.max(startFactor + 0.12, baseEndFactor - fogFactor * 0.12);

  return {
    enabled: true,
    far: Math.max(16, clipFar * endFactor),
    near: Math.max(8, clipFar * startFactor),
  };
}
