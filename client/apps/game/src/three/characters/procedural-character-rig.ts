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

export interface ResolvedCharacterRig {
  morphology: CharacterMorphology;
  parts: Readonly<Record<CharacterPartId, CharacterPartDefinition>>;
}

export function applyCharacterRigLimbLengths(
  rig: ResolvedCharacterRig,
  lengths: { forearmLength: number; shinLength: number; thighLength: number; upperArmLength: number },
): ResolvedCharacterRig {
  const upperArmLength = resolveMeasuredLength(lengths.upperArmLength, rig.morphology.upperArmLength);
  const forearmLength = resolveMeasuredLength(lengths.forearmLength, rig.morphology.forearmLength);
  const measuredLegLength = lengths.thighLength + lengths.shinLength;
  const rigLegLength = rig.morphology.thighLength + rig.morphology.shinLength;
  const thighRatio = measuredLegLength > 0.1 ? lengths.thighLength / measuredLegLength : 0.5;
  const thighLength = rigLegLength * thighRatio;
  const shinLength = rigLegLength - thighLength;
  const morphology = { ...rig.morphology, forearmLength, shinLength, thighLength, upperArmLength };
  return {
    morphology,
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

export function resolveCharacterRig(config: ProceduralCharacterConfig): ResolvedCharacterRig {
  const random = createDeterministicRandom(config.seed);
  const scale = 0.94 + random() * 0.12;
  const build = 0.92 + random() * 0.18 + (config.tier - 1) * 0.025;
  const morphology: CharacterMorphology = {
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
      halfExtents: [morphology.hipWidth * 0.52, 0.16 * limbScale, 0.16 * limbScale],
      mass: 2.8,
      surface: "cloth",
    },
    {
      id: "chest",
      parentId: "pelvis",
      jointKind: "swing-twist",
      shape: "box",
      halfExtents: [morphology.shoulderWidth * 0.43, morphology.torsoLength * 0.46, 0.17 * limbScale],
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
