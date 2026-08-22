import { Euler, Quaternion, Vector3 } from "three";

import type { ProceduralHorseConfig } from "./procedural-horse-config";
import { resolveOrganicLimbTrajectory, resolveSeededMotionValue } from "../procedural-motion-curves";
import type { ProceduralPlantTargetResolver } from "../procedural-plant-controller";
import {
  HORSE_HOOF_IDS,
  resolveHorseGaitStride,
  resolveHorseHoofCycle,
  resolveHorseSwingApex,
  type HorseHoofCycle,
  type HorseHoofId,
} from "./procedural-horse-gait";
import {
  HORSE_LEG_SEGMENT_IDS,
  type HorseLegSegmentId,
  type HorseVector3Tuple,
  type ResolvedHorseLegRig,
  type ResolvedHorseRig,
} from "./procedural-horse-rig";

export type HorseQuaternionTuple = readonly [number, number, number, number];

export interface HorseGroundSample {
  height: number;
  normal?: HorseVector3Tuple;
}

export type HorseGroundSampler = (x: number, z: number) => HorseGroundSample;

export interface HorseLegPose {
  bendAlignment: number;
  cycle: HorseHoofCycle;
  hoofTarget: HorseVector3Tuple;
  joints: readonly HorseVector3Tuple[];
}

export interface ProceduralHorsePose {
  bodyRotation: HorseQuaternionTuple;
  gait: ProceduralHorseConfig["gait"];
  headPosition: HorseVector3Tuple;
  legs: Readonly<Record<HorseHoofId, HorseLegPose>>;
  neckRotations: readonly HorseQuaternionTuple[];
  phase: number;
  rootOffset: HorseVector3Tuple;
  saddlePosition: HorseVector3Tuple;
  saddleRotation: HorseQuaternionTuple;
  segmentRotations: Readonly<Record<HorseLegSegmentId, HorseQuaternionTuple>>;
  tailRotations: readonly HorseQuaternionTuple[];
}

interface HorseGaitBodyMotion {
  lateral: number;
  longitudinal: number;
  pitch: number;
  roll: number;
  vertical: number;
}

const Y_AXIS = new Vector3(0, 1, 0);
const DEFAULT_GROUND_SAMPLER: HorseGroundSampler = () => ({ height: 0 });

export function resolveProceduralHorsePose(
  rig: ResolvedHorseRig,
  config: ProceduralHorseConfig,
  phase: number,
  elapsedSeconds: number,
  sampleGround: HorseGroundSampler = (x, z) => sampleProceduralHorseTerrain(config, x, z),
  resolvePlantTarget?: ProceduralPlantTargetResolver<HorseHoofId>,
): ProceduralHorsePose {
  const gaitWeight = config.gait === "idle" ? 0 : 1;
  const gaitAngle = phase * Math.PI * 2;
  const cycles = Object.fromEntries(
    HORSE_HOOF_IDS.map((hoofId) => [hoofId, resolveOrganicHoofCycle(config, hoofId, phase)]),
  ) as Record<HorseHoofId, HorseHoofCycle>;
  const bodyMotion = resolveHorseGaitBodyMotion(config, gaitAngle, cycles);
  const terrainAttitude = resolveHorseTerrainAttitude(rig, sampleGround);
  const idleBreath =
    config.gait === "idle"
      ? Math.sin(elapsedSeconds * 1.15 + resolveSeededMotionValue(config.seed, 103) * Math.PI) *
        (0.006 + config.motionVariation * 0.012)
      : 0;
  const rootOffset = new Vector3(
    bodyMotion.lateral,
    bodyMotion.vertical * gaitWeight + idleBreath,
    bodyMotion.longitudinal,
  );
  const bodyRotation = new Quaternion().setFromEuler(
    new Euler(
      config.bodyPitch +
        bodyMotion.pitch * gaitWeight +
        terrainAttitude.pitch * config.terrainResponse +
        idleBreath * 0.35,
      config.turnRate * 0.08,
      config.bodyRoll +
        bodyMotion.roll * gaitWeight +
        terrainAttitude.roll * config.terrainResponse -
        config.turnRate * Math.min(config.speed, 5) * 0.018,
    ),
  );
  const bodyCenter = new Vector3(...rig.bodyCenter);
  const stride = resolveHorseGaitStride(config);
  const segmentRotations = {} as Record<HorseLegSegmentId, HorseQuaternionTuple>;
  const legs = Object.fromEntries(
    HORSE_HOOF_IDS.map((hoofId) => {
      const leg = resolveLegPose(
        rig.legs[hoofId],
        rig.groundY,
        config,
        cycles[hoofId],
        stride,
        bodyCenter,
        bodyRotation,
        rootOffset,
        sampleGround,
        resolvePlantTarget,
      );
      leg.joints.slice(0, -1).forEach((joint, index) => {
        const next = leg.joints[index + 1];
        const direction = new Vector3(...next).sub(new Vector3(...joint)).normalize();
        segmentRotations[rig.legs[hoofId].segmentIds[index]] = toQuaternionTuple(
          new Quaternion().setFromUnitVectors(Y_AXIS, direction),
        );
      });
      return [hoofId, leg];
    }),
  ) as Record<HorseHoofId, HorseLegPose>;
  const saddlePosition = transformBodyPoint(new Vector3(...rig.saddlePosition), bodyCenter, bodyRotation, rootOffset);
  const headPosition = transformBodyPoint(new Vector3(...rig.headPosition), bodyCenter, bodyRotation, rootOffset);
  const idleLook =
    Math.sin(elapsedSeconds * 0.63 + resolveSeededMotionValue(config.seed, 109) * Math.PI) * config.motionVariation;

  return {
    bodyRotation: toQuaternionTuple(bodyRotation),
    gait: config.gait,
    headPosition: toTuple(headPosition),
    legs,
    neckRotations: [0.42, 0.3, 0.2, 0.12].map((weight, index) => {
      const overlap = config.secondaryMotion * index * 0.13;
      const flex =
        Math.sin(gaitAngle - 0.35 - overlap) * config.neckMotion * gaitWeight * weight -
        bodyMotion.pitch * weight * 0.72;
      const yaw = config.turnRate * weight * 0.06 + idleLook * weight * 0.035;
      const roll = -bodyMotion.roll * weight * 0.34;
      return toQuaternionTuple(new Quaternion().setFromEuler(new Euler(flex, yaw, roll)));
    }),
    phase,
    rootOffset: toTuple(rootOffset),
    saddlePosition: toTuple(saddlePosition),
    saddleRotation: toQuaternionTuple(bodyRotation),
    segmentRotations,
    tailRotations: Array.from({ length: 7 }, (_, index) => {
      const weight = (index + 1) / 7;
      const overlap = index * config.secondaryMotion * 0.3;
      const tailWave =
        (Math.sin(elapsedSeconds * 1.35 + gaitAngle * 0.38 - overlap) +
          Math.sin(elapsedSeconds * 2.1 - overlap * 1.7 + resolveSeededMotionValue(config.seed, 113)) * 0.28) *
        config.tailMotion;
      return toQuaternionTuple(
        new Quaternion().setFromEuler(
          new Euler(
            -tailWave * 0.08 * weight,
            tailWave * 0.38 * weight + config.turnRate * 0.08 * weight,
            -bodyMotion.roll * weight * 0.18,
          ),
        ),
      );
    }),
  };
}

export function sampleProceduralHorseTerrain(config: ProceduralHorseConfig, x: number, z: number): HorseGroundSample {
  const amplitude = config.terrainAmplitude;
  if (config.terrainPreset === "slope") {
    const gradientX = amplitude * 0.22;
    return { height: x * gradientX, normal: toTuple(new Vector3(-gradientX, 1, 0).normalize()) };
  }
  if (config.terrainPreset === "waves") {
    const height = (Math.sin(x * 1.65) + Math.cos(z * 1.35)) * amplitude * 0.42;
    const gradientX = Math.cos(x * 1.65) * 1.65 * amplitude * 0.42;
    const gradientZ = -Math.sin(z * 1.35) * 1.35 * amplitude * 0.42;
    return { height, normal: toTuple(new Vector3(-gradientX, 1, -gradientZ).normalize()) };
  }
  if (config.terrainPreset === "steps") {
    return {
      height: Math.max(-2, Math.min(2, Math.round(z / 0.7))) * amplitude * 0.34,
      normal: [0, 1, 0],
    };
  }
  return { ...DEFAULT_GROUND_SAMPLER(x, z), normal: [0, 1, 0] };
}

export function isProceduralHorsePoseFinite(pose: ProceduralHorsePose): boolean {
  return (
    [
      ...pose.bodyRotation,
      ...pose.headPosition,
      ...pose.rootOffset,
      ...pose.saddlePosition,
      ...pose.saddleRotation,
    ].every(Number.isFinite) &&
    HORSE_LEG_SEGMENT_IDS.every((segmentId) => pose.segmentRotations[segmentId]?.every(Number.isFinite)) &&
    HORSE_HOOF_IDS.every((hoofId) =>
      [...pose.legs[hoofId].hoofTarget, ...pose.legs[hoofId].joints.flat()].every(Number.isFinite),
    )
  );
}

function resolveLegPose(
  rig: ResolvedHorseLegRig,
  groundY: number,
  config: ProceduralHorseConfig,
  cycle: HorseHoofCycle,
  stride: number,
  bodyCenter: Vector3,
  bodyRotation: Quaternion,
  rootOffset: Vector3,
  sampleGround: HorseGroundSampler,
  resolvePlantTarget?: ProceduralPlantTargetResolver<HorseHoofId>,
): HorseLegPose {
  const preferredPoints = rig.bindPoints.map((point) =>
    transformBodyPoint(new Vector3(...point), bodyCenter, bodyRotation, rootOffset),
  );
  const neutralHoof =
    preferredPoints
      .at(-1)
      ?.clone()
      .add(new Vector3(...rig.hoofOffset)) ?? new Vector3();
  const strideVariation =
    1 + resolveSeededMotionValue(config.seed, resolveHoofVariationChannel(rig.hoofId)) * config.motionVariation * 0.05;
  const liftVariation =
    1 +
    resolveSeededMotionValue(config.seed, resolveHoofVariationChannel(rig.hoofId) + 11) *
      config.motionVariation *
      0.055;
  const stridePosition = resolveOrganicLimbTrajectory(
    cycle,
    stride * strideVariation,
    config.stepHeight * liftVariation,
    config.hoofPlant,
    resolveHorseSwingApex(config.gait),
  );
  neutralHoof.z += stridePosition.forward;
  neutralHoof.y += stridePosition.lift;
  if (cycle.contact === "swing") {
    const sideSign = rig.hoofId.endsWith("Left") ? 1 : -1;
    neutralHoof.x += Math.sin(Math.PI * cycle.progress) * sideSign * stride * config.secondaryMotion * 0.018;
  }
  neutralHoof.x += config.turnRate * (neutralHoof.z - bodyCenter.z) * 0.08;
  const ground = sampleGround(neutralHoof.x, neutralHoof.z);
  neutralHoof.y += ground.height - groundY;
  if (resolvePlantTarget) {
    neutralHoof.fromArray(resolvePlantTarget(rig.hoofId, cycle, toTuple(neutralHoof), config.hoofPlant));
  }
  const target = neutralHoof.sub(new Vector3(...rig.hoofOffset));
  const joints = solveFabrikChain(preferredPoints, target);
  return {
    bendAlignment: resolveMinimumBendAlignment(preferredPoints, joints),
    cycle,
    hoofTarget: toTuple(target.clone().add(new Vector3(...rig.hoofOffset))),
    joints: joints.map(toTuple),
  };
}

function resolveOrganicHoofCycle(config: ProceduralHorseConfig, hoofId: HorseHoofId, phase: number): HorseHoofCycle {
  return resolveHorseHoofCycle(config, hoofId, phase);
}

function resolveHorseGaitBodyMotion(
  config: ProceduralHorseConfig,
  gaitAngle: number,
  cycles: Readonly<Record<HorseHoofId, HorseHoofCycle>>,
): HorseGaitBodyMotion {
  if (config.gait === "idle") {
    return {
      lateral: Math.sin(gaitAngle) * config.motionVariation * 0.012,
      longitudinal: 0,
      pitch: Math.sin(gaitAngle * 0.5) * config.motionVariation * 0.006,
      roll: 0,
      vertical: 0,
    };
  }

  const supports = Object.fromEntries(
    HORSE_HOOF_IDS.map((hoofId) => [hoofId, resolveSupportWeight(cycles[hoofId])]),
  ) as Record<HorseHoofId, number>;
  const totalSupport = Math.max(
    0.35,
    Object.values(supports).reduce((sum, value) => sum + value, 0),
  );
  const leftSupport = supports.frontLeft + supports.hindLeft;
  const rightSupport = supports.frontRight + supports.hindRight;
  const foreSupport = supports.frontLeft + supports.frontRight;
  const hindSupport = supports.hindLeft + supports.hindRight;
  const lateralBalance = (leftSupport - rightSupport) / totalSupport;
  const longitudinalBalance = (hindSupport - foreSupport) / totalSupport;
  const harmonic = resolveHorseBodyHarmonic(config.gait, gaitAngle);
  return {
    lateral: lateralBalance * config.suspension * 0.24,
    longitudinal: Math.sin(gaitAngle - 0.2) * config.suspension * 0.13,
    pitch: longitudinalBalance * config.suspension * 0.36 + harmonic.pitch * config.suspension,
    roll: lateralBalance * config.suspension * 0.72,
    vertical: harmonic.vertical * config.suspension,
  };
}

function resolveHorseTerrainAttitude(rig: ResolvedHorseRig, sampleGround: HorseGroundSampler) {
  const heights = Object.fromEntries(
    HORSE_HOOF_IDS.map((hoofId) => {
      const leg = rig.legs[hoofId];
      const hoof = new Vector3(...(leg.bindPoints.at(-1) ?? [0, 0, 0])).add(new Vector3(...leg.hoofOffset));
      return [hoofId, sampleGround(hoof.x, hoof.z).height];
    }),
  ) as Record<HorseHoofId, number>;
  const frontHeight = (heights.frontLeft + heights.frontRight) * 0.5;
  const hindHeight = (heights.hindLeft + heights.hindRight) * 0.5;
  const leftHeight = (heights.frontLeft + heights.hindLeft) * 0.5;
  const rightHeight = (heights.frontRight + heights.hindRight) * 0.5;
  const frontZ = averageHoofCoordinate(rig, ["frontLeft", "frontRight"], "z");
  const hindZ = averageHoofCoordinate(rig, ["hindLeft", "hindRight"], "z");
  const leftX = averageHoofCoordinate(rig, ["frontLeft", "hindLeft"], "x");
  const rightX = averageHoofCoordinate(rig, ["frontRight", "hindRight"], "x");
  return {
    pitch: -Math.atan2(frontHeight - hindHeight, Math.max(0.1, Math.abs(frontZ - hindZ))),
    roll: Math.atan2(leftHeight - rightHeight, Math.max(0.1, Math.abs(leftX - rightX))),
  };
}

function averageHoofCoordinate(rig: ResolvedHorseRig, hoofIds: readonly HorseHoofId[], axis: "x" | "z"): number {
  const index = axis === "x" ? 0 : 2;
  return (
    hoofIds.reduce((sum, hoofId) => {
      const leg = rig.legs[hoofId];
      const target = leg.bindPoints.at(-1)?.[index] ?? 0;
      return sum + target + leg.hoofOffset[index];
    }, 0) / hoofIds.length
  );
}

function resolveHorseBodyHarmonic(gait: ProceduralHorseConfig["gait"], angle: number) {
  if (gait === "walk") {
    return {
      pitch: Math.sin(angle - 0.45) * 0.16 + Math.sin(angle * 2 + 0.3) * 0.05,
      vertical: Math.sin(angle * 2 - 0.7) * 0.38 + Math.sin(angle * 4 + 0.2) * 0.08,
    };
  }
  if (gait === "trot") {
    return {
      pitch: Math.sin(angle * 2 - 0.2) * 0.12,
      vertical: Math.sin(angle * 2 - 0.55) * 0.72 + Math.sin(angle * 4) * 0.1,
    };
  }
  if (gait === "canter") {
    return {
      pitch: Math.sin(angle - 0.35) * 0.34 + Math.sin(angle * 2 + 0.15) * 0.1,
      vertical: Math.sin(angle - 0.82) * 0.76 + Math.sin(angle * 2 + 0.25) * 0.2,
    };
  }
  return {
    pitch: Math.sin(angle - 0.28) * 0.52 + Math.sin(angle * 2) * 0.14,
    vertical: Math.sin(angle - 0.72) * 0.9 + Math.sin(angle * 2 + 0.18) * 0.28,
  };
}

function resolveSupportWeight(cycle: HorseHoofCycle): number {
  if (cycle.contact === "swing") return 0;
  return Math.pow(Math.sin(Math.PI * cycle.progress), 0.68);
}

function resolveHoofVariationChannel(hoofId: HorseHoofId): number {
  return HORSE_HOOF_IDS.indexOf(hoofId) * 17 + 127;
}

export function solveFabrikChain(preferredPoints: readonly Vector3[], target: Vector3): Vector3[] {
  const points = preferredPoints.map((point) => point.clone());
  const lengths = points.slice(0, -1).map((point, index) => point.distanceTo(points[index + 1]));
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  const root = points[0].clone();
  if (root.distanceTo(target) >= totalLength - 1e-5) {
    const direction = target.clone().sub(root).normalize();
    points[0].copy(root);
    for (let index = 1; index < points.length; index += 1) {
      points[index].copy(points[index - 1]).addScaledVector(direction, lengths[index - 1]);
    }
    return points;
  }

  for (let iteration = 0; iteration < 24; iteration += 1) {
    points.at(-1)?.copy(target);
    for (let index = points.length - 2; index >= 0; index -= 1) {
      movePointToDistance(points[index], points[index + 1], lengths[index]);
    }
    points[0].copy(root);
    for (let index = 1; index < points.length; index += 1) {
      movePointToDistance(points[index], points[index - 1], lengths[index - 1]);
    }
  }
  for (let iteration = 0; iteration < 12; iteration += 1) {
    applyPreferredBendDirections(points, preferredPoints);
    enforcePreferredBendHemispheres(points, preferredPoints);
  }
  return points;
}

function movePointToDistance(point: Vector3, anchor: Vector3, distance: number): void {
  const direction = point.clone().sub(anchor);
  if (direction.lengthSq() < 1e-10) direction.set(0, -1, 0);
  point.copy(anchor).add(direction.normalize().multiplyScalar(distance));
}

function applyPreferredBendDirections(points: Vector3[], preferred: readonly Vector3[]): void {
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const next = points[index + 1];
    const axis = next.clone().sub(previous).normalize();
    if (axis.lengthSq() < 1e-10) continue;
    const jointProjection = projectOntoPlane(points[index], previous, axis);
    const preferredProjection = projectOntoPlane(preferred[index], previous, axis);
    const jointDirection = jointProjection.sub(previous);
    const preferredDirection = preferredProjection.sub(previous);
    if (jointDirection.lengthSq() < 1e-10 || preferredDirection.lengthSq() < 1e-10) continue;
    jointDirection.normalize();
    preferredDirection.normalize();
    const angle = Math.atan2(
      axis.dot(jointDirection.clone().cross(preferredDirection)),
      jointDirection.dot(preferredDirection),
    );
    points[index].sub(previous).applyAxisAngle(axis, angle).add(previous);
  }
}

function enforcePreferredBendHemispheres(points: Vector3[], preferred: readonly Vector3[]): void {
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const axis = points[index + 1].clone().sub(previous).normalize();
    const preferredBend = projectOntoPlane(preferred[index], previous, axis).sub(previous);
    const resolvedBend = projectOntoPlane(points[index], previous, axis).sub(previous);
    if (preferredBend.dot(resolvedBend) >= 0) continue;
    const projection = previous.clone().addScaledVector(axis, points[index].clone().sub(previous).dot(axis));
    points[index].copy(projection.multiplyScalar(2).sub(points[index]));
  }
}

function projectOntoPlane(point: Vector3, origin: Vector3, normal: Vector3): Vector3 {
  const offset = point.clone().sub(origin);
  return point.clone().addScaledVector(normal, -offset.dot(normal));
}

function resolveMinimumBendAlignment(preferred: readonly Vector3[], resolved: readonly Vector3[]): number {
  let minimum = 1;
  // The first interior joint is the shoulder/hip lateral offset. The visible
  // anatomical bend starts at the following knee/stifle joint.
  for (let index = Math.min(2, resolved.length - 2); index < resolved.length - 1; index += 1) {
    const previous = resolved[index - 1];
    const axis = resolved[index + 1].clone().sub(previous).normalize();
    const preferredBend = projectOntoPlane(preferred[index], previous, axis).sub(previous);
    const resolvedBend = projectOntoPlane(resolved[index], previous, axis).sub(previous);
    if (preferredBend.lengthSq() < 1e-8 || resolvedBend.lengthSq() < 1e-8) continue;
    minimum = Math.min(minimum, preferredBend.normalize().dot(resolvedBend.normalize()));
  }
  return minimum;
}

function transformBodyPoint(point: Vector3, pivot: Vector3, rotation: Quaternion, offset: Vector3): Vector3 {
  return point.sub(pivot).applyQuaternion(rotation).add(pivot).add(offset);
}

function toTuple(vector: Vector3): HorseVector3Tuple {
  return [vector.x, vector.y, vector.z];
}

function toQuaternionTuple(quaternion: Quaternion): HorseQuaternionTuple {
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}
