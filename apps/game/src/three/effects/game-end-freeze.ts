import type Node from "three/src/nodes/core/Node.js";
import { color, mix, mx_noise_float, positionWorld, smoothstep, uniform, vec3 } from "three/tsl";

let activeGameId = 0;
let paused = false;
const frost = uniform(0);

/** Shared shader clock: water, wind, fog and FX hold their last pose after game end. */
export const mapAnimationTime = uniform(0);
mapAnimationTime.onFrameUpdate((frame) => {
  if (!paused) mapAnimationTime.value = frame.time;
  return mapAnimationTime.value;
});

export function updateGameEndFreeze(gameId: number, ended: boolean, deltaSeconds: number): void {
  if (gameId !== activeGameId) {
    activeGameId = gameId;
    frost.value = 0;
  }
  paused = ended;
  frost.value = ended ? Math.min(1, frost.value + Math.max(0, deltaSeconds) / 2) : 0;
}

/** Static ice grain follows the world surface, so the effect survives camera movement and tile loading. */
export function applyGameEndFrost(surface: Node<"vec3">): Node<"vec3"> {
  const grain = mx_noise_float(positionWorld.mul(22)).mul(0.5).add(0.5);
  const crystals = smoothstep(0.5, 0.7, grain).mul(0.08);
  const luminance = surface.dot(vec3(0.2126, 0.7152, 0.0722));
  const ice = color("#aed9ed").mul(luminance.mul(0.55).add(0.35).add(crystals));
  return mix(surface, ice, frost.mul(0.82));
}
