import { Vector3 } from "three";

import type { ProceduralArcherConfig } from "./procedural-archer-config";

export interface ProceduralArcherAimSolution {
  direction: Vector3;
  pitchRadians: number;
  yawRadians: number;
}

const DEG_TO_RAD = Math.PI / 180;

export function resolveProceduralArcherAim(
  localTarget: Readonly<Vector3>,
  config: ProceduralArcherConfig,
  outDirection = new Vector3(),
): ProceduralArcherAimSolution {
  const horizontalDistance = Math.hypot(localTarget.x, localTarget.z);
  const targetYaw = Math.atan2(localTarget.x, localTarget.z) + config.aimYawDegrees * DEG_TO_RAD;
  const targetPitch =
    Math.atan2(localTarget.y, Math.max(horizontalDistance, 1e-6)) + config.aimPitchDegrees * DEG_TO_RAD;
  const yawRadians = clamp(targetYaw, -50 * DEG_TO_RAD, 50 * DEG_TO_RAD);
  const pitchRadians = clamp(targetPitch, -20 * DEG_TO_RAD, 45 * DEG_TO_RAD);
  writeAimDirection(yawRadians, pitchRadians, outDirection);
  return { direction: outDirection, pitchRadians, yawRadians };
}

function writeAimDirection(yawRadians: number, pitchRadians: number, out: Vector3): Vector3 {
  const pitchCosine = Math.cos(pitchRadians);
  return out.set(Math.sin(yawRadians) * pitchCosine, Math.sin(pitchRadians), Math.cos(yawRadians) * pitchCosine);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
