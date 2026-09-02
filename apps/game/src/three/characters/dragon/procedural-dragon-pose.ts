import { Euler, Quaternion } from "three";

import type { ProceduralContactReactionPose } from "../collision/procedural-contact-reaction";
import type { QuaternionTuple, Vector3Tuple } from "../procedural-character-pose";
import type { HorseGroundSampler } from "../horse/procedural-horse-pose";
import type { ProceduralDragonConfig } from "./procedural-dragon-config";
import type { ProceduralDragonFirePhase, ProceduralDragonFireSignals } from "./procedural-dragon-fire-cycle";

const DRAGON_LEG_IDS = ["frontLeft", "frontRight", "hindLeft", "hindRight"] as const;
export type DragonLegId = (typeof DRAGON_LEG_IDS)[number];

export interface ProceduralDragonLegPose {
  anklePitch: number;
  contact: boolean;
  hipPitch: number;
  kneePitch: number;
}

export interface ProceduralDragonPose {
  bodyPosition: Vector3Tuple;
  bodyRotation: QuaternionTuple;
  contactCount: number;
  fireIntensity: number;
  fireTarget: Vector3Tuple;
  firePhase: ProceduralDragonFirePhase;
  flightBlend: number;
  groundHeight: number;
  jawOpen: number;
  legs: Readonly<Record<DragonLegId, ProceduralDragonLegPose>>;
  locomotionMode: ProceduralDragonConfig["locomotionMode"];
  mouthPosition: Vector3Tuple;
  mouthRotation: QuaternionTuple;
  neckRotations: readonly QuaternionTuple[];
  phase: number;
  saddlePosition: Vector3Tuple;
  saddleRotation: QuaternionTuple;
  tailRotations: readonly QuaternionTuple[];
  wings: { flap: number; spread: number };
}

interface ResolveProceduralDragonPoseInput {
  config: ProceduralDragonConfig;
  elapsedSeconds: number;
  firePhase: ProceduralDragonFirePhase;
  fireSignals: ProceduralDragonFireSignals;
  flightBlend?: number;
  phase: number;
  reaction?: ProceduralContactReactionPose;
  sampleGround?: HorseGroundSampler;
  targetLocal?: Readonly<Vector3Tuple>;
}

const LEG_PHASES: Readonly<Record<DragonLegId, number>> = {
  frontLeft: 0.5,
  frontRight: 0,
  hindLeft: 0,
  hindRight: 0.5,
};

export function resolveProceduralDragonPose(input: ResolveProceduralDragonPoseInput): ProceduralDragonPose {
  const { config, fireSignals } = input;
  const flightRequested = config.locomotionMode === "flight";
  const flightBlend = clamp(input.flightBlend ?? (flightRequested ? 1 : 0), 0, 1);
  const smoothFlightBlend = smoothstep(flightBlend);
  const walking = config.locomotionMode === "walk" && config.speed > 0 && flightBlend <= 1e-4;
  const cycle = input.phase * Math.PI * 2;
  const ground = input.sampleGround?.(0, 0) ?? { height: 0, normal: [0, 1, 0] as const };
  const reactionWeight = input.reaction?.weight ?? 0;
  const reactionRoll = -(input.reaction?.localDirectionX ?? 0) * reactionWeight * 0.24;
  const reactionPitch = (input.reaction?.localDirectionZ ?? 0) * reactionWeight * 0.18;
  const wingPulse = Math.sin(cycle);
  const flightBob = Math.sin(cycle * 2) * 0.07 * (1 - config.glide);
  const walkBob = walking ? (1 - Math.cos(cycle * 2)) * 0.045 : 0;
  const bodyHeight = ground.height + lerp(1.18 + walkBob, config.altitude + flightBob, smoothFlightBlend);
  const bodyRotation = quaternionFromEuler(
    config.pitch * smoothFlightBlend + reactionPitch - wingPulse * 0.035 * smoothFlightBlend,
    config.turnRate * 0.12,
    config.bank * smoothFlightBlend + reactionRoll,
  );
  const aim = resolveAim(input.targetLocal, bodyHeight, fireSignals.neckWeight);
  const neckRotations = Array.from({ length: 4 }, (_, index) => {
    const idle = Math.sin(input.elapsedSeconds * 1.3 + index * 0.55) * config.neckMotion * 0.055;
    const inhale = -fireSignals.inhale * (0.08 + index * 0.025);
    return quaternionFromEuler(aim.pitch * 0.25 + idle + inhale, aim.yaw * 0.25, 0);
  });
  const tailRotations = Array.from({ length: 6 }, (_, index) => {
    const progress = (index + 1) / 6;
    const sway = Math.sin(cycle - index * 0.55) * config.tailMotion * (0.13 + progress * 0.08);
    const lift = lerp(-0.035 * progress, 0.05 + progress * 0.03, smoothFlightBlend);
    return quaternionFromEuler(
      lift,
      sway - config.bank * progress * 0.35 * smoothFlightBlend,
      -config.bank * progress * 0.14 * smoothFlightBlend,
    );
  });
  const wings = resolveWingPose(config, wingPulse, smoothFlightBlend);
  const legs = Object.fromEntries(
    DRAGON_LEG_IDS.map((legId) => [legId, resolveLegPose(config, legId, input.phase, walking, smoothFlightBlend)]),
  ) as Record<DragonLegId, ProceduralDragonLegPose>;
  const contactCount = Object.values(legs).filter(({ contact }) => contact).length;
  const saddlePosition: Vector3Tuple = [0, bodyHeight - 0.1, -0.12];
  const mouthPosition: Vector3Tuple = [0, bodyHeight + 0.52 - aim.pitch * 0.25, 2.28];
  const fireTarget: Vector3Tuple = input.targetLocal
    ? [...input.targetLocal]
    : [mouthPosition[0], mouthPosition[1], mouthPosition[2] + config.fireRange];

  return {
    bodyPosition: [0, bodyHeight, 0],
    bodyRotation,
    contactCount,
    fireIntensity: fireSignals.breath,
    fireTarget,
    firePhase: input.firePhase,
    flightBlend,
    groundHeight: ground.height,
    jawOpen: fireSignals.jawOpen,
    legs,
    locomotionMode: config.locomotionMode,
    mouthPosition,
    mouthRotation: quaternionFromEuler(aim.pitch, aim.yaw, 0),
    neckRotations,
    phase: input.phase,
    saddlePosition,
    saddleRotation: bodyRotation,
    tailRotations,
    wings,
  };
}

export function isProceduralDragonPoseFinite(pose: ProceduralDragonPose): boolean {
  const values = [
    ...pose.bodyPosition,
    ...pose.bodyRotation,
    pose.contactCount,
    pose.fireIntensity,
    pose.flightBlend,
    pose.groundHeight,
    ...pose.fireTarget,
    pose.jawOpen,
    pose.phase,
    ...pose.mouthPosition,
    ...pose.mouthRotation,
    ...pose.saddlePosition,
    ...pose.saddleRotation,
    ...pose.neckRotations.flat(),
    ...pose.tailRotations.flat(),
    pose.wings.flap,
    pose.wings.spread,
    ...Object.values(pose.legs).flatMap(({ anklePitch, hipPitch, kneePitch }) => [anklePitch, hipPitch, kneePitch]),
  ];
  return values.every(Number.isFinite);
}

function resolveWingPose(
  config: ProceduralDragonConfig,
  pulse: number,
  flightBlend: number,
): ProceduralDragonPose["wings"] {
  const activeAmplitude = config.wingAmplitude * (1 - config.glide * 0.78);
  return { flap: pulse * lerp(0.08, activeAmplitude, flightBlend), spread: flightBlend };
}

function resolveLegPose(
  config: ProceduralDragonConfig,
  legId: DragonLegId,
  phase: number,
  walking: boolean,
  flightBlend: number,
): ProceduralDragonLegPose {
  const grounded = resolveGroundedLegPose(config, legId, phase, walking);
  const front = legId.startsWith("front");
  const airborne = {
    anklePitch: front ? -0.48 : 0.28,
    contact: false,
    hipPitch: front ? -0.62 : 0.72,
    kneePitch: 1.15,
  };
  return {
    anklePitch: lerp(grounded.anklePitch, airborne.anklePitch, flightBlend),
    contact: flightBlend <= 1e-4 && grounded.contact,
    hipPitch: lerp(grounded.hipPitch, airborne.hipPitch, flightBlend),
    kneePitch: lerp(grounded.kneePitch, airborne.kneePitch, flightBlend),
  };
}

function resolveGroundedLegPose(
  config: ProceduralDragonConfig,
  legId: DragonLegId,
  phase: number,
  walking: boolean,
): ProceduralDragonLegPose {
  if (!walking) return { anklePitch: -0.08, contact: true, hipPitch: 0.02, kneePitch: 0.38 };
  const localPhase = wrapUnit(phase + LEG_PHASES[legId]);
  const contact = localPhase < 0.56;
  const progress = contact ? localPhase / 0.56 : (localPhase - 0.56) / 0.44;
  const swing = contact ? 0.48 - progress * 0.96 : -0.48 + progress * 0.96;
  const lift = contact ? 0 : Math.sin(progress * Math.PI) * config.stepHeight;
  return {
    anklePitch: -swing * 0.32 - lift * 0.22,
    contact,
    hipPitch: swing * config.strideScale * 0.72,
    kneePitch: 0.38 + lift * 1.5,
  };
}

function resolveAim(target: Readonly<Vector3Tuple> | undefined, bodyHeight: number, weight: number) {
  if (!target || weight <= 0) return { pitch: 0, yaw: 0 };
  const horizontal = Math.hypot(target[0], target[2] - 1.45);
  return {
    pitch: clamp(-Math.atan2(target[1] - bodyHeight - 0.65, Math.max(0.01, horizontal)) * weight, -0.48, 0.58),
    yaw: clamp(Math.atan2(target[0], target[2] - 1.45) * weight, -0.82, 0.82),
  };
}

function quaternionFromEuler(x: number, y: number, z: number): QuaternionTuple {
  const quaternion = new Quaternion().setFromEuler(new Euler(x, y, z, "YXZ"));
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}

function wrapUnit(value: number): number {
  return ((value % 1) + 1) % 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, weight: number): number {
  return start + (end - start) * weight;
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}
