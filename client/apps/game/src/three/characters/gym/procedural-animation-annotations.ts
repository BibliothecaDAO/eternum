import type { ProceduralUnitPoseDiagnostics } from "../procedural-unit-diagnostics";
import type { ProceduralAnimationCaptureView } from "./procedural-animation-capture";

export type ProceduralAnimationAnnotationTone = "equipment" | "left" | "neutral" | "right" | "stance" | "swing";
export type ProceduralAnimationAnnotationPoint = readonly [number, number, number];

export interface ProceduralAnimationAnnotationMarker {
  id: number;
  label: string;
  position: ProceduralAnimationAnnotationPoint;
  tone: ProceduralAnimationAnnotationTone;
  value?: string;
}

export interface ProceduralAnimationAnnotationAngle {
  position: ProceduralAnimationAnnotationPoint;
  tone: ProceduralAnimationAnnotationTone;
  value: string;
}

export interface ProceduralAnimationAnnotationSegment {
  end: ProceduralAnimationAnnotationPoint;
  start: ProceduralAnimationAnnotationPoint;
  tone: ProceduralAnimationAnnotationTone;
}

export interface ProceduralAnimationAnnotationMetric {
  label: string;
  value: string;
}

export interface ProceduralAnimationFrameAnnotations {
  angles: readonly ProceduralAnimationAnnotationAngle[];
  header: string;
  issues: readonly string[];
  markers: readonly ProceduralAnimationAnnotationMarker[];
  metrics: readonly ProceduralAnimationAnnotationMetric[];
  segments: readonly ProceduralAnimationAnnotationSegment[];
  subheader: string;
}

interface AnnotationFragment {
  angles: ProceduralAnimationAnnotationAngle[];
  markers: ProceduralAnimationAnnotationMarker[];
  metrics: ProceduralAnimationAnnotationMetric[];
  segments: ProceduralAnimationAnnotationSegment[];
}

interface CreateProceduralAnimationFrameAnnotationsInput {
  diagnostics: ProceduralUnitPoseDiagnostics;
  elapsedSeconds: number;
  expectedPhase: string;
  frameIndex: number;
  issues: readonly string[];
  runtimePhase: string;
  view: ProceduralAnimationCaptureView;
}

const EMPTY_FRAGMENT: AnnotationFragment = { angles: [], markers: [], metrics: [], segments: [] };

export function createProceduralAnimationFrameAnnotations(
  input: CreateProceduralAnimationFrameAnnotationsInput,
): ProceduralAnimationFrameAnnotations {
  const humanoid = input.diagnostics.humanoid ? createHumanoidAnnotationFragment(input.diagnostics) : EMPTY_FRAGMENT;
  const horse = input.diagnostics.horse ? createHorseAnnotationFragment(input.diagnostics) : EMPTY_FRAGMENT;
  const equipment = createEquipmentAnnotationFragment(input.diagnostics);
  return {
    angles: [...humanoid.angles, ...horse.angles, ...equipment.angles],
    header: `${input.diagnostics.kind.toUpperCase()} · F${String(input.frameIndex).padStart(3, "0")} · ${input.view.label.toUpperCase()}`,
    issues: input.issues,
    markers: [...humanoid.markers, ...horse.markers, ...equipment.markers],
    metrics: [...humanoid.metrics, ...horse.metrics, ...equipment.metrics],
    segments: [...humanoid.segments, ...horse.segments, ...equipment.segments],
    subheader: `${input.elapsedSeconds.toFixed(3)}s · expected ${input.expectedPhase} · runtime ${input.runtimePhase}`,
  };
}

function createHumanoidAnnotationFragment(diagnostics: ProceduralUnitPoseDiagnostics): AnnotationFragment {
  const humanoid = diagnostics.humanoid;
  if (!humanoid) return EMPTY_FRAGMENT;
  const { joints } = humanoid;
  const solverMarkers = createSolverTargetMarkers(humanoid);
  return {
    angles: [],
    markers: [
      marker(1, "head", joints.head, "neutral"),
      marker(2, "pelvis", joints.pelvis, "neutral"),
      marker(3, "L shoulder", joints.shoulderLeft, "left"),
      marker(4, "L elbow", joints.elbowLeft, "left", degrees(humanoid.arms.left.elbowDegrees)),
      marker(5, "L wrist", joints.wristLeft, "left"),
      marker(6, "R shoulder", joints.shoulderRight, "right"),
      marker(7, "R elbow", joints.elbowRight, "right", degrees(humanoid.arms.right.elbowDegrees)),
      marker(8, "R wrist", joints.wristRight, "right"),
      marker(9, "L knee", joints.kneeLeft, "left", degrees(humanoid.legs.left.kneeDegrees)),
      marker(10, "L ankle", joints.ankleLeft, humanoid.feet.left.contact, humanoid.feet.left.contact.toUpperCase()),
      marker(11, "R knee", joints.kneeRight, "right", degrees(humanoid.legs.right.kneeDegrees)),
      marker(12, "R ankle", joints.ankleRight, humanoid.feet.right.contact, humanoid.feet.right.contact.toUpperCase()),
      ...solverMarkers.markers,
    ],
    metrics: [
      metric("L elbow", degrees(humanoid.arms.left.elbowDegrees)),
      metric("R elbow", degrees(humanoid.arms.right.elbowDegrees)),
      metric("L knee", degrees(humanoid.legs.left.kneeDegrees)),
      metric("R knee", degrees(humanoid.legs.right.kneeDegrees)),
      metric("L palm", signed(humanoid.palmInwardDot.left)),
      metric("R palm", signed(humanoid.palmInwardDot.right)),
      metric("L socket Δ", distance(humanoid.arms.left.solverSocketError)),
      metric("R socket Δ", distance(humanoid.arms.right.solverSocketError)),
      metric(
        "foot contacts",
        `${Number(humanoid.feet.left.contact === "stance") + Number(humanoid.feet.right.contact === "stance")}/2`,
      ),
    ],
    segments: [
      ...chainSegments([joints.pelvis, joints.chest, joints.head], "neutral"),
      ...chainSegments([joints.shoulderLeft, joints.elbowLeft, joints.wristLeft], "left"),
      ...chainSegments([joints.shoulderRight, joints.elbowRight, joints.wristRight], "right"),
      ...chainSegments([joints.hipLeft, joints.kneeLeft, joints.ankleLeft], "left"),
      ...chainSegments([joints.hipRight, joints.kneeRight, joints.ankleRight], "right"),
      ...solverMarkers.segments,
    ],
  };
}

function createSolverTargetMarkers(
  humanoid: NonNullable<ProceduralUnitPoseDiagnostics["humanoid"]>,
): Pick<AnnotationFragment, "markers" | "segments"> {
  const markers: ProceduralAnimationAnnotationMarker[] = [];
  const segments: ProceduralAnimationAnnotationSegment[] = [];
  (["left", "right"] as const).forEach((side, index) => {
    const error = humanoid.arms[side].solverSocketError ?? 0;
    if (error <= 0.05) return;
    const wrist = side === "left" ? humanoid.joints.wristLeft : humanoid.joints.wristRight;
    const target = humanoid.solverWristTargets[side];
    const tone = side;
    markers.push(marker(16 + index, `${side[0].toUpperCase()} solver target`, target, tone, distance(error)));
    segments.push(...chainSegments([wrist, target], tone));
  });
  return { markers, segments };
}

function createHorseAnnotationFragment(diagnostics: ProceduralUnitPoseDiagnostics): AnnotationFragment {
  const horse = diagnostics.horse;
  if (!horse) return EMPTY_FRAGMENT;
  const hoofIds = ["frontLeft", "frontRight", "hindLeft", "hindRight"] as const;
  const hoofLabels = { frontLeft: "FL hoof", frontRight: "FR hoof", hindLeft: "HL hoof", hindRight: "HR hoof" };
  const markers = [
    marker(20, "horse head", horse.headWorld, "neutral"),
    marker(21, "saddle", horse.saddleWorld, "neutral"),
  ];
  const angles: ProceduralAnimationAnnotationAngle[] = [];
  const segments: ProceduralAnimationAnnotationSegment[] = [];
  hoofIds.forEach((hoofId, index) => {
    const leg = horse.legs[hoofId];
    const tone = leg.contact;
    markers.push(marker(22 + index, hoofLabels[hoofId], leg.hoofWorld, tone, leg.contact.toUpperCase()));
    const chain = [...leg.jointsWorld, leg.hoofWorld];
    segments.push(...chainSegments(chain, tone));
    leg.jointAnglesDegrees.forEach((angle, angleIndex) => {
      const position = chain[angleIndex + 1];
      if (position) angles.push({ position, tone, value: degrees(angle) });
    });
  });
  return {
    angles,
    markers,
    metrics: [
      metric("gait", horse.gait),
      metric("cycle", `${Math.round(horse.phase * 100)}%`),
      metric("stance", `${horse.stanceHoofCount}/4`),
      metric("min bend", minimumHorseBend(diagnostics).toFixed(3)),
    ],
    segments,
  };
}

function createEquipmentAnnotationFragment(diagnostics: ProceduralUnitPoseDiagnostics): AnnotationFragment {
  if (diagnostics.bow) return createBowAnnotationFragment(diagnostics);
  if (diagnostics.crossbow) return createCrossbowAnnotationFragment(diagnostics);
  if (diagnostics.melee) return createMeleeAnnotationFragment(diagnostics);
  return EMPTY_FRAGMENT;
}

function createCrossbowAnnotationFragment(diagnostics: ProceduralUnitPoseDiagnostics): AnnotationFragment {
  const crossbow = diagnostics.crossbow;
  if (!crossbow) return EMPTY_FRAGMENT;
  return {
    angles: [],
    markers: [
      marker(13, "crossbow", crossbow.centerWorld, "equipment"),
      marker(14, "L crossbow grip", crossbow.leftGripWorld, "equipment"),
      marker(15, "R crossbow grip", crossbow.rightGripWorld, "equipment"),
      marker(30, "left limb", crossbow.leftLimbWorld, "equipment"),
      marker(31, "right limb", crossbow.rightLimbWorld, "equipment"),
    ],
    metrics: [
      metric("L grip Δ", distance(crossbow.leftGripHandDistance)),
      metric("R grip Δ", distance(crossbow.rightGripHandDistance)),
      metric("crossbow span", distance(crossbow.span)),
    ],
    segments: [
      ...chainSegments([crossbow.leftLimbWorld, crossbow.rightLimbWorld], "equipment"),
      ...chainSegments([crossbow.centerWorld, crossbow.stockTipWorld], "equipment"),
    ],
  };
}

function createBowAnnotationFragment(diagnostics: ProceduralUnitPoseDiagnostics): AnnotationFragment {
  const bow = diagnostics.bow;
  if (!bow) return EMPTY_FRAGMENT;
  const arrowEnd = addScaled(bow.nockWorld, bow.arrowDirectionWorld, 1.15);
  return {
    angles: [],
    markers: [
      marker(13, "bow grip", bow.bowGripWorld, "equipment"),
      marker(14, "nock", bow.nockWorld, "equipment"),
      marker(15, "arrow", arrowEnd, "equipment"),
    ],
    metrics: [
      metric("arrow/head", distance(bow.arrowHeadClearance)),
      metric("bow grip Δ", distance(bow.bowGripHandDistance)),
      metric("draw grip Δ", distance(bow.drawGripHandDistance)),
      metric("grip/head", distance(bow.bowGripHeadDistance)),
      metric("nock/jaw", distance(bow.nockJawDistance)),
    ],
    segments: [
      ...chainSegments([bow.upperTipWorld, bow.nockWorld, bow.lowerTipWorld], "equipment"),
      ...chainSegments([bow.nockWorld, arrowEnd], "equipment"),
    ],
  };
}

function createMeleeAnnotationFragment(diagnostics: ProceduralUnitPoseDiagnostics): AnnotationFragment {
  const melee = diagnostics.melee;
  if (!melee) return EMPTY_FRAGMENT;
  return {
    angles: [],
    markers: [
      marker(13, "weapon grip", melee.weaponGripWorld, "equipment"),
      marker(14, "weapon tip", melee.weaponTipWorld, "equipment"),
      ...(melee.offhandGripWorld ? [marker(15, "offhand grip", melee.offhandGripWorld, "equipment")] : []),
      ...(melee.offhandWorld ? [marker(30, "offhand center", melee.offhandWorld, "equipment")] : []),
    ],
    metrics: [
      metric("weapon", melee.weaponId),
      metric("weapon grip Δ", distance(melee.weaponGripHandDistance)),
      metric("offhand grip Δ", distance(melee.offhandGripHandDistance)),
      metric("weapon length", distance(melee.weaponLength)),
      metric("weapon/head", distance(melee.weaponHeadClearance)),
      metric("weapon/offhand", distance(melee.weaponOffhandClearance)),
    ],
    segments: [
      ...chainSegments([melee.weaponGripWorld, melee.weaponTipWorld], "equipment"),
      ...(melee.offhandGripWorld && melee.offhandWorld
        ? chainSegments([melee.offhandGripWorld, melee.offhandWorld], "equipment")
        : []),
    ],
  };
}

function marker(
  id: number,
  label: string,
  position: ProceduralAnimationAnnotationPoint,
  tone: ProceduralAnimationAnnotationTone,
  value?: string,
): ProceduralAnimationAnnotationMarker {
  return { id, label, position, tone, ...(value && { value }) };
}

function metric(label: string, value: string): ProceduralAnimationAnnotationMetric {
  return { label, value };
}

function chainSegments(
  points: readonly ProceduralAnimationAnnotationPoint[],
  tone: ProceduralAnimationAnnotationTone,
): ProceduralAnimationAnnotationSegment[] {
  return points.slice(1).map((end, index) => ({ end, start: points[index], tone }));
}

function addScaled(
  origin: ProceduralAnimationAnnotationPoint,
  direction: ProceduralAnimationAnnotationPoint,
  scale: number,
): ProceduralAnimationAnnotationPoint {
  return [origin[0] + direction[0] * scale, origin[1] + direction[1] * scale, origin[2] + direction[2] * scale];
}

function minimumHorseBend(diagnostics: ProceduralUnitPoseDiagnostics): number {
  if (!diagnostics.horse) return 1;
  return Math.min(...Object.values(diagnostics.horse.legs).map(({ bendAlignment }) => bendAlignment));
}

function degrees(value: number): string {
  return `${value.toFixed(1)}°`;
}

function distance(value: number | null | undefined): string {
  return value === null || value === undefined ? "--" : value.toFixed(3);
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}
