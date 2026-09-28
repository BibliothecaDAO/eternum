import { resolveProceduralCharacterAppearance } from "./procedural-character-appearance";
import { resolveProceduralMeleeOffhand, resolveProceduralMeleeWeapon } from "./melee/procedural-melee-weapon-catalog";
import {
  applyProceduralUnitConfigPatch,
  PROCEDURAL_UNIT_KINDS,
  type ProceduralUnitConfig,
  type ProceduralUnitKind,
} from "./procedural-unit-config";

/** Validate family-owned appearance and gear before creating or updating an actor. */
export function prepareProceduralUnitAssembly(requested: ProceduralUnitConfig): ProceduralUnitConfig {
  const kind = requested.kind;
  if (!PROCEDURAL_UNIT_KINDS.some(({ id }) => id === kind)) {
    throw new Error(`Unknown procedural unit kind: ${String(kind)}`);
  }
  if (rendersHumanoid(kind)) validateAppearance(kind, requested.humanoid.appearanceId);
  if (rendersMelee(kind)) validateMelee(kind, requested.melee.weaponId, requested.melee.offhandId);
  return applyProceduralUnitConfigPatch(requested, {});
}

function rendersHumanoid(kind: ProceduralUnitKind): boolean {
  return kind === "archer" || kind === "crossbowman" || kind === "knight" || kind === "paladin";
}

function rendersMelee(kind: ProceduralUnitKind): kind is "knight" | "paladin" {
  return kind === "knight" || kind === "paladin";
}

function validateAppearance(kind: ProceduralUnitKind, id: ProceduralUnitConfig["humanoid"]["appearanceId"]): void {
  const appearance = resolveProceduralCharacterAppearance(id);
  if (appearance.compatibleKinds && !appearance.compatibleKinds.includes(kind as "knight")) {
    throw new Error(`Appearance ${id} is incompatible with ${kind}`);
  }
}

function validateMelee(
  kind: "knight" | "paladin",
  weaponId: ProceduralUnitConfig["melee"]["weaponId"],
  offhandId: ProceduralUnitConfig["melee"]["offhandId"],
): void {
  if (!resolveProceduralMeleeWeapon(weaponId).compatibleKinds.includes(kind)) {
    throw new Error(`Weapon ${weaponId} is incompatible with ${kind}`);
  }
  if (!resolveProceduralMeleeOffhand(offhandId).compatibleKinds.includes(kind)) {
    throw new Error(`Offhand ${offhandId} is incompatible with ${kind}`);
  }
}
