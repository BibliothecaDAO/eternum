import { ResourcesIds } from "./resource-ids";

export enum RelicRecipientType {
  Explorer = "Explorer",
  Structure = "Structure",
}

export interface RelicInfo {
  id: ResourcesIds;
  name: string;
  type: "Stamina" | "Damage" | "Damage Reduction" | "Exploration" | "Production";
  recipientType: RelicRecipientType;
  level: 1 | 2;
  /** The rate the contract applies, in basis points; zero for the reveal-radius relics. */
  rateBps: number;
  effect: string;
  effectWords: RelicEffectWords;
  bonus: number;
}

/** What a relic's rate does, in words, and the multiplier it applies. */
type RelicEffectWords = (rateBps: number, radius?: number) => Pick<RelicInfo, "effect" | "bonus">;

const raises =
  (what: string): RelicEffectWords =>
  (rateBps) => ({ effect: `Increases ${what} by ${rateBps / 100}%`, bonus: 1 + rateBps / 10000 });
const lowers =
  (what: string): RelicEffectWords =>
  (rateBps) => ({ effect: `Reduces ${what} by ${rateBps / 100}%`, bonus: 1 - rateBps / 10000 });
const revealsRadius =
  (radius: number, words: string): RelicEffectWords =>
  (_rateBps, recordedRadius) => ({
    effect: `Instantly explores a ${recordedRadius === undefined ? words : recordedRadius}-tile radius`,
    bonus: recordedRadius ?? radius,
  });

const explorerRelic = { recipientType: RelicRecipientType.Explorer };
const productionRelic = { recipientType: RelicRecipientType.Structure };
const guardRelic = { recipientType: RelicRecipientType.Structure };

const relic = (
  info: Omit<RelicInfo, "effect" | "effectWords" | "bonus" | "rateBps">,
  rateBps: number,
  words: RelicEffectWords,
): RelicInfo => ({ ...info, rateBps, effectWords: words, ...words(rateBps) });

/**
 * Every relic, the one source of its name, rate and effect: the presets read each rate from here (see
 * config/source/common/native-data.ts), and every surface words the effect from the same rate.
 */
export const RELICS: RelicInfo[] = [
  relic(
    { id: ResourcesIds.StaminaRelic1, name: "Stamina Relic I", type: "Stamina", level: 1, ...explorerRelic },
    5000,
    raises("stamina regeneration"),
  ),
  relic(
    { id: ResourcesIds.StaminaRelic2, name: "Stamina Relic II", type: "Stamina", level: 2, ...explorerRelic },
    10000,
    raises("stamina regeneration"),
  ),
  relic(
    { id: ResourcesIds.DamageRelic1, name: "Damage Relic I", type: "Damage", level: 1, ...explorerRelic },
    2000,
    raises("damage"),
  ),
  relic(
    { id: ResourcesIds.DamageRelic2, name: "Damage Relic II", type: "Damage", level: 2, ...explorerRelic },
    4000,
    raises("damage"),
  ),
  relic(
    {
      id: ResourcesIds.DamageReductionRelic1,
      name: "Damage Reduction Relic I",
      type: "Damage Reduction",
      level: 1,
      ...explorerRelic,
    },
    2000,
    lowers("damage taken"),
  ),
  relic(
    {
      id: ResourcesIds.DamageReductionRelic2,
      name: "Damage Reduction Relic II",
      type: "Damage Reduction",
      level: 2,
      ...explorerRelic,
    },
    4000,
    lowers("damage taken"),
  ),
  relic(
    {
      id: ResourcesIds.ExplorationRelic1,
      name: "Exploration Relic I",
      type: "Exploration",
      level: 1,
      ...explorerRelic,
    },
    0,
    revealsRadius(1, "one"),
  ),
  relic(
    {
      id: ResourcesIds.ExplorationRelic2,
      name: "Exploration Relic II",
      type: "Exploration",
      level: 2,
      ...explorerRelic,
    },
    0,
    revealsRadius(2, "two"),
  ),
  relic(
    {
      id: ResourcesIds.ExplorationRewardRelic1,
      name: "Exploration Reward Relic I",
      type: "Exploration",
      level: 1,
      ...explorerRelic,
    },
    10000,
    raises("exploration rewards"),
  ),
  relic(
    {
      id: ResourcesIds.ExplorationRewardRelic2,
      name: "Exploration Reward Relic II",
      type: "Exploration",
      level: 2,
      ...explorerRelic,
    },
    20000,
    raises("exploration rewards"),
  ),
  relic(
    {
      id: ResourcesIds.StructureDamageReductionRelic1,
      name: "Structure Defense Relic I",
      type: "Damage Reduction",
      level: 1,
      ...guardRelic,
    },
    1500,
    lowers("attacker damage to the structure"),
  ),
  relic(
    {
      id: ResourcesIds.StructureDamageReductionRelic2,
      name: "Structure Defense Relic II",
      type: "Damage Reduction",
      level: 2,
      ...guardRelic,
    },
    3000,
    lowers("attacker damage to the structure"),
  ),
  relic(
    { id: ResourcesIds.ProductionRelic1, name: "Production Relic I", type: "Production", level: 1, ...productionRelic },
    2000,
    raises("resource production rate"),
  ),
  relic(
    {
      id: ResourcesIds.ProductionRelic2,
      name: "Production Relic II",
      type: "Production",
      level: 2,
      ...productionRelic,
    },
    4000,
    raises("resource production rate"),
  ),
  relic(
    {
      id: ResourcesIds.LaborProductionRelic1,
      name: "Labor Production Relic I",
      type: "Production",
      level: 1,
      ...productionRelic,
    },
    2000,
    raises("labor production rate"),
  ),
  relic(
    {
      id: ResourcesIds.LaborProductionRelic2,
      name: "Labor Production Relic II",
      type: "Production",
      level: 2,
      ...productionRelic,
    },
    4000,
    raises("labor production rate"),
  ),
  relic(
    {
      id: ResourcesIds.TroopProductionRelic1,
      name: "Troop Production Relic I",
      type: "Production",
      level: 1,
      ...productionRelic,
    },
    1500,
    raises("troop production rate"),
  ),
  relic(
    {
      id: ResourcesIds.TroopProductionRelic2,
      name: "Troop Production Relic II",
      type: "Production",
      level: 2,
      ...productionRelic,
    },
    3000,
    raises("troop production rate"),
  ),
];

// Helper functions
export const getRelicInfo = (relicId: ResourcesIds): RelicInfo | undefined => {
  return RELICS.find((relic) => relic.id === relicId);
};

/** A relic's name, the one every surface shows: its panel, its resource row and the game's history. */
export const relicName = (relicId: ResourcesIds): string => {
  const relic = getRelicInfo(relicId);
  if (!relic) throw new Error(`Resource ${relicId} is not a relic`);
  return relic.name;
};

export const isRelic = (resourceId: ResourcesIds): boolean => {
  return RELICS.some((relic) => relic.id === resourceId);
};

/** A relic's effect, the one every surface words. */
export const relicEffect = (relicId: ResourcesIds, recorded?: { rateBps: number; radius: number }): string => {
  const relic = getRelicInfo(relicId);
  if (!relic) throw new Error(`Resource ${relicId} is not a relic`);
  return recorded ? relic.effectWords(recorded.rateBps, recorded.radius).effect : relic.effect;
};
