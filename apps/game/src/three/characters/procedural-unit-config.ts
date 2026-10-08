import {
  DEFAULT_PROCEDURAL_CHARACTER_APPEARANCE_ID,
  isProceduralCharacterAppearanceCompatibleWithKind,
  resolveProceduralCharacterAppearance,
} from "./procedural-character-appearance";
import {
  applyProceduralCharacterConfigPatch,
  createDefaultProceduralCharacterConfig,
  type ProceduralCharacterConfig,
} from "./procedural-character-config";
import {
  applyProceduralHorseConfigPatch,
  createDefaultProceduralHorseConfig,
  type ProceduralHorseConfig,
} from "./horse/procedural-horse-config";
import {
  applyProceduralArcherConfigPatch,
  createDefaultProceduralArcherConfig,
  type ProceduralArcherConfig,
} from "./archer/procedural-archer-config";
import {
  isProceduralMeleeGearFittedToRig,
  resolveProceduralMeleeOffhand,
  resolveProceduralMeleeWeapon,
  resolveRigFittedMeleeLoadout,
} from "./melee/procedural-melee-weapon-catalog";
import {
  applyDefaultMeleeLoadoutForKind,
  applyProceduralMeleeConfigPatch,
  createDefaultProceduralMeleeConfig,
  type ProceduralMeleeConfig,
} from "./melee/procedural-melee-config";
import {
  applyProceduralBoatConfigPatch,
  createDefaultProceduralBoatConfig,
  type ProceduralBoatConfig,
} from "./boat/procedural-boat-config";
import {
  applyProceduralDragonConfigPatch,
  createDefaultProceduralDragonConfig,
  type ProceduralDragonConfig,
} from "./dragon/procedural-dragon-config";

export type ProceduralUnitKind = "archer" | "boat" | "crossbowman" | "dragon" | "horse" | "knight" | "paladin";

export interface ProceduralUnitConfig {
  archer: ProceduralArcherConfig;
  boat: ProceduralBoatConfig;
  dragon: ProceduralDragonConfig;
  kind: ProceduralUnitKind;
  humanoid: ProceduralCharacterConfig;
  horse: ProceduralHorseConfig;
  melee: ProceduralMeleeConfig;
}

export interface ProceduralUnitConfigPatch {
  archer?: Partial<ProceduralArcherConfig>;
  boat?: Partial<ProceduralBoatConfig>;
  dragon?: Partial<ProceduralDragonConfig>;
  kind?: ProceduralUnitKind;
  humanoid?: Partial<ProceduralCharacterConfig>;
  horse?: Partial<ProceduralHorseConfig>;
  melee?: Partial<ProceduralMeleeConfig>;
}

export const PROCEDURAL_UNIT_KINDS: ReadonlyArray<{ id: ProceduralUnitKind; label: string }> = [
  { id: "archer", label: "Archer" },
  { id: "knight", label: "Knight" },
  { id: "crossbowman", label: "Crossbowman" },
  { id: "horse", label: "Horse" },
  { id: "paladin", label: "Mounted Paladin" },
  { id: "dragon", label: "Sky Dragon" },
  { id: "boat", label: "Naval Ship" },
];

export function createDefaultProceduralUnitConfig(): ProceduralUnitConfig {
  const archer = createDefaultProceduralArcherConfig();
  const boat = createDefaultProceduralBoatConfig();
  const humanoid = createDefaultProceduralCharacterConfig();
  const dragon = createDefaultProceduralDragonConfig();
  const horse = createDefaultProceduralHorseConfig();
  const melee = createDefaultProceduralMeleeConfig("paladin");
  return {
    archer,
    boat,
    dragon: applyProceduralDragonConfigPatch(dragon, { seed: humanoid.seed }),
    kind: "paladin",
    humanoid: applyProceduralCharacterConfigPatch(humanoid, { animationMode: "mounted" }),
    horse: applyProceduralHorseConfigPatch(horse, { seed: humanoid.seed }),
    melee,
  };
}

export function applyProceduralUnitConfigPatch(
  current: ProceduralUnitConfig,
  patch: ProceduralUnitConfigPatch,
): ProceduralUnitConfig {
  const kind = patch.kind ?? current.kind;
  const humanoidPatch = { ...patch.humanoid };
  if (kind === "paladin") humanoidPatch.animationMode = "mounted";
  else if (current.kind === "paladin" && !humanoidPatch.animationMode) humanoidPatch.animationMode = "walk";
  const humanoid = applyProceduralCharacterConfigPatch(keepAppearanceThatServes(current.humanoid, kind), humanoidPatch);
  const horsePatch = { ...patch.horse };
  if (patch.humanoid?.seed !== undefined && patch.horse?.seed === undefined) horsePatch.seed = humanoid.seed;
  const boatPatch = { ...patch.boat };
  if (patch.humanoid?.seed !== undefined && patch.boat?.seed === undefined) boatPatch.seed = humanoid.seed;
  const dragonPatch = { ...patch.dragon };
  if (patch.humanoid?.seed !== undefined && patch.dragon?.seed === undefined) dragonPatch.seed = humanoid.seed;
  const meleeBase = kind === current.kind ? current.melee : applyDefaultMeleeLoadoutForKind(current.melee, kind);
  const melee = fitMeleeLoadoutToAppearance(meleeBase, kind, current.humanoid.appearanceId, humanoid.appearanceId);
  return {
    archer: applyProceduralArcherConfigPatch(current.archer, patch.archer ?? {}),
    boat: applyProceduralBoatConfigPatch(current.boat, boatPatch),
    dragon: applyProceduralDragonConfigPatch(current.dragon, dragonPatch),
    kind,
    humanoid,
    horse: applyProceduralHorseConfigPatch(current.horse, horsePatch),
    melee: applyProceduralMeleeConfigPatch(melee, patch.melee ?? {}),
  };
}

/** A kind that cannot use the current appearance gets the default one, in the same step as its melee loadout. */
function keepAppearanceThatServes(
  humanoid: ProceduralCharacterConfig,
  kind: ProceduralUnitKind,
): ProceduralCharacterConfig {
  if (isProceduralCharacterAppearanceCompatibleWithKind(humanoid.appearanceId, kind)) return humanoid;
  return applyProceduralCharacterConfigPatch(humanoid, { appearanceId: DEFAULT_PROCEDURAL_CHARACTER_APPEARANCE_ID });
}

/**
 * Gear fitted to one rig goes with that rig's appearance: choosing the appearance brings its gear, and leaving it
 * takes the gear off for the kind's default.
 */
function fitMeleeLoadoutToAppearance(
  melee: ProceduralMeleeConfig,
  kind: ProceduralUnitKind,
  previousAppearanceId: ProceduralCharacterConfig["appearanceId"],
  appearanceId: ProceduralCharacterConfig["appearanceId"],
): ProceduralMeleeConfig {
  const { rigAdapterId } = resolveProceduralCharacterAppearance(appearanceId);
  const fittedLoadout = resolveRigFittedMeleeLoadout(rigAdapterId);
  const choseAppearance = appearanceId !== previousAppearanceId;
  if (fittedLoadout && choseAppearance && (kind === "knight" || kind === "paladin")) {
    return applyProceduralMeleeConfigPatch(melee, fittedLoadout);
  }
  const wornGear = [resolveProceduralMeleeWeapon(melee.weaponId), resolveProceduralMeleeOffhand(melee.offhandId)];
  if (wornGear.every((gear) => isProceduralMeleeGearFittedToRig(gear, rigAdapterId))) return melee;
  return applyDefaultMeleeLoadoutForKind(melee, kind);
}
