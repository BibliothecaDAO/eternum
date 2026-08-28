export {
  applyProceduralCharacterConfigPatch,
  PROCEDURAL_CHARACTER_PRESETS,
  resolveProceduralCharacterPreset,
  type ProceduralCharacterConfig,
  type ProceduralCharacterMotionMode,
  type ProceduralCharacterPresetId,
} from "./procedural-character-config";
export {
  PROCEDURAL_CHARACTER_APPEARANCES,
  type ProceduralCharacterAppearanceId,
} from "./procedural-character-appearance";
export {
  applyProceduralUnitConfigPatch,
  createDefaultProceduralUnitConfig,
  PROCEDURAL_UNIT_KINDS,
  type ProceduralUnitConfig,
  type ProceduralUnitConfigPatch,
  type ProceduralUnitKind,
} from "./procedural-unit-config";
export type { ProceduralArcherConfig } from "./archer/procedural-archer-config";
export { type ProceduralBoatConfig, type ProceduralBoatMotionMode } from "./boat/procedural-boat-config";
export {
  PROCEDURAL_MELEE_OFFHANDS,
  PROCEDURAL_MELEE_WEAPONS,
  type ProceduralMeleeOffhandId,
  type ProceduralMeleeWeaponId,
} from "./melee/procedural-melee-weapon-catalog";
export type { ProceduralMeleeConfig } from "./melee/procedural-melee-config";
export {
  ProceduralUnitRuntime,
  type ProceduralMeleeContactEvent,
  type ProceduralRangedReleaseEvent,
  type ProceduralUnitActor,
} from "./procedural-unit-runtime";
export {
  type ProceduralHorseConfig,
  type ProceduralHorseGait,
  type ProceduralHorseLead,
  type ProceduralHorseTerrainPreset,
} from "./horse/procedural-horse-config";
