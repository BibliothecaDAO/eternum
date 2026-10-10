import {
  isProceduralCharacterAppearanceCompatibleWithKind,
  resolveProceduralCharacterAppearance,
} from "./procedural-character-appearance";
import {
  isProceduralMeleeGearFittedToRig,
  resolveProceduralMeleeOffhand,
  resolveProceduralMeleeWeapon,
} from "./melee/procedural-melee-weapon-catalog";
import {
  applyProceduralUnitConfigPatch,
  PROCEDURAL_UNIT_KINDS,
  type ProceduralUnitConfig,
  type ProceduralUnitKind,
} from "./procedural-unit-config";

/**
 * The last line of defence before an actor is created or updated: it throws on a combination the config patch should
 * never have produced. The patch replaces what a new kind cannot use; this refuses what is still wrong.
 */
export function prepareProceduralUnitAssembly(requested: ProceduralUnitConfig): ProceduralUnitConfig {
  const kind = requested.kind;
  if (!PROCEDURAL_UNIT_KINDS.some(({ id }) => id === kind)) {
    throw new Error(`Unknown procedural unit kind: ${String(kind)}`);
  }
  if (rendersHumanoid(kind)) validateAppearance(kind, requested.humanoid.appearanceId);
  if (rendersMelee(kind)) validateMelee(kind, requested);
  return applyProceduralUnitConfigPatch(requested, {});
}

function rendersHumanoid(kind: ProceduralUnitKind): boolean {
  return kind === "archer" || kind === "crossbowman" || kind === "knight" || kind === "paladin";
}

function rendersMelee(kind: ProceduralUnitKind): kind is "knight" | "paladin" {
  return kind === "knight" || kind === "paladin";
}

function validateAppearance(kind: ProceduralUnitKind, id: ProceduralUnitConfig["humanoid"]["appearanceId"]): void {
  if (!isProceduralCharacterAppearanceCompatibleWithKind(id, kind)) {
    throw new Error(`Appearance ${id} is incompatible with ${kind}`);
  }
}

function validateMelee(kind: "knight" | "paladin", requested: ProceduralUnitConfig): void {
  const { weaponId, offhandId } = requested.melee;
  const weapon = resolveProceduralMeleeWeapon(weaponId);
  const offhand = resolveProceduralMeleeOffhand(offhandId);
  if (!weapon.compatibleKinds.includes(kind)) throw new Error(`Weapon ${weaponId} is incompatible with ${kind}`);
  if (!offhand.compatibleKinds.includes(kind)) throw new Error(`Offhand ${offhandId} is incompatible with ${kind}`);
  const { rigAdapterId } = resolveProceduralCharacterAppearance(requested.humanoid.appearanceId);
  if (!isProceduralMeleeGearFittedToRig(weapon, rigAdapterId)) {
    throw new Error(`Weapon ${weaponId} is fitted to ${weapon.fittedRigAdapterId}, not to ${rigAdapterId}`);
  }
  if (!isProceduralMeleeGearFittedToRig(offhand, rigAdapterId)) {
    throw new Error(`Offhand ${offhandId} is fitted to ${offhand.fittedRigAdapterId}, not to ${rigAdapterId}`);
  }
}
