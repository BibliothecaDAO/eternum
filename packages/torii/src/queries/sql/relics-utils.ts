import { ResourcesIds } from "@bibliothecadao/types";
import { RelicInventory } from "../../types";

/**
 * Extract relic data from resource balance fields
 */
export const extractRelicsFromResourceData = (data: any): RelicInventory[] => {
  const relics: RelicInventory[] = [];

  // Map relic balance fields to ResourcesIds
  const relicMappings = [
    { field: "RELIC_E1_BALANCE", resourceId: ResourcesIds.StaminaRelic2 },
    { field: "RELIC_E2_BALANCE", resourceId: ResourcesIds.DamageRelic1 },
    { field: "RELIC_E3_BALANCE", resourceId: ResourcesIds.DamageReductionRelic1 },
    { field: "RELIC_E4_BALANCE", resourceId: ResourcesIds.DamageRelic2 },
    { field: "RELIC_E5_BALANCE", resourceId: ResourcesIds.StaminaRelic1 },
    { field: "RELIC_E6_BALANCE", resourceId: ResourcesIds.DamageReductionRelic2 },
    { field: "RELIC_E7_BALANCE", resourceId: ResourcesIds.ExplorationRelic1 },
    { field: "RELIC_E8_BALANCE", resourceId: ResourcesIds.ExplorationRelic2 },
    { field: "RELIC_E9_BALANCE", resourceId: ResourcesIds.ExplorationRewardRelic1 },
    { field: "RELIC_E10_BALANCE", resourceId: ResourcesIds.ExplorationRewardRelic2 },
    { field: "RELIC_S1_BALANCE", resourceId: ResourcesIds.StructureDamageReductionRelic1 },
    { field: "RELIC_S2_BALANCE", resourceId: ResourcesIds.StructureDamageReductionRelic2 },
    { field: "RELIC_S3_BALANCE", resourceId: ResourcesIds.ProductionRelic1 },
    { field: "RELIC_S4_BALANCE", resourceId: ResourcesIds.ProductionRelic2 },
    { field: "RELIC_S5_BALANCE", resourceId: ResourcesIds.LaborProductionRelic1 },
    { field: "RELIC_S6_BALANCE", resourceId: ResourcesIds.LaborProductionRelic2 },
    { field: "RELIC_S7_BALANCE", resourceId: ResourcesIds.TroopProductionRelic1 },
    { field: "RELIC_S8_BALANCE", resourceId: ResourcesIds.TroopProductionRelic2 },
  ];

  for (const mapping of relicMappings) {
    const balance = data[mapping.field];
    if (balance && parseInt(balance) > 0) {
      relics.push({
        resourceId: mapping.resourceId,
        amount: parseInt(balance),
      });
    }
  }

  return relics;
};
