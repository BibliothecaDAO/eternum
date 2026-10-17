import type Node from "three/src/nodes/core/Node.js";
import { Vector2, Vector3 } from "three";
import { color, float, mix, mx_noise_float, positionWorld, smoothstep, uniform, vec3 } from "three/tsl";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import { ENDGAME_SEQUENCE, type endgameFrame } from "./sequence";
import type { EndgamePlan } from "./plan";

const endgameOrigins = [uniform(new Vector3()), uniform(new Vector3())];
export const endgameClock = uniform(0);
export const endgameReach = uniform(0);
export const endgameSettle = uniform(0);
const active = uniform(0);
const sparedCentre = uniform(new Vector2());
const hasSparedHex = uniform(0);
const spatialView = uniform(true);
const localCoverage = uniform(0);
const relative = positionWorld.xz.sub(sparedCentre).abs();
const hexDistance = relative.x.max(relative.x.mul(0.5).add(relative.y.mul(Math.sqrt(3) / 2)));
export const endgameAllowed = float(1).sub(
  float(1)
    .sub(smoothstep(0.85, 0.87, hexDistance))
    .mul(hasSparedHex),
);
export const endgameNoise = mx_noise_float(
  vec3(positionWorld.x.mul(0.38), positionWorld.z.mul(0.38), endgameClock.mul(0.14)),
)
  .mul(0.5)
  .add(0.5);
const distance = positionWorld.sub(endgameOrigins[0]).length().min(positionWorld.sub(endgameOrigins[1]).length());
export const endgameBoundary = distance.add(endgameNoise.sub(0.5).mul(ENDGAME_SEQUENCE.turbulence));
export const endgameCovered = endgameSettle
  .greaterThanEqual(1)
  .select(float(1), smoothstep(endgameBoundary.sub(0.9), endgameBoundary.add(0.9), endgameReach))
  .mul(active)
  .mul(endgameAllowed);

export function configureEndgameField(
  plan: EndgamePlan,
  frame: ReturnType<typeof endgameFrame>,
  origins: readonly Vector3[],
): void {
  endgameOrigins.forEach((node, i) => node.value.copy(origins[i] ?? origins[0]));
  endgameReach.value = frame.spread * plan.maximumReach;
  endgameClock.value = frame.seconds;
  endgameSettle.value = frame.settle;
  active.value = frame.spread > 0 ? 1 : 0;
  hasSparedHex.value = plan.sparedHex ? 1 : 0;
  if (plan.sparedHex) {
    const p = terrainHexToWorld(plan.sparedHex.col, plan.sparedHex.row);
    sparedCentre.value.set(p.x, p.z);
  }
}

export function setEndgameView(worldMap: boolean, frontier: boolean, spread: number): void {
  spatialView.value = worldMap;
  localCoverage.value = frontier ? 0 : spread;
}
export function resetEndgameField(): void {
  active.value = 0;
  localCoverage.value = 0;
  endgameReach.value = 0;
  endgameClock.value = 0;
  endgameSettle.value = 0;
  hasSparedHex.value = 0;
}

/** One spatial coating follows the approved mist front, including terrain streamed after the event. */
export function applyEndgameFrost(surface: Node<"vec3">): Node<"vec3"> {
  const grain = mx_noise_float(positionWorld.mul(22)).mul(0.5).add(0.5);
  const brightness = surface.dot(vec3(0.2126, 0.7152, 0.0722));
  const ice = color("#aed9ed").mul(
    brightness
      .mul(0.55)
      .add(0.35)
      .add(smoothstep(0.5, 0.7, grain).mul(0.08)),
  );
  const coverage = spatialView.select(endgameCovered, localCoverage);
  return mix(surface, ice, coverage.mul(endgameSettle.mul(0.6).add(0.4)).mul(0.82));
}
