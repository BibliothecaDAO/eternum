export interface ProceduralCrossbowUpperBodyPose {
  actionWeight: number;
  kind: "crossbow";
  lift: number;
  swayRadians: number;
}

export function resolveProceduralCrossbowCarryPose(
  elapsedSeconds: number,
  seed: number,
): ProceduralCrossbowUpperBodyPose {
  const phase = elapsedSeconds * 1.35 + (seed % 997) * 0.013;
  return {
    actionWeight: 1,
    kind: "crossbow",
    lift: Math.sin(phase * 0.73 + 1.2) * 0.008,
    swayRadians: Math.sin(phase) * 0.018,
  };
}
