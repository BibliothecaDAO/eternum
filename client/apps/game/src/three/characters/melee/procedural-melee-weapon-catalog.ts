import type { ProceduralUnitKind } from "../procedural-unit-config";

export type ProceduralMeleeWeaponId =
  | "iron-longsword"
  | "runic-warhammer"
  | "winter-broadaxe"
  | "winter-rider-battleaxe";

export type ProceduralMeleeOffhandId =
  | "none"
  | "round-shield"
  | "winter-rider-shield"
  | "winter-targe"
  | "light-cavalry-shield";

export type ProceduralMeleeAttackStyle = "chop" | "slash" | "smash";

export interface ProceduralMeleeAssetAlignment {
  axis?: "x" | "y" | "z";
  pivot: "axis-max" | "axis-min" | "center";
  rotation?: readonly [number, number, number];
}

export interface ProceduralMeleeWeaponDefinition {
  attackStyle: ProceduralMeleeAttackStyle;
  assetAlignment?: ProceduralMeleeAssetAlignment;
  compatibleKinds: readonly Extract<ProceduralUnitKind, "knight" | "paladin">[];
  id: ProceduralMeleeWeaponId;
  label: string;
  registryEntryId?: string;
  visualLength: number;
}

export interface ProceduralMeleeOffhandDefinition {
  assetAlignment?: ProceduralMeleeAssetAlignment;
  compatibleKinds: readonly Extract<ProceduralUnitKind, "knight" | "paladin">[];
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

export function resolveDefaultProceduralMeleeLoadout(kind: ProceduralUnitKind): {
  weaponId: ProceduralMeleeWeaponId;
  offhandId: ProceduralMeleeOffhandId;
} {
  if (kind === "paladin") return { weaponId: "runic-warhammer", offhandId: "round-shield" };
  return { weaponId: "iron-longsword", offhandId: "round-shield" };
}
