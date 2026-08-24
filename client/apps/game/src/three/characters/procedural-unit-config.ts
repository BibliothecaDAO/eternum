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
import {
  applyProceduralBoatConfigPatch,
  createDefaultProceduralBoatConfig,
  type ProceduralBoatConfig,
} from "./boat/procedural-boat-config";

export type ProceduralUnitKind = "archer" | "boat" | "knight" | "crossbowman" | "horse" | "paladin";

export interface ProceduralUnitConfig {
  archer: ProceduralArcherConfig;
  boat: ProceduralBoatConfig;
  kind: ProceduralUnitKind;
  humanoid: ProceduralCharacterConfig;
  horse: ProceduralHorseConfig;
  melee: ProceduralMeleeConfig;
}

export interface ProceduralUnitConfigPatch {
  archer?: Partial<ProceduralArcherConfig>;
  boat?: Partial<ProceduralBoatConfig>;
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
  { id: "boat", label: "Naval Ship" },
];

export function createDefaultProceduralUnitConfig(): ProceduralUnitConfig {
  const archer = createDefaultProceduralArcherConfig();
  const boat = createDefaultProceduralBoatConfig();
  const humanoid = createDefaultProceduralCharacterConfig();
  const horse = createDefaultProceduralHorseConfig();
  const melee = createDefaultProceduralMeleeConfig("paladin");
  return {
    archer,
    boat,
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
  const boatPatch = { ...patch.boat };
  if (patch.humanoid?.seed !== undefined && patch.boat?.seed === undefined) boatPatch.seed = humanoid.seed;
  const meleeBase = kind === current.kind ? current.melee : applyDefaultMeleeLoadoutForKind(current.melee, kind);
  return {
    archer: applyProceduralArcherConfigPatch(current.archer, patch.archer ?? {}),
    boat: applyProceduralBoatConfigPatch(current.boat, boatPatch),
    kind,
    humanoid,
    horse: applyProceduralHorseConfigPatch(current.horse, horsePatch),
    melee: applyProceduralMeleeConfigPatch(meleeBase, patch.melee ?? {}),
  };
}
