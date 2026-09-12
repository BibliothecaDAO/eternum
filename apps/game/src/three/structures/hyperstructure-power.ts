import { InstancedBufferAttribute } from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  attribute,
  color,
  mix,
  mx_noise_float,
  normalView,
  positionGeometry,
  positionViewDirection,
  smoothstep,
  uniform,
  vec3,
} from "three/tsl";
import { applyGameEndFrost } from "../effects/game-end-freeze";

/** Violet essence churns inside its shell; refined teal essence stays pure and steady. */
export function createHyperstructurePower(capacity: number) {
  const instances = new InstancedBufferAttribute(new Float32Array(Math.max(2, capacity) * 2), 2);
  const time = uniform(0);
  const identity = attribute<"vec2">("hyperstructurePower", "vec2");
  const unstable = identity.x;
  const clock = time.mul(mix(0.22, 0.85, unstable)).add(identity.y);
  const essence = mix(color("#36d9ce"), color("#9439f2"), unstable);
  const flow = mx_noise_float(positionGeometry.mul(26).add(vec3(clock.mul(0.3), clock, 0))).abs();
  const wisps = smoothstep(0.02, 0.17, flow).oneMinus();
  const rim = normalView.dot(positionViewDirection).abs().oneMinus().pow(2);
  const surge = clock.mul(3.1).sin().mul(clock.mul(5.7).sin()).mul(unstable).mul(0.15).add(1);
  const turbulence = mix(essence.mul(0.18), essence.mul(1.6), rim).add(essence.mul(wisps).mul(0.9)).mul(surge);
  const surface = mix(essence, turbulence, unstable);
  const material = new MeshBasicNodeMaterial();
  material.name = "Hyperstructure essence";
  material.colorNode = applyGameEndFrost(surface);
  return { instances, time, material };
}
