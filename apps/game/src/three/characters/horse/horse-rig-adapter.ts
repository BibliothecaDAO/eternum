import { Bone, type Group } from "three";

import { HORSE_HOOF_IDS, type HorseHoofId } from "./procedural-horse-gait";

export const HORSE_LEG_SEGMENT_IDS = [
  "frontShoulderLeft",
  "frontUpperLeft",
  "frontLowerLeft",
  "frontShoulderRight",
  "frontUpperRight",
  "frontLowerRight",
  "hindShoulderLeft",
  "hindUpperLeft",
  "hindMiddleLeft",
  "hindLowerLeft",
  "hindShoulderRight",
  "hindUpperRight",
  "hindMiddleRight",
  "hindLowerRight",
] as const;

export type HorseLegSegmentId = (typeof HORSE_LEG_SEGMENT_IDS)[number];
export type HorseVector3Tuple = readonly [number, number, number];

export interface HorseLegRigDefinition {
  bones: readonly string[];
  hoof: string;
  segments: readonly HorseLegSegmentId[];
  target: string;
}

export interface HorseRigAdapter {
  axialBones: {
    chest: string;
    head: string;
    pelvis: string;
    root: string;
    spine: string;
    withers: string;
  };
  id: string;
  label: string;
  legs: Readonly<Record<HorseHoofId, HorseLegRigDefinition>>;
  neck: readonly string[];
  saddle: {
    offset: HorseVector3Tuple;
    pelvisToWithers: number;
  };
  tail: readonly string[];
}

export function resolveHorseRigRequiredBoneNames(adapter: HorseRigAdapter): string[] {
  const names = new Set(Object.values(adapter.axialBones));
  adapter.neck.forEach((name) => names.add(name));
  adapter.tail.forEach((name) => names.add(name));
  HORSE_HOOF_IDS.forEach((hoofId) => {
    const leg = adapter.legs[hoofId];
    leg?.bones.forEach((name) => names.add(name));
    if (leg?.hoof) names.add(leg.hoof);
    if (leg?.target) names.add(leg.target);
  });
  return [...names].filter(Boolean).sort();
}

export function validateHorseRigAdapter(adapter: HorseRigAdapter): string[] {
  const issues: string[] = [];
  if (!adapter.id.trim()) issues.push("missing-adapter-id");
  if (!adapter.label.trim()) issues.push("missing-adapter-label");
  Object.entries(adapter.axialBones).forEach(([role, name]) => {
    if (!name) issues.push(`missing-axial-bone:${role}`);
  });
  if (adapter.neck.length === 0 || adapter.neck.some((name) => !name)) issues.push("invalid-neck-chain");
  if (adapter.tail.length === 0 || adapter.tail.some((name) => !name)) issues.push("invalid-tail-chain");
  HORSE_HOOF_IDS.forEach((hoofId) => validateLeg(adapter.legs[hoofId], hoofId, issues));
  validateSegmentCoverage(adapter, issues);
  if (!isFiniteVector(adapter.saddle.offset)) issues.push("invalid-saddle-offset");
  if (
    !Number.isFinite(adapter.saddle.pelvisToWithers) ||
    adapter.saddle.pelvisToWithers < 0 ||
    adapter.saddle.pelvisToWithers > 1
  ) {
    issues.push("invalid-saddle-position");
  }
  return issues;
}

function validateSegmentCoverage(adapter: HorseRigAdapter, issues: string[]): void {
  const segmentCounts = new Map<HorseLegSegmentId, number>();
  HORSE_HOOF_IDS.forEach((hoofId) => {
    adapter.legs[hoofId]?.segments.forEach((segmentId) => {
      segmentCounts.set(segmentId, (segmentCounts.get(segmentId) ?? 0) + 1);
    });
  });
  HORSE_LEG_SEGMENT_IDS.forEach((segmentId) => {
    const count = segmentCounts.get(segmentId) ?? 0;
    if (count === 0) issues.push(`missing-segment:${segmentId}`);
    if (count > 1) issues.push(`duplicate-segment:${segmentId}`);
  });
}

export function requireHorseBone(scene: Group, name: string, adapter: HorseRigAdapter): Bone {
  const object = scene.getObjectByName(name);
  if (!(object instanceof Bone)) throw new Error(`${adapter.label} bone ${name} was not found`);
  return object;
}

function validateLeg(leg: HorseLegRigDefinition | undefined, hoofId: HorseHoofId, issues: string[]): void {
  if (!leg) {
    issues.push(`missing-leg:${hoofId}`);
    return;
  }
  if (leg.bones.length === 0 || leg.bones.some((name) => !name)) issues.push(`invalid-leg-chain:${hoofId}`);
  if (leg.bones.length !== leg.segments.length) issues.push(`leg-segment-count-mismatch:${hoofId}`);
  if (!leg.hoof) issues.push(`missing-hoof:${hoofId}`);
  if (!leg.target) issues.push(`missing-target:${hoofId}`);
}

function isFiniteVector(tuple: readonly number[]): boolean {
  return tuple.length === 3 && tuple.every(Number.isFinite);
}
