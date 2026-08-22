import { Vector3 } from "three";

import type { ProceduralBowPoseDiagnostics } from "./archer/procedural-bow-equipment";
import type { ProceduralCharacterPoseDiagnostics } from "./procedural-character-diagnostics";
import type { ProceduralHorsePoseDiagnostics } from "./horse/procedural-horse-diagnostics";
import type { ProceduralMeleePoseDiagnostics } from "./melee/procedural-melee-equipment";
import { resolveProceduralMeleeOffhand } from "./melee/procedural-melee-weapon-catalog";
import type { ProceduralUnitKind } from "./procedural-unit-config";
import type { ProceduralCrossbowPoseDiagnostics } from "./procedural-unit-equipment";

export interface ProceduralBowAlignmentDiagnostics extends ProceduralBowPoseDiagnostics {
  arrowHeadClearance: number;
  bowGripHandDistance: number | null;
  bowGripHeadDistance: number;
  drawGripHandDistance: number | null;
  nockJawDistance: number | null;
}

export interface ProceduralCrossbowAlignmentDiagnostics extends ProceduralCrossbowPoseDiagnostics {
  leftGripHandDistance: number | null;
  rightGripHandDistance: number | null;
}

export interface ProceduralMeleeAlignmentDiagnostics extends ProceduralMeleePoseDiagnostics {
  offhandGripHandDistance: number | null;
  weaponGripHandDistance: number | null;
  weaponHeadClearance: number | null;
  weaponLength: number;
  weaponOffhandClearance: number | null;
}

export interface ProceduralUnitPoseDiagnostics {
  bow: ProceduralBowAlignmentDiagnostics | null;
  crossbow: ProceduralCrossbowAlignmentDiagnostics | null;
  horse: ProceduralHorsePoseDiagnostics | null;
  humanoid: ProceduralCharacterPoseDiagnostics | null;
  issues: readonly string[];
  kind: ProceduralUnitKind;
  melee: ProceduralMeleeAlignmentDiagnostics | null;
}

export function resolveProceduralUnitPoseDiagnostics(input: {
  bow?: ProceduralBowPoseDiagnostics;
  crossbow?: ProceduralCrossbowPoseDiagnostics | null;
  horse?: ProceduralHorsePoseDiagnostics;
  humanoid?: ProceduralCharacterPoseDiagnostics;
  kind: ProceduralUnitKind;
  melee?: ProceduralMeleePoseDiagnostics | null;
}): ProceduralUnitPoseDiagnostics {
  const bow = input.bow && input.humanoid ? resolveBowAlignment(input.bow, input.humanoid) : null;
  const crossbow = input.crossbow ? resolveCrossbowAlignment(input.crossbow, input.humanoid) : null;
  const melee = input.melee ? resolveMeleeAlignment(input.melee, input.humanoid) : null;
  const issues = [...(input.humanoid?.issues ?? []), ...(input.horse?.issues ?? [])];
  if (melee && melee.weaponHeadClearance !== null && melee.weaponHeadClearance < -0.01) {
    issues.push("weapon-intersects-head");
  }
  if (melee && melee.weaponOffhandClearance !== null && melee.weaponOffhandClearance < -0.01) {
    issues.push("weapon-intersects-offhand");
  }
  const gripTolerance = (input.humanoid?.scale ?? 1) * 0.025;
  if (bow && bow.bowGripHandDistance !== null && bow.bowGripHandDistance > gripTolerance) {
    issues.push("bow-grip-detached");
  }
  if (bow && bow.drawGripHandDistance !== null && bow.drawGripHandDistance > gripTolerance) {
    issues.push("draw-grip-detached");
  }
  if (crossbow && crossbow.leftGripHandDistance !== null && crossbow.leftGripHandDistance > gripTolerance) {
    issues.push("left-crossbow-grip-detached");
  }
  if (crossbow && crossbow.rightGripHandDistance !== null && crossbow.rightGripHandDistance > gripTolerance) {
    issues.push("right-crossbow-grip-detached");
  }
  if (melee && melee.weaponGripHandDistance !== null && melee.weaponGripHandDistance > gripTolerance) {
    issues.push("weapon-grip-detached");
  }
  if (melee && melee.offhandGripHandDistance !== null && melee.offhandGripHandDistance > gripTolerance) {
    issues.push("offhand-grip-detached");
  }
  return {
    bow,
    crossbow,
    horse: input.horse ?? null,
    humanoid: input.humanoid ?? null,
    issues,
    kind: input.kind,
    melee,
  };
}

function resolveMeleeAlignment(
  melee: ProceduralMeleePoseDiagnostics,
  humanoid?: ProceduralCharacterPoseDiagnostics,
): ProceduralMeleeAlignmentDiagnostics {
  const grip = fromTuple(melee.weaponGripWorld);
  const tip = fromTuple(melee.weaponTipWorld);
  const head = humanoid ? fromTuple(humanoid.joints.head) : undefined;
  const offhandCenter = melee.offhandWorld ? fromTuple(melee.offhandWorld) : undefined;
  const offhandRadius = resolveProceduralMeleeOffhand(melee.offhandId).visualDiameter * 0.5;
  return {
    ...melee,
    offhandGripHandDistance: distanceBetween(melee.offhandGripWorld, humanoid?.socketGrips.left),
    weaponGripHandDistance: distanceBetween(melee.weaponGripWorld, humanoid?.socketGrips.right),
    weaponHeadClearance: head && humanoid ? round(distancePointToSegment(head, grip, tip) - humanoid.headRadius) : null,
    weaponLength: round(grip.distanceTo(tip)),
    weaponOffhandClearance: offhandCenter
      ? round(distancePointToSegment(offhandCenter, grip, tip) - offhandRadius)
      : null,
  };
}

function resolveBowAlignment(
  bow: ProceduralBowPoseDiagnostics,
  humanoid: ProceduralCharacterPoseDiagnostics,
): ProceduralBowAlignmentDiagnostics {
  const head = fromTuple(humanoid.joints.head);
  const grip = fromTuple(bow.bowGripWorld);
  const nock = fromTuple(bow.nockWorld);
  const arrowEnd = fromTuple(bow.arrowDirectionWorld).multiplyScalar(2).add(nock);
  const jaw = humanoid.jawAnchor ? fromTuple(humanoid.jawAnchor) : undefined;
  return {
    ...bow,
    arrowHeadClearance: round(distancePointToSegment(head, nock, arrowEnd) - humanoid.headRadius),
    bowGripHandDistance: distanceBetween(bow.bowGripWorld, humanoid.socketGrips?.left),
    bowGripHeadDistance: round(grip.distanceTo(head)),
    drawGripHandDistance: bow.previewArrowVisible ? distanceBetween(bow.nockWorld, humanoid.socketDrawGripRight) : null,
    nockJawDistance: jaw ? round(nock.distanceTo(jaw)) : null,
  };
}

function resolveCrossbowAlignment(
  crossbow: ProceduralCrossbowPoseDiagnostics,
  humanoid?: ProceduralCharacterPoseDiagnostics,
): ProceduralCrossbowAlignmentDiagnostics {
  return {
    ...crossbow,
    leftGripHandDistance: distanceBetween(crossbow.leftGripWorld, humanoid?.socketGrips?.left),
    rightGripHandDistance: distanceBetween(crossbow.rightGripWorld, humanoid?.socketGrips?.right),
  };
}

function distanceBetween(
  first: readonly [number, number, number] | null | undefined,
  second: readonly [number, number, number] | null | undefined,
): number | null {
  return first && second ? round(fromTuple(first).distanceTo(fromTuple(second))) : null;
}

function distancePointToSegment(point: Vector3, start: Vector3, end: Vector3): number {
  const segment = end.clone().sub(start);
  const lengthSquared = segment.lengthSq();
  if (lengthSquared < 1e-8) return point.distanceTo(start);
  const progress = Math.min(1, Math.max(0, point.clone().sub(start).dot(segment) / lengthSquared));
  return point.distanceTo(start.addScaledVector(segment, progress));
}

function fromTuple(tuple: readonly [number, number, number]): Vector3 {
  return new Vector3(tuple[0], tuple[1], tuple[2]);
}

function round(value: number): number {
  return Number(value.toFixed(4));
}
