import type { ProceduralArcherAimSolution } from "./procedural-archer-aim";
import type { ProceduralArcherConfig } from "./procedural-archer-config";
import { resolveProceduralArcherShotSignals, type ProceduralArcherShotState } from "./procedural-archer-shot-cycle";

export interface ProceduralArcherUpperBodyPose {
  kind: "archer";
  actionWeight: number;
  aimPitchRadians: number;
  aimYawRadians: number;
  bowBend: number;
  bowArmExtension: number;
  bowCantRadians: number;
  bowGripHeight: number;
  bowGripSide: number;
  bowHeight: number;
  drawFraction: number;
  drawHandFraction: number;
  drawLength: number;
  followThrough: number;
  previewArrowVisible: boolean;
  raiseFraction: number;
  releaseProgress: number;
}

export function resolveProceduralArcherUpperBodyPose(
  state: ProceduralArcherShotState,
  config: ProceduralArcherConfig,
  aim: ProceduralArcherAimSolution,
  elapsedSeconds: number,
  seed: number,
): ProceduralArcherUpperBodyPose {
  const signals = resolveProceduralArcherShotSignals(state, config);
  const driftWeight = state.phase === "aim" || state.phase === "anchor" ? signals.actionWeight : 0;
  const driftPhase = elapsedSeconds * 3.1 + (seed % 997) * 0.017;
  const yawDrift = Math.sin(driftPhase) * config.aimDrift * driftWeight;
  const pitchDrift = Math.sin(driftPhase * 0.71 + 1.8) * config.aimDrift * 0.62 * driftWeight;

  return {
    ...signals,
    aimPitchRadians: aim.pitchRadians + pitchDrift,
    aimYawRadians: aim.yawRadians + yawDrift,
    bowBend: config.bowBend,
    bowArmExtension: config.bowArmExtension,
    bowCantRadians: (config.bowCantDegrees * Math.PI) / 180,
    bowGripHeight: config.bowGripHeight,
    bowGripSide: config.bowGripSide,
    bowHeight: config.bowHeight,
    drawLength: config.drawLength,
    kind: "archer",
  };
}
