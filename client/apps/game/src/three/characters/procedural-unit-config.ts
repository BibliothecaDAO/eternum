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
  applyDefaultMeleeLoadoutForKind,
  applyProceduralMeleeConfigPatch,
  createDefaultProceduralMeleeConfig,
  type ProceduralMeleeConfig,
} from "./melee/procedural-melee-config";

export type ProceduralUnitKind = "archer" | "knight" | "crossbowman" | "horse" | "paladin";

export interface ProceduralUnitConfig {
  archer: ProceduralArcherConfig;
  kind: ProceduralUnitKind;
  humanoid: ProceduralCharacterConfig;
  horse: ProceduralHorseConfig;
  melee: ProceduralMeleeConfig;
}

export interface ProceduralUnitConfigPatch {
  archer?: Partial<ProceduralArcherConfig>;
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
];

export function createDefaultProceduralUnitConfig(): ProceduralUnitConfig {
  const archer = createDefaultProceduralArcherConfig();
  const humanoid = createDefaultProceduralCharacterConfig();
  const horse = createDefaultProceduralHorseConfig();
  const melee = createDefaultProceduralMeleeConfig("paladin");
  return {
    archer,
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
  const humanoid = applyProceduralCharacterConfigPatch(current.humanoid, humanoidPatch);
  const horsePatch = { ...patch.horse };
  if (patch.humanoid?.seed !== undefined && patch.horse?.seed === undefined) horsePatch.seed = humanoid.seed;
  const meleeBase = kind === current.kind ? current.melee : applyDefaultMeleeLoadoutForKind(current.melee, kind);
  return {
    archer: applyProceduralArcherConfigPatch(current.archer, patch.archer ?? {}),
    kind,
    humanoid,
    horse: applyProceduralHorseConfigPatch(current.horse, horsePatch),
    melee: applyProceduralMeleeConfigPatch(meleeBase, patch.melee ?? {}),
  };
}
