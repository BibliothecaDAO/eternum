import { ResourcesIds } from "./resource-ids";

// Relic recipient type
export enum RelicRecipientTypeParam {
  Explorer = 0,
  StructureProduction = 1,
  StructureGuard = 2,
}

export enum RelicRecipientType {
  Explorer = "Explorer",
  Structure = "Structure",
}

export interface RelicInfo {
  id: ResourcesIds;
  name: string;
  type: "Stamina" | "Damage" | "Damage Reduction" | "Exploration" | "Production";
  recipientTypeParam: RelicRecipientTypeParam;
  recipientType: RelicRecipientType;
  level: 1 | 2;
  craftable: boolean;
  /** The rate the contract applies, in basis points; zero for the reveal-radius relics. */
  rateBps: number;
  effect: string;
  bonus: number;
}

/** What a relic's rate does, in words, and the multiplier it applies. */
type RelicEffectWords = (rateBps: number) => Pick<RelicInfo, "effect" | "bonus">;

const raises =
  (what: string): RelicEffectWords =>
  (rateBps) => ({ effect: `Increases ${what} by ${rateBps / 100}%`, bonus: 1 + rateBps / 10000 });
const lowers =
  (what: string): RelicEffectWords =>
  (rateBps) => ({ effect: `Reduces ${what} by ${rateBps / 100}%`, bonus: 1 - rateBps / 10000 });
const revealsRadius =
  (radius: number, words: string): RelicEffectWords =>
  () => ({ effect: `Instantly explores a ${words}-tile radius`, bonus: radius });

const explorerRelic = {
  recipientTypeParam: RelicRecipientTypeParam.Explorer,
  recipientType: RelicRecipientType.Explorer,
};
const productionRelic = {
  recipientTypeParam: RelicRecipientTypeParam.StructureProduction,
  recipientType: RelicRecipientType.Structure,
};
const guardRelic = {
  recipientTypeParam: RelicRecipientTypeParam.StructureGuard,
  recipientType: RelicRecipientType.Structure,
};

const relic = (
  info: Omit<RelicInfo, "craftable" | "effect" | "bonus" | "rateBps">,
  rateBps: number,
  words: RelicEffectWords,
): RelicInfo => ({ ...info, craftable: false, rateBps, ...words(rateBps) });

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
export const relicEffect = (relicId: ResourcesIds): string => {
  const relic = getRelicInfo(relicId);
  if (!relic) throw new Error(`Resource ${relicId} is not a relic`);
  return relic.effect;
};

type RelicPackName = "War" | "Explore" | "Produce" | "Fortress";

/**
 * A relic chest's pack: three level I relics, all level II when the chest is lucky. The contract draws and grants
 * them (relics::pack_relics); this is the same table for the chest's panel and history.
 */
export const RELIC_PACKS: Record<
  RelicPackName,
  { oddsPercent: number; relics: [ResourcesIds, ResourcesIds, ResourcesIds] }
> = {
  War: {
    oddsPercent: 30,
    relics: [ResourcesIds.DamageRelic1, ResourcesIds.DamageReductionRelic1, ResourcesIds.StaminaRelic1],
  },
  Explore: {
    oddsPercent: 30,
    relics: [ResourcesIds.ExplorationRelic1, ResourcesIds.ExplorationRewardRelic1, ResourcesIds.StaminaRelic1],
  },
  Produce: {
    oddsPercent: 25,
    relics: [ResourcesIds.ProductionRelic1, ResourcesIds.LaborProductionRelic1, ResourcesIds.TroopProductionRelic1],
  },
  Fortress: {
    oddsPercent: 15,
    relics: [
      ResourcesIds.StructureDamageReductionRelic1,
      ResourcesIds.DamageReductionRelic1,
      ResourcesIds.TroopProductionRelic1,
    ],
  },
};

interface RelicChestPack {
  pack: RelicPackName;
  lucky: boolean;
}

/** The chest's name, the one its panel and the game's history show: "War pack", or "War pack · lucky". */
export const relicChestName = ({ pack, lucky }: RelicChestPack): string => `${pack} pack${lucky ? " · lucky" : ""}`;

/** The relics a chest holds: its pack's, each a level up when the chest is lucky. */
export const relicChestRelics = ({ pack, lucky }: RelicChestPack): ResourcesIds[] =>
  RELIC_PACKS[pack].relics.map((id) => (lucky ? ((id + 1) as ResourcesIds) : id));

/** A chest's pack as a fact or a story carries it; refuses anything that is not one of the four packs. */
export const relicChestPack = (value: unknown): RelicChestPack => {
  const fields = (value ?? {}) as { pack?: unknown; lucky?: unknown };
  const pack =
    typeof fields.pack === "string"
      ? fields.pack
      : typeof fields.pack === "object" && fields.pack !== null
        ? Object.keys(fields.pack)[0]
        : undefined;
  if (pack === undefined || !Object.hasOwn(RELIC_PACKS, pack) || typeof fields.lucky !== "boolean")
    throw new Error(
      `Invalid relic chest: ${JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? String(item) : item))}`,
    );
  return { pack: pack as RelicPackName, lucky: fields.lucky };
};

const relicCount = (count: number): string => `${count} relic${count === 1 ? "" : "s"}`;

/**
 * Where an opened chest's relics went, as the contract pays them, the army named first so it reads even when cut: army
 * relics stay with the army that opened it, the rest go to its home ("3 relics to the army Stolsli T1", "1 relic to the
 * army Stolsli T1, 2 to Stolsli", "3 relics to Stolsli"). `army` is the army's name ("Stolsli T1"), null when unknown.
 */
/** How an opened chest's relics divide: army relics to the army that opened it, the rest to that army's home. */
export const relicChestShares = (relics: ResourcesIds[]): { toArmy: number; toHome: number } => {
  const toArmy = relics.filter((id) => {
    const relic = getRelicInfo(id);
    if (!relic) throw new Error(`Resource ${id} is not a relic`);
    return relic.recipientType === RelicRecipientType.Explorer;
  }).length;
  return { toArmy, toHome: relics.length - toArmy };
};

export const relicChestDelivery = (relics: ResourcesIds[], to: { army: string | null; home: string }): string => {
  const { toArmy, toHome } = relicChestShares(relics);
  const army = to.army ? `the army ${to.army}` : "the army";
  if (toHome === 0) return `${relicCount(toArmy)} to ${army}`;
  if (toArmy === 0) return `${relicCount(toHome)} to ${to.home}`;
  return `${relicCount(toArmy)} to ${army}, ${toHome} to ${to.home}`;
};
