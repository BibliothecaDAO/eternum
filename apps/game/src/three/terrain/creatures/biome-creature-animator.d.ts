import type { Object3D } from "three";

interface CreatureMotion {
  distance?: number;
  pace?: number;
  turn?: number;
  action?: string;
  lift?: number;
  gaze?: number | null;
  stealth?: boolean;
}

interface CreatureAnimator {
  update(time: number, motion?: CreatureMotion): void;
  reset(): void;
}

export const PERCH_DROP: number;

export function createCreatureAnimator(root: Object3D, options?: { seed?: number }): CreatureAnimator;
