import type { HumanoidRigAdapterId } from "../humanoid-rig-adapters";
import type { ProceduralUnitKind } from "../procedural-unit-config";
import {
  isOptionalCharacterSocketId,
  type CharacterSocketId,
  type OptionalCharacterSocketId,
} from "../procedural-character-sockets";
import {
  T1_KNIGHT_DEFAULT_BODY_POSES,
  T1_KNIGHT_DEFAULT_SHIELD_ARM_POSES,
  T1_KNIGHT_DEFAULT_SWORD_ARM_POSES,
} from "./t1-knight-default-gear-poses";

export type ProceduralMeleeOffhandSocket = Extract<CharacterSocketId, "gripLeft" | OptionalCharacterSocketId>;

export type ProceduralMeleeWeaponId =
  | "iron-longsword"
  | "runic-warhammer"
  | "winter-broadaxe"
  | "winter-rider-battleaxe"
  | "t1-knight-default-sword";

export type ProceduralMeleeOffhandId =
  | "none"
  | "round-shield"
  | "winter-rider-shield"
  | "winter-targe"
  | "light-cavalry-shield"
  | "t1-knight-default-shield";

/**
 * Where an arm holds gear that was fitted to a rig, in metres in that rig's own frame, relative to the chest (the point
 * midway between its shoulder joints; +X left, +Y up, +Z forward): the wrist, the point the elbow bends toward, and the
 * hand's turn relative to the forearm (x, y, z, w). No `scale` factor: fitted gear is only ever worn by its own rig at
 * its own size, which the assembly check already guarantees. Compared with `poses.json` by a test.
 */
export interface ProceduralMeleeArmPose {
  elbow: readonly [number, number, number];
  handTurn: readonly [number, number, number, number];
  wrist: readonly [number, number, number];
}

/**
 * Where the body is held, in degrees and in metres for the rig the gear was fitted to, in the actor's frame (+X left, +Y
 * up, +Z forward). Pelvis: yaw (left positive), pitch (leaning forward positive), roll (the left side down positive),
 * height as a fraction of its rest height, and its place forward and left of the midpoint between the ankles. Spine:
 * the chest against the pelvis (flex is its pitch, twist its yaw, side its roll). Head: against the chest. Stance:
 * each ankle forward and left of that midpoint, and the toes' yaw.
 */
export interface ProceduralMeleeBodyPose {
  head: { pitch: number; yaw: number };
  pelvis: { forward: number; height: number; left: number; pitch: number; roll: number; yaw: number };
  spine: { flex: number; side: number; twist: number };
  stance: Readonly<Record<"left" | "right", ProceduralMeleeFootPlacement>>;
}

export interface ProceduralMeleeFootPlacement {
  forward: number;
  left: number;
  yaw: number;
}

/** The attacks a weapon makes. Gear that declares no attack states makes one, named by its `attackStyle`. */
export type ProceduralMeleeAttackVariantId = ProceduralMeleeAttackStyle | "backhand" | "cut" | "thrust";

/** One attack's three moments. */
export interface ProceduralMeleeAttackMoments<T> {
  contact: T;
  follow: T;
  windup: T;
}

/**
 * The states gear fitted to a rig holds the bearer in, one record shape for the arms and the body: idle variants (one
 * per unit, chosen by its seed), the standing guard, the guard while running, the hit reaction, and each attack
 * variant's moments in the order the bearer makes them.
 */
export interface ProceduralMeleeStates<T> {
  attacks: Readonly<Partial<Record<ProceduralMeleeAttackVariantId, ProceduralMeleeAttackMoments<T>>>>;
  guard: T;
  hit: T;
  idle: readonly T[];
  runGuard: T;
}

/** The body also declares the guard while walking; the arms walk at `guard`. */
export type ProceduralMeleeBodyStates = ProceduralMeleeStates<ProceduralMeleeBodyPose> & {
  walkGuard: ProceduralMeleeBodyPose;
};

export type ProceduralMeleeAttackStyle = "chop" | "slash" | "smash";

export interface ProceduralMeleeAssetAlignment {
  axis?: "x" | "y" | "z";
  pivot: "axis-max" | "axis-min" | "center" | "authored";
  rotation?: readonly [number, number, number];
}

export interface ProceduralMeleeWeaponDefinition {
  attackStyle: ProceduralMeleeAttackStyle;
  assetAlignment?: ProceduralMeleeAssetAlignment;
  compatibleKinds: readonly Extract<ProceduralUnitKind, "knight" | "paladin">[];
  /** The sword arm's states, for gear fitted to a rig. */
  armPoses?: ProceduralMeleeStates<ProceduralMeleeArmPose>;
  /** The body's states, for gear fitted to a rig; their attack variants are the attacks the weapon makes. */
  bodyPoses?: ProceduralMeleeBodyStates;
  /** Set when the gear was fitted to one rig's hand and cannot be worn on another. */
  fittedRigAdapterId?: HumanoidRigAdapterId;
  id: ProceduralMeleeWeaponId;
  label: string;
  registryEntryId?: string;
  visualLength: number;
}

export interface ProceduralMeleeOffhandDefinition {
  attachmentSocket?: ProceduralMeleeOffhandSocket;
  assetAlignment?: ProceduralMeleeAssetAlignment;
  compatibleKinds: readonly Extract<ProceduralUnitKind, "knight" | "paladin">[];
  /** The shield arm's states, for gear fitted to a rig. */
  armPoses?: ProceduralMeleeStates<ProceduralMeleeArmPose>;
  /** Set when the gear was fitted to one rig's forearm and cannot be worn on another. */
  fittedRigAdapterId?: HumanoidRigAdapterId;
  gripToCenter: readonly [number, number, number];
  id: ProceduralMeleeOffhandId;
  label: string;
  registryEntryId?: string;
  visualDiameter: number;
}

const MELEE_KINDS = ["knight", "paladin"] as const;

export const PROCEDURAL_MELEE_WEAPONS: readonly ProceduralMeleeWeaponDefinition[] = [
  {
    attackStyle: "slash",
    armPoses: T1_KNIGHT_DEFAULT_SWORD_ARM_POSES,
    assetAlignment: { pivot: "authored" },
    bodyPoses: T1_KNIGHT_DEFAULT_BODY_POSES,
    compatibleKinds: ["knight"],
    fittedRigAdapterId: "t1-knight-default",
    id: "t1-knight-default-sword",
    label: "T1 Knight Default sword",
    visualLength: 0.298393189907074, // sword.glb bounds: blade tip on +Y from the grip centre
  },
  {
    attackStyle: "slash",
    compatibleKinds: MELEE_KINDS,
    id: "iron-longsword",
    label: "Iron Longsword",
    visualLength: 0.9,
  },
  {
    attackStyle: "smash",
    compatibleKinds: MELEE_KINDS,
    id: "runic-warhammer",
    label: "Runic Warhammer",
    visualLength: 0.82,
  },
  {
    attackStyle: "chop",
    assetAlignment: { axis: "z", pivot: "axis-max", rotation: [Math.PI / 2, 0, 0] },
    compatibleKinds: MELEE_KINDS,
    id: "winter-broadaxe",
    label: "Winter Trooper Broadaxe",
    registryEntryId: "attachment:knight:winter-primary",
    visualLength: 0.94,
  },
  {
    attackStyle: "chop",
    assetAlignment: { axis: "y", pivot: "axis-max", rotation: [0, 0, Math.PI] },
    compatibleKinds: MELEE_KINDS,
    id: "winter-rider-battleaxe",
    label: "Winter Rider Battleaxe",
    registryEntryId: "attachment:paladin:winter-primary",
    visualLength: 1,
  },
] as const;

export const PROCEDURAL_MELEE_OFFHANDS: readonly ProceduralMeleeOffhandDefinition[] = [
  {
    armPoses: T1_KNIGHT_DEFAULT_SHIELD_ARM_POSES,
    attachmentSocket: "forearmLeft",
    assetAlignment: { pivot: "authored" },
    compatibleKinds: ["knight"],
    fittedRigAdapterId: "t1-knight-default",
    gripToCenter: [0, 0, 0],
    id: "t1-knight-default-shield",
    label: "T1 Knight Default shield",
    visualDiameter: 0.250672, // shield.glb bounds: x extent of the round face
  },
  {
    compatibleKinds: MELEE_KINDS,
    gripToCenter: [0, 0, 0],
    id: "none",
    label: "No Offhand",
    visualDiameter: 0,
  },
  {
    compatibleKinds: MELEE_KINDS,
    gripToCenter: [0, 0, 0.18],
    id: "round-shield",
    label: "Round Shield",
    visualDiameter: 0.64,
  },
  {
    assetAlignment: { pivot: "center" },
    compatibleKinds: MELEE_KINDS,
    gripToCenter: [0, 0, 0.185],
    id: "winter-targe",
    label: "Winter Trooper Targe",
    registryEntryId: "attachment:knight:winter-secondary",
    visualDiameter: 0.68,
  },
  {
    assetAlignment: { pivot: "center", rotation: [0, -Math.PI / 2, 0] },
    compatibleKinds: MELEE_KINDS,
    gripToCenter: [0, 0, 0.19],
    id: "winter-rider-shield",
    label: "Winter Rider Shield",
    registryEntryId: "attachment:paladin:winter-secondary",
    visualDiameter: 0.7,
  },
  {
    assetAlignment: { pivot: "center" },
    compatibleKinds: MELEE_KINDS,
    gripToCenter: [0, 0, 0.18],
    id: "light-cavalry-shield",
    label: "Light Cavalry Shield",
    registryEntryId: "attachment:paladin:light-secondary",
    visualDiameter: 0.66,
  },
] as const;

export function resolveProceduralMeleeWeapon(id: ProceduralMeleeWeaponId): ProceduralMeleeWeaponDefinition {
  const definition = PROCEDURAL_MELEE_WEAPONS.find((weapon) => weapon.id === id);
  if (!definition) throw new Error(`Unknown procedural melee weapon: ${id}`);
  return definition;
}

export function resolveProceduralMeleeOffhand(id: ProceduralMeleeOffhandId): ProceduralMeleeOffhandDefinition {
  const definition = PROCEDURAL_MELEE_OFFHANDS.find((offhand) => offhand.id === id);
  if (!definition) throw new Error(`Unknown procedural melee offhand: ${id}`);
  return definition;
}

/** How the offhand is carried: in the fist, strapped along the forearm, or not at all. */
export type ProceduralMeleeOffhandCarry = "none" | "gripped" | "strapped";

export function resolveProceduralMeleeOffhandCarry(
  offhand: ProceduralMeleeOffhandDefinition,
): ProceduralMeleeOffhandCarry {
  if (offhand.id === "none") return "none";
  return offhand.attachmentSocket && isOptionalCharacterSocketId(offhand.attachmentSocket) ? "strapped" : "gripped";
}

/** Gear without a fitted rig fits every rig. */
export function isProceduralMeleeGearFittedToRig(
  gear: { fittedRigAdapterId?: HumanoidRigAdapterId },
  rigAdapterId: HumanoidRigAdapterId,
): boolean {
  return gear.fittedRigAdapterId === undefined || gear.fittedRigAdapterId === rigAdapterId;
}

/** The gear fitted to one rig, if any was made for it. */
export function resolveRigFittedMeleeLoadout(
  rigAdapterId: HumanoidRigAdapterId,
): { weaponId: ProceduralMeleeWeaponId; offhandId: ProceduralMeleeOffhandId } | undefined {
  const weapon = PROCEDURAL_MELEE_WEAPONS.find(({ fittedRigAdapterId }) => fittedRigAdapterId === rigAdapterId);
  const offhand = PROCEDURAL_MELEE_OFFHANDS.find(({ fittedRigAdapterId }) => fittedRigAdapterId === rigAdapterId);
  return weapon && offhand ? { weaponId: weapon.id, offhandId: offhand.id } : undefined;
}

export function resolveDefaultProceduralMeleeLoadout(kind: ProceduralUnitKind): {
  weaponId: ProceduralMeleeWeaponId;
  offhandId: ProceduralMeleeOffhandId;
} {
  if (kind === "paladin") return { weaponId: "runic-warhammer", offhandId: "round-shield" };
  return { weaponId: "iron-longsword", offhandId: "round-shield" };
}
