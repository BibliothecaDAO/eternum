import { Vector3 } from "three";

export interface ArrowBallisticState {
  position: Vector3;
  velocity: Vector3;
}

export interface SweptSphereHit {
  fraction: number;
  point: Vector3;
}

export function resolveBallisticLaunchVelocity(
  origin: Readonly<Vector3>,
  target: Readonly<Vector3>,
  targetVelocity: Readonly<Vector3>,
  gravity: Readonly<Vector3>,
  flightSeconds: number,
  out = new Vector3(),
): Vector3 {
  const duration = Math.max(1e-4, flightSeconds);
  return out
    .copy(target)
    .addScaledVector(targetVelocity, duration)
    .sub(origin)
    .addScaledVector(gravity, -0.5 * duration * duration)
    .multiplyScalar(1 / duration);
}

export function stepArrowBallistics(
  state: ArrowBallisticState,
  gravity: Readonly<Vector3>,
  deltaSeconds: number,
): ArrowBallisticState {
  const elapsed = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
  state.position.addScaledVector(state.velocity, elapsed).addScaledVector(gravity, 0.5 * elapsed * elapsed);
  state.velocity.addScaledVector(gravity, elapsed);
  return state;
}

export function intersectSweptSphere(
  from: Readonly<Vector3>,
  to: Readonly<Vector3>,
  targetCenter: Readonly<Vector3>,
  combinedRadius: number,
  outPoint = new Vector3(),
): SweptSphereHit | undefined {
  const segmentX = to.x - from.x;
  const segmentY = to.y - from.y;
  const segmentZ = to.z - from.z;
  const offsetX = from.x - targetCenter.x;
  const offsetY = from.y - targetCenter.y;
  const offsetZ = from.z - targetCenter.z;
  const radius = Math.max(0, combinedRadius);
  const c = offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ - radius * radius;
  if (c <= 0) return { fraction: 0, point: outPoint.copy(from) };

  const a = segmentX * segmentX + segmentY * segmentY + segmentZ * segmentZ;
  if (a <= 1e-12) return undefined;
  const b = 2 * (offsetX * segmentX + offsetY * segmentY + offsetZ * segmentZ);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return undefined;

  const root = Math.sqrt(discriminant);
  const fraction = (-b - root) / (2 * a);
  if (fraction < 0 || fraction > 1) return undefined;
  outPoint.set(from.x + segmentX * fraction, from.y + segmentY * fraction, from.z + segmentZ * fraction);
  return { fraction, point: outPoint };
}
