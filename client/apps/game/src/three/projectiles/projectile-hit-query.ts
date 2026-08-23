import { Vector3 } from "three";

export type ProjectileImpactMaterial = "flesh" | "ground" | "metal" | "wood";

export interface ProjectileSweepRequest {
  from: Readonly<Vector3>;
  intendedTargetEntityId?: number;
  ownerEntityId?: number;
  radius: number;
  to: Readonly<Vector3>;
}

export interface ProjectileSweepHit {
  fraction: number;
  material: ProjectileImpactMaterial;
  normal: Vector3;
  partId?: string;
  point: Vector3;
  targetEntityId?: number;
}

export interface ProjectileHitQuery {
  hasTarget?(entityId: number): boolean;
  sweepSphere(request: ProjectileSweepRequest): ProjectileSweepHit | undefined;
}

export function selectEarlierProjectileHit(
  left: ProjectileSweepHit | undefined,
  right: ProjectileSweepHit | undefined,
): ProjectileSweepHit | undefined {
  if (!left) return right;
  if (!right) return left;
  return left.fraction <= right.fraction ? left : right;
}

export function createGroundPlaneHit(from: Readonly<Vector3>, to: Readonly<Vector3>): ProjectileSweepHit | undefined {
  if (from.y <= 0 || to.y > 0) return undefined;
  const fraction = from.y / Math.max(1e-6, from.y - to.y);
  return {
    fraction,
    material: "ground",
    normal: new Vector3(0, 1, 0),
    point: new Vector3().copy(from).lerp(to, fraction),
  };
}
