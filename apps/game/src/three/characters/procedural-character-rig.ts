import type { CharacterFootGeometry } from "./procedural-character-foot-roll";
import type { ProceduralCharacterConfig } from "./procedural-character-config";

export const CHARACTER_PART_IDS = [
  "pelvis",
  "chest",
  "head",
  "upperArmLeft",
  "forearmLeft",
  "upperArmRight",
  "forearmRight",
  "thighLeft",
  "shinLeft",
  "thighRight",
  "shinRight",
] as const;

export type CharacterPartId = (typeof CHARACTER_PART_IDS)[number];
type CharacterSide = "left" | "right";
type CharacterJointKind = "hinge" | "swing-twist";

export interface CharacterMorphology {
  foot: CharacterFootGeometry;
  scale: number;
  shoulderWidth: number;
  hipWidth: number;
  torsoLength: number;
  upperArmLength: number;
  forearmLength: number;
  thighLength: number;
  shinLength: number;
  headRadius: number;
}

export interface CharacterPartDefinition {
  id: CharacterPartId;
  parentId?: CharacterPartId;
  jointKind?: CharacterJointKind;
  shape: "box" | "capsule" | "sphere";
  radius?: number;
  length?: number;
  halfExtents?: readonly [number, number, number];
  mass: number;
  surface: "accent" | "cloth" | "metal";
}

export interface CharacterSourceBodyMeasurements {
  headRadius: number;
  shoulderWidth: number;
  hipWidth: number;
  pelvisToChest: number;
  chestToNeck: number;
}

export interface ResolvedCharacterRig {
  morphology: CharacterMorphology;
  parts: Readonly<Record<CharacterPartId, CharacterPartDefinition>>;
}

/** Torso boxes are sized from the body's width and height by these ratios, for the nominal and a measured figure alike. */
const PELVIS_HALF_WIDTH_PER_HIP_WIDTH = 0.52;
const CHEST_HALF_WIDTH_PER_SHOULDER_WIDTH = 0.43;
const CHEST_HALF_HEIGHT_PER_TORSO_LENGTH = 0.46;
/** The pelvis box ends this fraction of the chest's half height below the chest centre, so the two boxes overlap. */
const PELVIS_CHEST_OVERLAP = 0.9;

interface MeasuredCharacterLengths {
  forearmLength: number;
  shinLength: number;
  thighLength: number;
  upperArmLength: number;
  foot: CharacterFootGeometry;
  body?: CharacterSourceBodyMeasurements;
}

export function applyCharacterRigLimbLengths(
  rig: ResolvedCharacterRig,
  lengths: MeasuredCharacterLengths,
): ResolvedCharacterRig {
  const fitted = fitRigLimbs(rig, lengths);
  if (!lengths.body) return fitted;
  const sizeRelativeToNominal =
    (lengths.thighLength + lengths.shinLength) / (rig.morphology.thighLength + rig.morphology.shinLength);
  return fitRigToSourceBody(fitted, lengths.body, sizeRelativeToNominal);
}

/** Arm and leg lengths, and the foot, from the skeleton the rig will drive. */
function fitRigLimbs(rig: ResolvedCharacterRig, lengths: MeasuredCharacterLengths): ResolvedCharacterRig {
  const upperArmLength = resolveMeasuredLength(lengths.upperArmLength, rig.morphology.upperArmLength);
  const forearmLength = resolveMeasuredLength(lengths.forearmLength, rig.morphology.forearmLength);
  const rigLegLength = rig.morphology.thighLength + rig.morphology.shinLength;
  const measuredLegLength = lengths.thighLength + lengths.shinLength;
  const thighRatio = measuredLegLength > 0.1 ? lengths.thighLength / measuredLegLength : 0.5;
  // A source body is measured as it is; otherwise the rig keeps its own leg length in the measured proportion.
  const thighLength = lengths.body ? lengths.thighLength : rigLegLength * thighRatio;
  const shinLength = lengths.body ? lengths.shinLength : rigLegLength - thighLength;
  return {
    morphology: { ...rig.morphology, forearmLength, shinLength, thighLength, upperArmLength, foot: lengths.foot },
    parts: {
      ...rig.parts,
      forearmLeft: { ...rig.parts.forearmLeft, length: forearmLength },
      forearmRight: { ...rig.parts.forearmRight, length: forearmLength },
      shinLeft: { ...rig.parts.shinLeft, length: shinLength },
      shinRight: { ...rig.parts.shinRight, length: shinLength },
      thighLeft: { ...rig.parts.thighLeft, length: thighLength },
      thighRight: { ...rig.parts.thighRight, length: thighLength },
      upperArmLeft: { ...rig.parts.upperArmLeft, length: upperArmLength },
      upperArmRight: { ...rig.parts.upperArmRight, length: upperArmLength },
    },
  };
}

/** Body widths, torso, head and overall size from a figure measured at its own size. */
function fitRigToSourceBody(
  rig: ResolvedCharacterRig,
  body: CharacterSourceBodyMeasurements,
  sizeRelativeToNominal: number,
): ResolvedCharacterRig {
  const pelvisHalfHeight = body.pelvisToChest - body.chestToNeck * PELVIS_CHEST_OVERLAP;
  const dimensions = [
    rig.morphology.thighLength,
    rig.morphology.shinLength,
    body.shoulderWidth,
    body.hipWidth,
    body.pelvisToChest,
    body.chestToNeck,
    body.headRadius,
    pelvisHalfHeight,
  ];
  if (!dimensions.every(isValidSourceDimension)) throw new Error("Invalid source body morphology measurements");
  return {
    morphology: {
      ...rig.morphology,
      // The pose controller sizes its offsets by `scale`: a figure measured from its own skeleton is that much of nominal.
      scale: rig.morphology.scale * sizeRelativeToNominal,
      shoulderWidth: body.shoulderWidth,
      hipWidth: body.hipWidth,
      torsoLength: body.chestToNeck / CHEST_HALF_HEIGHT_PER_TORSO_LENGTH,
      headRadius: body.headRadius,
    },
    parts: {
      ...rig.parts,
      pelvis: {
        ...rig.parts.pelvis,
        halfExtents: [
          body.hipWidth * PELVIS_HALF_WIDTH_PER_HIP_WIDTH,
          pelvisHalfHeight,
          requireBoxHalfDepth(rig.parts.pelvis),
        ],
      },
      chest: {
        ...rig.parts.chest,
        halfExtents: [
          body.shoulderWidth * CHEST_HALF_WIDTH_PER_SHOULDER_WIDTH,
          body.chestToNeck,
          requireBoxHalfDepth(rig.parts.chest),
        ],
      },
      head: { ...rig.parts.head, radius: body.headRadius },
    },
  };
}

function requireBoxHalfDepth(part: CharacterPartDefinition): number {
  const depth = part.halfExtents?.[2];
  if (depth === undefined) throw new Error(`Character part ${part.id} has no box depth`);
  return depth;
}

function isValidSourceDimension(value: number | undefined): boolean {
  return Number.isFinite(value) && (value ?? 0) > 0;
}

export function resolveCharacterRig(config: ProceduralCharacterConfig): ResolvedCharacterRig {
  const random = createDeterministicRandom(config.seed);
  const scale = 0.94 + random() * 0.12;
  const build = 0.92 + random() * 0.18 + (config.tier - 1) * 0.025;
  const morphology: CharacterMorphology = {
    foot: { ankleHeight: 0.11 * scale, heelLength: 0.074 * scale, ballLength: 0.185 * scale },
    scale,
    shoulderWidth: 0.68 * build * scale,
    hipWidth: 0.4 * (0.96 + random() * 0.08) * scale,
    torsoLength: 0.58 * (0.96 + random() * 0.08) * scale,
    upperArmLength: 0.42 * (0.95 + random() * 0.1) * scale,
    forearmLength: 0.4 * (0.95 + random() * 0.1) * scale,
    thighLength: 0.58 * (0.96 + random() * 0.08) * scale,
    shinLength: 0.56 * (0.96 + random() * 0.08) * scale,
    headRadius: 0.17 * (0.96 + random() * 0.08) * scale,
  };
  const limbScale = morphology.scale;
  const partList: CharacterPartDefinition[] = [
    {
      id: "pelvis",
      shape: "box",
      halfExtents: [morphology.hipWidth * PELVIS_HALF_WIDTH_PER_HIP_WIDTH, 0.16 * limbScale, 0.16 * limbScale],
      mass: 2.8,
      surface: "cloth",
    },
    {
      id: "chest",
      parentId: "pelvis",
      jointKind: "swing-twist",
      shape: "box",
      halfExtents: [
        morphology.shoulderWidth * CHEST_HALF_WIDTH_PER_SHOULDER_WIDTH,
        morphology.torsoLength * CHEST_HALF_HEIGHT_PER_TORSO_LENGTH,
        0.17 * limbScale,
      ],
      mass: 4.2,
      surface: "metal",
    },
    {
      id: "head",
      parentId: "chest",
      jointKind: "swing-twist",
      shape: "sphere",
      radius: morphology.headRadius,
      mass: 1.1,
      surface: "accent",
    },
    ...createArmDefinitions("left", morphology),
    ...createArmDefinitions("right", morphology),
    ...createLegDefinitions("left", morphology),
    ...createLegDefinitions("right", morphology),
  ];

  return {
    morphology,
    parts: Object.fromEntries(partList.map((part) => [part.id, part])) as Record<
      CharacterPartId,
      CharacterPartDefinition
    >,
  };
}

function createArmDefinitions(side: CharacterSide, morphology: CharacterMorphology): CharacterPartDefinition[] {
  const suffix = side === "left" ? "Left" : "Right";
  const upperId = `upperArm${suffix}` as CharacterPartId;
  return [
    {
      id: upperId,
      parentId: "chest",
      jointKind: "swing-twist",
      shape: "capsule",
      radius: 0.082 * morphology.scale,
      length: morphology.upperArmLength,
      mass: 1.05,
      surface: "metal",
    },
    {
      id: `forearm${suffix}` as CharacterPartId,
      parentId: upperId,
      jointKind: "hinge",
      shape: "capsule",
      radius: 0.07 * morphology.scale,
      length: morphology.forearmLength,
      mass: 0.8,
      surface: "cloth",
    },
  ];
}

function createLegDefinitions(side: CharacterSide, morphology: CharacterMorphology): CharacterPartDefinition[] {
  const suffix = side === "left" ? "Left" : "Right";
  const thighId = `thigh${suffix}` as CharacterPartId;
  return [
    {
      id: thighId,
      parentId: "pelvis",
      jointKind: "swing-twist",
      shape: "capsule",
      radius: 0.105 * morphology.scale,
      length: morphology.thighLength,
      mass: 1.8,
      surface: "metal",
    },
    {
      id: `shin${suffix}` as CharacterPartId,
      parentId: thighId,
      jointKind: "hinge",
      shape: "capsule",
      radius: 0.087 * morphology.scale,
      length: morphology.shinLength,
      mass: 1.3,
      surface: "cloth",
    },
  ];
}

function resolveMeasuredLength(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0.05 ? value : fallback;
}

function createDeterministicRandom(seed: number): () => number {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}
