import type { HumanoidRigAdapterId } from "../humanoid-rig-adapters";
import type { ProceduralUnitKind } from "../procedural-unit-config";
import {
  isOptionalCharacterSocketId,
  type CharacterSocketId,
  type OptionalCharacterSocketId,
} from "../procedural-character-sockets";

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

/** The states an arm moves between, in the order the attack blends them: carry, guard, windup, contact, follow. */
export type ProceduralMeleeArmPoseState = "carry" | "guard" | "windup" | "contact" | "follow";

/**
 * Where an arm holds gear that was fitted to a rig, in metres in that rig's own frame, relative to the chest (the point
 * midway between its shoulder joints; +X left, +Y up, +Z forward): the wrist, the point the elbow bends toward, and the
 * hand's turn relative to the forearm (x, y, z, w). No `scale` factor: fitted gear is only ever worn by its own rig at
 * its own size, which the assembly check already guarantees. Compared with `arm-poses.json` by a test.
 */
export interface ProceduralMeleeArmPose {
  elbow: readonly [number, number, number];
  handTurn: readonly [number, number, number, number];
  wrist: readonly [number, number, number];
}

/** The states an arm holds the gear in. `carry` and `guard` are always declared; a state after them it does not declare is not part of the blend. */
export type ProceduralMeleeArmPoses = Readonly<
  Record<"carry" | "guard", ProceduralMeleeArmPose> &
    Partial<Record<Exclude<ProceduralMeleeArmPoseState, "carry" | "guard">, ProceduralMeleeArmPose>>
>;

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
  /** The sword arm's poses, for gear fitted to a rig. */
  armPoses?: ProceduralMeleeArmPoses;
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
  /** The shield arm's poses, for gear fitted to a rig. */
  armPoses?: ProceduralMeleeArmPoses;
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
    armPoses: {
      carry: {
        elbow: [-0.0916, -0.0998, -0.0122],
        handTurn: [0.02432, -0.00779, -0.04957, 0.99844],
        wrist: [-0.1141, -0.1524, 0.0411],
      },
      guard: {
        elbow: [-0.1362, -0.0796, 0.0085],
        handTurn: [-0.15234, -0.10879, 0.16523, 0.96833],
        wrist: [-0.1209, -0.0896, 0.0845],
      },
      windup: {
        elbow: [-0.011, -0.0157, 0.0869],
        handTurn: [-0.26857, -0.18856, 0.11127, 0.93805],
        wrist: [-0.058, 0.0464, 0.094],
      },
      contact: {
        elbow: [-0.11805, -0.05695, 0.0686],
        handTurn: [0.03198, -0.12111, -0.07711, 0.98912],
        wrist: [-0.1457, -0.0835, 0.1322],
      },
      follow: {
        elbow: [-0.1133, -0.0849, 0.0439],
        handTurn: [-0.00987, -0.27503, 0.03012, 0.96091],
        wrist: [-0.1323, -0.1336, 0.102],
      },
    },
    assetAlignment: { pivot: "authored" },
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
    armPoses: {
      carry: { elbow: [0.1082, -0.0913, 0.0323], handTurn: [0.0, 0.0, 0.0, 1.0], wrist: [0.0667, -0.1351, 0.082] },
      guard: {
        elbow: [0.1106, -0.0699, 0.0706],
        handTurn: [-0.31985, 0.19478, -0.15874, 0.91354],
        wrist: [0.0522, -0.0387, 0.1122],
      },
    },
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
