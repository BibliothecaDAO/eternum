import { MathUtils } from "three";

export function resolveRewardNightAmount(cycleProgress: number): number {
  const daylight =
    MathUtils.smoothstep(cycleProgress, 16.7, 33.3) * (1 - MathUtils.smoothstep(cycleProgress, 66.7, 83.3));
  return 1 - daylight;
}
