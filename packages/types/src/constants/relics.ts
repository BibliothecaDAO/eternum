import { ResourcesIds } from "./index";

export interface RelicInfo {
  id: ResourcesIds;
  name: string;
  type: "Stamina" | "Damage" | "Damage Reduction" | "Exploration" | "Production";
  activation: "Army" | "Structure";
  level: 1 | 2;
  craftable: boolean;
  effect: string;
  duration?: string;
}

export const RELICS: RelicInfo[] = [
  // Army Stamina Relics
  {
    id: ResourcesIds.StaminaRelic1,
    name: "Stamina Relic I",
    type: "Stamina",
    activation: "Army",
    level: 1,
    craftable: true,
    effect: "Increases stamina regeneration by 50%",
    duration: "3 Eternum Days",
  },
  {
    id: ResourcesIds.StaminaRelic2,
    name: "Stamina Relic II",
    type: "Stamina",
    activation: "Army",
    level: 2,
    craftable: false,
    effect: "Increases stamina regeneration by 100%",
    duration: "3 Eternum Days",
  },

  // Army Damage Relics
  {
    id: ResourcesIds.DamageRelic1,
    name: "Damage Relic I",
    type: "Damage",
    activation: "Army",
    level: 1,
    craftable: false,
    effect: "Increases damage by 30%",
    duration: "3 Eternum Days",
  },
  {
    id: ResourcesIds.DamageRelic2,
    name: "Damage Relic II",
    type: "Damage",
    activation: "Army",
    level: 2,
    craftable: false,
    effect: "Increases damage by 40%",
    duration: "3 Eternum Days",
  },

  // Army Damage Reduction Relics
  {
    id: ResourcesIds.DamageReductionRelic1,
    name: "Damage Reduction Relic I",
    type: "Damage Reduction",
    activation: "Army",
    level: 1,
    craftable: false,
    effect: "Reduces damage taken by 30%",
    duration: "3 Eternum Days",
  },
  {
    id: ResourcesIds.DamageReductionRelic2,
    name: "Damage Reduction Relic II",
    type: "Damage Reduction",
    activation: "Army",
    level: 2,
    craftable: false,
    effect: "Reduces damage taken by 40%",
    duration: "3 Eternum Days",
  },

  // Army Exploration Relics
  {
    id: ResourcesIds.ExplorationRelic1,
    name: "Exploration Relic I",
    type: "Exploration",
    activation: "Army",
    level: 1,
    craftable: false,
    effect: "Instantly explores a one-tile radius",
  },
  {
    id: ResourcesIds.ExplorationRelic2,
    name: "Exploration Relic II",
    type: "Exploration",
    activation: "Army",
    level: 2,
    craftable: false,
    effect: "Instantly explores a two-tile radius",
  },

  // Army Exploration Reward Relics
  {
    id: ResourcesIds.ExplorationRewardRelic1,
    name: "Exploration Reward Relic I",
    type: "Exploration",
    activation: "Army",
    level: 1,
    craftable: false,
    effect: "Double all exploration rewards",
    duration: "3 Eternum Days",
  },
  {
    id: ResourcesIds.ExplorationRewardRelic2,
    name: "Exploration Reward Relic II",
    type: "Exploration",
    activation: "Army",
    level: 2,
    craftable: false,
    effect: "Triple all exploration rewards",
    duration: "3 Eternum Days",
  },

  // Structure Damage Reduction Relics
  {
    id: ResourcesIds.StructureDamageReductionRelic1,
    name: "Structure Defense Relic I",
    type: "Damage Reduction",
    activation: "Structure",
    level: 1,
    craftable: false,
    effect: "Reduces damage taken by all guard armies by 15%",
    duration: "6 Eternum Days",
  },
  {
    id: ResourcesIds.StructureDamageReductionRelic2,
    name: "Structure Defense Relic II",
    type: "Damage Reduction",
    activation: "Structure",
    level: 2,
    craftable: false,
    effect: "Reduces damage taken by all guard armies by 30%",
    duration: "6 Eternum Days",
  },

  // Structure Production Relics
  {
    id: ResourcesIds.ProductionRelic1,
    name: "Production Relic I",
    type: "Production",
    activation: "Structure",
    level: 1,
    craftable: false,
    effect: "Increases resource production rate by 20%",
    duration: "3 Eternum Days",
  },
  {
    id: ResourcesIds.ProductionRelic2,
    name: "Production Relic II",
    type: "Production",
    activation: "Structure",
    level: 2,
    craftable: false,
    effect: "Increases resource production rate by 40%",
    duration: "3 Eternum Days",
  },

  // Structure Labor Production Relics
  {
    id: ResourcesIds.LaborProductionRelic1,
    name: "Labor Production Relic I",
    type: "Production",
    activation: "Structure",
    level: 1,
    craftable: false,
    effect: "Increases labor production rate by 20%",
    duration: "6 Eternum Days",
  },
  {
    id: ResourcesIds.LaborProductionRelic2,
    name: "Labor Production Relic II",
    type: "Production",
    activation: "Structure",
    level: 2,
    craftable: false,
    effect: "Increases labor production rate by 20%",
    duration: "12 Eternum Days",
  },

  // Structure Troop Production Relics
  {
    id: ResourcesIds.TroopProductionRelic1,
    name: "Troop Production Relic I",
    type: "Production",
    activation: "Structure",
    level: 1,
    craftable: false,
    effect: "Increases troop production rate by 20%",
    duration: "6 Eternum Days",
  },
  {
    id: ResourcesIds.TroopProductionRelic2,
    name: "Troop Production Relic II",
    type: "Production",
    activation: "Structure",
    level: 2,
    craftable: false,
    effect: "Increases troop production rate by 20%",
    duration: "12 Eternum Days",
  },
];

// Helper functions
export const getRelicInfo = (relicId: ResourcesIds): RelicInfo | undefined => {
  return RELICS.find((relic) => relic.id === relicId);
};

export const getRelicsByType = (type: RelicInfo["type"]): RelicInfo[] => {
  return RELICS.filter((relic) => relic.type === type);
};

export const getRelicsByActivation = (activation: RelicInfo["activation"]): RelicInfo[] => {
  return RELICS.filter((relic) => relic.activation === activation);
};

export const getRelicsByLevel = (level: RelicInfo["level"]): RelicInfo[] => {
  return RELICS.filter((relic) => relic.level === level);
};

export const getCraftableRelics = (): RelicInfo[] => {
  return RELICS.filter((relic) => relic.craftable);
};

export const isRelic = (resourceId: ResourcesIds): boolean => {
  return RELICS.some((relic) => relic.id === resourceId);
};

// Relic resource IDs for easy reference
export const RELIC_IDS = RELICS.map((relic) => relic.id);

// Relic categories
export const ARMY_RELICS = getRelicsByActivation("Army");
export const STRUCTURE_RELICS = getRelicsByActivation("Structure");
export const CRAFTABLE_RELICS = getCraftableRelics();

// Relic recipient type
export enum RelicRecipientType {
  Explorer = 0,
  Structure = 1,
}
