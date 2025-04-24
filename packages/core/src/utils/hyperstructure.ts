import { getComponentValue } from "@dojoengine/recs";
import { ResourcesIds, ClientComponents } from "@bibliothecadao/types";
import { configManager } from "../managers";
import { divideByPrecision, getEntityIdFromKeys } from "./utils";

export const getHyperstructureProgress = (hyperstructureId: number, components: ClientComponents) => {
  const hyperstructure = getComponentValue(components.Hyperstructure, getEntityIdFromKeys([BigInt(hyperstructureId)]));

  const hyperstructureRequiredAmounts = getComponentValue(
    components.HyperstructureRequirements,
    getEntityIdFromKeys([BigInt(hyperstructureId)]),
  );
  const percentage = hyperstructureRequiredAmounts?.current_resource_total
    ? Number(
        (hyperstructureRequiredAmounts.current_resource_total * 100n) /
          hyperstructureRequiredAmounts.needed_resource_total,
      )
    : 0;

  return {
    percentage,
    initialized: hyperstructure?.initialized || false,
  };
};

export const getHyperstructureTotalContributableAmounts = (
  hyperstructureId: number,
  components: ClientComponents,
): { resource: ResourcesIds; amount: number }[] => {
  const hyperstructure = getComponentValue(components.Hyperstructure, getEntityIdFromKeys([BigInt(hyperstructureId)]));

  if (!hyperstructure?.randomness) {
    return [];
  }

  const result: { resource: ResourcesIds; amount: number }[] = [];
  const randomness = BigInt(hyperstructure.randomness);

  for (const resourceConfig of configManager.getHyperstructureTotalCosts()) {
    const { resource, min_amount, max_amount } = resourceConfig;

    let neededAmount;
    if (min_amount === max_amount) {
      neededAmount = max_amount;
    } else {
      const uniqueResourceRandomness = randomness / BigInt(resource);
      const additional = Number(uniqueResourceRandomness % BigInt(max_amount - min_amount));
      neededAmount = min_amount + additional;
    }

    result.push({
      resource,
      amount: neededAmount,
    });
  }

  return result;
};

export const getHyperstructureCurrentAmounts = (hyperstructureId: number, components: ClientComponents) => {
  const hyperstructureRequirements = getComponentValue(
    components.HyperstructureRequirements,
    getEntityIdFromKeys([BigInt(hyperstructureId)]),
  );

  if (!hyperstructureRequirements) {
    return [];
  }

  const requiredAmounts: { resource: ResourcesIds; amount: number }[] = [];

  // Map all resources from the HyperstructureRequirements component
  if (hyperstructureRequirements.stone_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.Stone,
      amount: divideByPrecision(Number(hyperstructureRequirements.stone_amount_current)),
    });
  if (hyperstructureRequirements.coal_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.Coal,
      amount: divideByPrecision(Number(hyperstructureRequirements.coal_amount_current)),
    });
  if (hyperstructureRequirements.wood_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.Wood,
      amount: divideByPrecision(Number(hyperstructureRequirements.wood_amount_current)),
    });
  if (hyperstructureRequirements.copper_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.Copper,
      amount: divideByPrecision(Number(hyperstructureRequirements.copper_amount_current)),
    });
  if (hyperstructureRequirements.ironwood_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.Ironwood,
      amount: divideByPrecision(Number(hyperstructureRequirements.ironwood_amount_current)),
    });
  if (hyperstructureRequirements.obsidian_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.Obsidian,
      amount: divideByPrecision(Number(hyperstructureRequirements.obsidian_amount_current)),
    });
  if (hyperstructureRequirements.gold_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.Gold,
      amount: divideByPrecision(Number(hyperstructureRequirements.gold_amount_current)),
    });
  if (hyperstructureRequirements.silver_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.Silver,
      amount: divideByPrecision(Number(hyperstructureRequirements.silver_amount_current)),
    });
  if (hyperstructureRequirements.mithral_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.Mithral,
      amount: divideByPrecision(Number(hyperstructureRequirements.mithral_amount_current)),
    });
  if (hyperstructureRequirements.alchemicsilver_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.AlchemicalSilver,
      amount: divideByPrecision(Number(hyperstructureRequirements.alchemicsilver_amount_current)),
    });
  if (hyperstructureRequirements.coldiron_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.ColdIron,
      amount: divideByPrecision(Number(hyperstructureRequirements.coldiron_amount_current)),
    });
  if (hyperstructureRequirements.deepcrystal_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.DeepCrystal,
      amount: divideByPrecision(Number(hyperstructureRequirements.deepcrystal_amount_current)),
    });
  if (hyperstructureRequirements.ruby_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.Ruby,
      amount: divideByPrecision(Number(hyperstructureRequirements.ruby_amount_current)),
    });
  if (hyperstructureRequirements.diamonds_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.Diamonds,
      amount: divideByPrecision(Number(hyperstructureRequirements.diamonds_amount_current)),
    });
  if (hyperstructureRequirements.hartwood_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.Hartwood,
      amount: divideByPrecision(Number(hyperstructureRequirements.hartwood_amount_current)),
    });
  if (hyperstructureRequirements.ignium_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.Ignium,
      amount: divideByPrecision(Number(hyperstructureRequirements.ignium_amount_current)),
    });
  if (hyperstructureRequirements.twilightquartz_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.TwilightQuartz,
      amount: divideByPrecision(Number(hyperstructureRequirements.twilightquartz_amount_current)),
    });
  if (hyperstructureRequirements.trueice_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.TrueIce,
      amount: divideByPrecision(Number(hyperstructureRequirements.trueice_amount_current)),
    });
  if (hyperstructureRequirements.adamantine_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.Adamantine,
      amount: divideByPrecision(Number(hyperstructureRequirements.adamantine_amount_current)),
    });
  if (hyperstructureRequirements.sapphire_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.Sapphire,
      amount: divideByPrecision(Number(hyperstructureRequirements.sapphire_amount_current)),
    });
  if (hyperstructureRequirements.etherealsilica_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.EtherealSilica,
      amount: divideByPrecision(Number(hyperstructureRequirements.etherealsilica_amount_current)),
    });
  if (hyperstructureRequirements.dragonhide_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.Dragonhide,
      amount: divideByPrecision(Number(hyperstructureRequirements.dragonhide_amount_current)),
    });
  if (hyperstructureRequirements.labor_amount_current)
    requiredAmounts.push({
      resource: ResourcesIds.Labor,
      amount: divideByPrecision(Number(hyperstructureRequirements.labor_amount_current)),
    });

  return requiredAmounts;
};
