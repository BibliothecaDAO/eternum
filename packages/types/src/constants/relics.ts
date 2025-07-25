import { ResourcesIds } from "./index";

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
  effect: string;
  bonus: number;
  duration?: string;
}

export const RELICS: RelicInfo[] = [
  // Army Stamina Relics
  {
    id: ResourcesIds.StaminaRelic1,
    name: "Stamina Relic I",
    type: "Stamina",
    recipientTypeParam: RelicRecipientTypeParam.Explorer,
    recipientType: RelicRecipientType.Explorer,
    level: 1,
    craftable: false,
    effect: "Increases stamina regeneration by 50%",
    bonus: 1.5,
    duration: "15 Eternum Days",
  },
  {
    id: ResourcesIds.StaminaRelic2,
    name: "Stamina Relic II",
    type: "Stamina",
    recipientTypeParam: RelicRecipientTypeParam.Explorer,
    recipientType: RelicRecipientType.Explorer,
    level: 2,
    craftable: false,
    effect: "Increases stamina regeneration by 100%",
    bonus: 2,
    duration: "15 Eternum Days",
  },

  // Army Damage Relics
  {
    id: ResourcesIds.DamageRelic1,
    name: "Damage Relic I",
    type: "Damage",
    recipientTypeParam: RelicRecipientTypeParam.Explorer,
    recipientType: RelicRecipientType.Explorer,
    level: 1,
    craftable: false,
    effect: "Increases damage by 20%",
    bonus: 1.2,
    duration: "15 Eternum Days",
  },
  {
    id: ResourcesIds.DamageRelic2,
    name: "Damage Relic II",
    type: "Damage",
    recipientTypeParam: RelicRecipientTypeParam.Explorer,
    recipientType: RelicRecipientType.Explorer,
    level: 2,
    craftable: false,
    effect: "Increases damage by 40%",
    bonus: 1.4,
    duration: "15 Eternum Days",
  },

  // Army Damage Reduction Relics
  {
    id: ResourcesIds.DamageReductionRelic1,
    name: "Damage Reduction Relic I",
    type: "Damage Reduction",
    recipientTypeParam: RelicRecipientTypeParam.Explorer,
    recipientType: RelicRecipientType.Explorer,
    level: 1,
    craftable: false,
    effect: "Reduces damage taken by 20%",
    bonus: 0.8,
    duration: "3 Eternum Days",
  },
  {
    id: ResourcesIds.DamageReductionRelic2,
    name: "Damage Reduction Relic II",
    type: "Damage Reduction",
    recipientTypeParam: RelicRecipientTypeParam.Explorer,
    recipientType: RelicRecipientType.Explorer,
    level: 2,
    craftable: false,
    effect: "Reduces damage taken by 40%",
    bonus: 0.6,
    duration: "3 Eternum Days",
  },

  // Army Exploration Relics
  {
    id: ResourcesIds.ExplorationRelic1,
    name: "Exploration Relic I",
    type: "Exploration",
    recipientTypeParam: RelicRecipientTypeParam.Explorer,
    recipientType: RelicRecipientType.Explorer,
    level: 1,
    craftable: false,
    effect: "Instantly explores a one-tile radius",
    bonus: 1,
  },
  {
    id: ResourcesIds.ExplorationRelic2,
    name: "Exploration Relic II",
    type: "Exploration",
    recipientTypeParam: RelicRecipientTypeParam.Explorer,
    recipientType: RelicRecipientType.Explorer,
    level: 2,
    craftable: false,
    effect: "Instantly explores a two-tile radius",
    bonus: 2,
  },

  // Army Exploration Reward Relics
  {
    id: ResourcesIds.ExplorationRewardRelic1,
    name: "Exploration Reward Relic I",
    type: "Exploration",
    recipientTypeParam: RelicRecipientTypeParam.Explorer,
    recipientType: RelicRecipientType.Explorer,
    level: 1,
    craftable: false,
    effect: "Double all exploration rewards",
    bonus: 2,
    duration: "15 Eternum Days",
  },
  {
    id: ResourcesIds.ExplorationRewardRelic2,
    name: "Exploration Reward Relic II",
    type: "Exploration",
    recipientTypeParam: RelicRecipientTypeParam.Explorer,
    recipientType: RelicRecipientType.Explorer,
    level: 2,
    craftable: false,
    effect: "Triple all exploration rewards",
    bonus: 3,
    duration: "15 Eternum Days",
  },

  // Structure Damage Reduction Relics
  {
    id: ResourcesIds.StructureDamageReductionRelic1,
    name: "Structure Defense Relic I",
    type: "Damage Reduction",
    recipientTypeParam: RelicRecipientTypeParam.StructureGuard,
    recipientType: RelicRecipientType.Structure,
    level: 1,
    craftable: false,
    effect: "Reduce attacker damage to structure by 15% for 30 Eternum Days",
    bonus: 0.85,
    duration: "30 Eternum Days",
  },
  {
    id: ResourcesIds.StructureDamageReductionRelic2,
    name: "Structure Defense Relic II",
    type: "Damage Reduction",
    recipientTypeParam: RelicRecipientTypeParam.StructureGuard,
    recipientType: RelicRecipientType.Structure,
    level: 2,
    craftable: false,
    effect: "Reduce attacker damage to structure by 30% for 30 Eternum Days",
    bonus: 0.7,
    duration: "30 Eternum Days",
  },

  // Structure Production Relics
  {
    id: ResourcesIds.ProductionRelic1,
    name: "Production Relic I",
    type: "Production",
    recipientTypeParam: RelicRecipientTypeParam.StructureProduction,
    recipientType: RelicRecipientType.Structure,
    level: 1,
    craftable: false,
    effect: "Increases resource production rate by 20%",
    bonus: 1.2,
    duration: "15 Eternum Days",
  },
  {
    id: ResourcesIds.ProductionRelic2,
    name: "Production Relic II",
    type: "Production",
    recipientTypeParam: RelicRecipientTypeParam.StructureProduction,
    recipientType: RelicRecipientType.Structure,
    level: 2,
    craftable: false,
    effect: "Increases resource production rate by 40%",
    bonus: 1.4,
    duration: "15 Eternum Days",
  },

  // Structure Labor Production Relics
  {
    id: ResourcesIds.LaborProductionRelic1,
    name: "Labor Production Relic I",
    type: "Production",
    recipientTypeParam: RelicRecipientTypeParam.StructureProduction,
    recipientType: RelicRecipientType.Structure,
    level: 1,
    craftable: false,
    effect: "Increases labor production rate by 20%",
    bonus: 1.2,
    duration: "30 Eternum Days",
  },
  {
    id: ResourcesIds.LaborProductionRelic2,
    name: "Labor Production Relic II",
    type: "Production",
    recipientTypeParam: RelicRecipientTypeParam.StructureProduction,
    recipientType: RelicRecipientType.Structure,
    level: 2,
    craftable: false,
    effect: "Increases labor production rate by 20%",
    bonus: 1.2,
    duration: "60 Eternum Days",
  },

  // Structure Troop Production Relics
  {
    id: ResourcesIds.TroopProductionRelic1,
    name: "Troop Production Relic I",
    type: "Production",
    recipientTypeParam: RelicRecipientTypeParam.StructureProduction,
    recipientType: RelicRecipientType.Structure,
    level: 1,
    craftable: false,
    effect: "Increases troop production rate by 20%",
    bonus: 1.2,
    duration: "30 Eternum Days",
  },
  {
    id: ResourcesIds.TroopProductionRelic2,
    name: "Troop Production Relic II",
    type: "Production",
    recipientTypeParam: RelicRecipientTypeParam.StructureProduction,
    recipientType: RelicRecipientType.Structure,
    level: 2,
    craftable: false,
    effect: "Increases troop production rate by 20%",
    bonus: 1.2,
    duration: "60 Eternum Days",
  },
];

// Helper functions
export const getRelicInfo = (relicId: ResourcesIds): RelicInfo | undefined => {
  return RELICS.find((relic) => relic.id === relicId);
};

export const getRelicsByType = (type: RelicInfo["type"]): RelicInfo[] => {
  return RELICS.filter((relic) => relic.type === type);
};

export const getRelicsByRecipientType = (recipientType: RelicRecipientType): RelicInfo[] => {
  return RELICS.filter((relic) => relic.recipientType === recipientType);
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
export const ARMY_RELICS = getRelicsByRecipientType(RelicRecipientType.Explorer);
export const STRUCTURE_RELICS = [...getRelicsByRecipientType(RelicRecipientType.Structure)];
