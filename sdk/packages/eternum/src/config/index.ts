import { Account } from "starknet";

// import { ARMY_ENTITY_TYPE, DONKEY_ENTITY_TYPE, EternumGlobalConfig, ResourcesIds } from "../constants";

import {
  ARMY_ENTITY_TYPE,
  BASE_POPULATION_CAPACITY,
  BUILDING_CAPACITY,
  BUILDING_POPULATION,
  BUILDING_RESOURCE_PRODUCED,
  DONKEY_ENTITY_TYPE,
  EternumGlobalConfig,
  HYPERSTRUCTURE_TIME_BETWEEN_SHARES_CHANGE_S,
  ResourcesIds,
  STAMINA_REFILL_PER_TICK,
  TROOPS_STAMINAS,
  WEIGHTS_GRAM,
} from "../constants";

import { BuildingType } from "../constants/structures";
import { EternumProvider } from "../provider";
import { ResourceInputs, ResourceOutputs, TickIds, TravelTypes } from "../types";
import { scaleResourceInputs, scaleResourceOutputs, scaleResources, uniqueResourceInputs } from "../utils";
import { EternumConfig } from "../types/config";

export class ConfigManager {
  private static _instance: ConfigManager;
  private readonly config: EternumConfig;

  private constructor(customConfig: Partial<EternumConfig> = {}) {
    this.config = { ...EternumGlobalConfig, ...customConfig };
  }

  public static instance(customConfig: Partial<EternumConfig> = {}) {
    if (!ConfigManager._instance) {
      console.log("Create instance");
      ConfigManager._instance = new ConfigManager(customConfig);
    }
    console.log("Instance already exists");
    return ConfigManager._instance;
  }

  public getConfig(): EternumConfig {
    return { ...this.config };
  }

  public getResourcePrecision(): number {
    return this.config.resources.resourcePrecision;
  }

  public getResourceInputsScaled(): ResourceInputs {
    return scaleResourceInputs(this.config.RESOURCE_INPUTS, this.config.resources.resourceMultiplier);
  }

  public getResourceOutputsScaled(): ResourceOutputs {
    return scaleResourceOutputs(this.config.RESOURCE_OUTPUTS, this.config.resources.resourceMultiplier);
  }

  public getBuildingCostsScaled(): ResourceInputs {
    return scaleResourceInputs(this.config.BUILDING_COSTS, this.config.resources.resourceMultiplier);
  }

  public getStructureCostsScaled(): ResourceInputs {
    return scaleResourceInputs(this.config.STRUCTURE_COSTS, this.config.resources.resourceMultiplier);
  }

  public getResourceBuildingCostsScaled(): ResourceInputs {
    return scaleResourceInputs(this.config.RESOURCE_BUILDING_COSTS, this.config.resources.resourceMultiplier);
  }

  public getHyperstructureTotalCostsScaled(): { resource: number; amount: number }[] {
    const hyperstructure_total_costs = [
      ...this.config.HYPERSTRUCTURE_CONSTRUCTION_COSTS,
      ...this.config.HYPERSTRUCTURE_CREATION_COSTS,
    ];

    return scaleResources(hyperstructure_total_costs, this.config.resources.resourceMultiplier);
  }

  public getTotalContributableAmount(): number {
    return this.getHyperstructureTotalCostsScaled().reduce((total, { resource, amount }) => {
      return total + (this.config.ResourceMultipliers[resource] ?? 0) * amount;
    }, 0);
  }

  public getStartingResources = (resourcesOnRealm: number[]): ResourceInputs => {
    let QUEST_RESOURCES_SCALED: ResourceInputs = scaleResourceInputs(
      this.config.QUEST_RESOURCES,
      this.config.resources.resourceMultiplier,
    );
    return this.applyInputProductionFactor(QUEST_RESOURCES_SCALED, resourcesOnRealm);
  };

  public setConfigs = async (account: Account, provider: EternumProvider) => {
    await this.setProductionConfig(account, provider);
    await this.setBuildingCategoryPopConfig(account, provider);
    await this.setPopulationConfig(account, provider);
    await this.setBuildingConfig(account, provider);
    await this.setResourceBuildingConfig(account, provider);
    await this.setWeightConfig(account, provider);
    await this.setCombatConfig(account, provider);
    await this.setHyperstructureConfig(account, provider);
    await this.setStaminaConfig(account, provider);
    await this.setMercenariesConfig(account, provider);
    await this.setupGlobals(account, provider);
    await this.setCapacityConfig(account, provider);
    await this.setSpeedConfig(account, provider);
  };

  private applyInputProductionFactor = (questResources: ResourceInputs, resourcesOnRealm: number[]): ResourceInputs => {
    for (let resourceInput of uniqueResourceInputs(resourcesOnRealm).filter(
      (id) => id != ResourcesIds.Wheat && id != ResourcesIds.Fish,
    )) {
      for (let questType in questResources) {
        questResources[questType] = questResources[questType].map((questResource) => {
          if (questResource.resource === resourceInput) {
            return {
              ...questResource,
              amount: questResource.amount * this.config.resources.startingResourcesInputProductionFactor,
            };
          }
          return questResource;
        });
      }
    }
    return questResources;
  };

  private setProductionConfig = async (account: Account, provider: EternumProvider) => {
    const calldataArray = [];
    const resource_inputs_scaled = this.getResourceInputsScaled();
    const resource_outputs_scaled = this.getResourceOutputsScaled();

    for (const resourceId of Object.keys(resource_inputs_scaled) as unknown as ResourcesIds[]) {
      const calldata = {
        amount: resource_outputs_scaled[resourceId],
        resource_type: resourceId,
        cost: resource_inputs_scaled[resourceId].map((cost) => {
          return {
            ...cost,
            amount: cost.amount,
          };
        }),
      };

      calldataArray.push(calldata);
    }

    const tx = await provider.set_production_config({ signer: account, calls: calldataArray });

    console.log(`Configuring resource production ${tx.statusReceipt}...`);
  };

  private setBuildingCategoryPopConfig = async (account: Account, provider: EternumProvider) => {
    const calldataArray = [];

    for (const buildingId of Object.keys(this.config.BUILDING_POPULATION) as unknown as BuildingType[]) {
      const building_population = this.config.BUILDING_POPULATION[buildingId];
      const building_capacity = this.config.BUILDING_CAPACITY[buildingId];

      // if both 0, tx will fail
      if (building_population !== 0 || building_capacity !== 0) {
        const callData = {
          building_category: buildingId,
          population: building_population,
          capacity: building_capacity,
        };

        calldataArray.push(callData);
      }
    }


    // const tx = await provider.set_building_category_pop_config({

  const tx = await provider.set_building_config({ signer: account, calls: calldataArray });

  console.log(`Configuring resource building cost config ${tx.statusReceipt}...`);
};

export const setWeightConfig = async (account: Account, provider: EternumProvider) => {
  const calldataArray = Object.entries(WEIGHTS_GRAM).map(([resourceId, weight]) => ({
    entity_type: resourceId,
    weight_gram: weight,
  }));

  const tx = await provider.set_weight_config({
    signer: account,
    calls: calldataArray,
  });

  console.log(`Configuring weight config  ${tx.statusReceipt}...`);
};

export const setCombatConfig = async (account: Account, provider: EternumProvider) => {
  const {
    health: health,
    knightStrength: knight_strength,
    paladinStrength: paladin_strength,
    crossbowmanStrength: crossbowman_strength,
    advantagePercent: advantage_percent,
    disadvantagePercent: disadvantage_percent,
    pillageHealthDivisor: pillage_health_divisor,
    baseArmyNumberForStructure: army_free_per_structure,
    armyExtraPerMilitaryBuilding: army_extra_per_military_building,
  } = EternumGlobalConfig.troop;

  const tx = await provider.set_troop_config({
    signer: account,
    config_id: 0,
    health,
    knight_strength,
    paladin_strength,
    crossbowman_strength,
    advantage_percent,
    disadvantage_percent,
    pillage_health_divisor: pillage_health_divisor,
    army_free_per_structure: army_free_per_structure,
    army_extra_per_military_building: army_extra_per_military_building,
  });

  console.log(`Configuring combat config ${tx.statusReceipt}...`);
};

export const setupGlobals = async (account: Account, provider: EternumProvider) => {
  // Set the bank config
  const txBank = await provider.set_bank_config({
    signer: account,
    lords_cost: EternumGlobalConfig.banks.lordsCost * EternumGlobalConfig.resources.resourcePrecision,
    lp_fee_num: EternumGlobalConfig.banks.lpFeesNumerator,
    lp_fee_denom: EternumGlobalConfig.banks.lpFeesDenominator,
  });

  console.log(`Configuring bank config ${txBank.statusReceipt}...`);

  const txDefaultTick = await provider.set_tick_config({
    signer: account,
    tick_id: TickIds.Default,
    tick_interval_in_seconds: EternumGlobalConfig.tick.defaultTickIntervalInSeconds,
  });
  console.log(`Configuring tick config ${txDefaultTick.statusReceipt}...`);

  const txArmiesTick = await provider.set_tick_config({
    signer: account,
    tick_id: TickIds.Armies,
    tick_interval_in_seconds: EternumGlobalConfig.tick.armiesTickIntervalInSeconds,
  });

  console.log(`Configuring tick config ${txArmiesTick.statusReceipt}...`);

  const txExplore = await provider.set_exploration_config({
    signer: account,
    wheat_burn_amount: EternumGlobalConfig.exploration.wheatBurn * EternumGlobalConfig.resources.resourcePrecision,
    fish_burn_amount: EternumGlobalConfig.exploration.fishBurn * EternumGlobalConfig.resources.resourcePrecision,
    reward_amount: EternumGlobalConfig.exploration.reward * EternumGlobalConfig.resources.resourcePrecision,
    shards_mines_fail_probability: EternumGlobalConfig.exploration.shardsMinesFailProbability,
  });

  console.log(`Configuring exploration config ${txExplore.statusReceipt}...`);
};

export const setCapacityConfig = async (account: Account, provider: EternumProvider) => {
  const txDonkey = await provider.set_capacity_config({
    signer: account,
    entity_type: DONKEY_ENTITY_TYPE,
    weight_gram: EternumGlobalConfig.carryCapacityGram.donkey,
  });

  console.log(`Configuring capacity Donkey config ${txDonkey.statusReceipt}...`);

  const txArmy = await provider.set_capacity_config({
    signer: account,
    entity_type: ARMY_ENTITY_TYPE,
    weight_gram: EternumGlobalConfig.carryCapacityGram.army,
  });

  console.log(`Configuring capacity Army config ${txArmy.statusReceipt}...`);
};

export const setSpeedConfig = async (account: Account, provider: EternumProvider) => {
  const txDonkey = await provider.set_speed_config({
    signer: account,
    entity_type: DONKEY_ENTITY_TYPE,
    sec_per_km: EternumGlobalConfig.speed.donkey,
  });

  console.log(`Configuring speed Donkey config ${txDonkey.statusReceipt}...`);

  const txArmy = await provider.set_speed_config({
    signer: account,
    entity_type: ARMY_ENTITY_TYPE,
    sec_per_km: EternumGlobalConfig.speed.army,
  });

  console.log(`Configuring speed Army config ${txArmy.statusReceipt}...`);
};

export const setHyperstructureConfig = async (account: Account, provider: EternumProvider) => {
  const tx = await provider.set_hyperstructure_config({
    signer: account,
    time_between_shares_change: HYPERSTRUCTURE_TIME_BETWEEN_SHARES_CHANGE_S,
    resources_for_completion: HYPERSTRUCTURE_TOTAL_COSTS_SCALED.map((resource) => ({
      ...resource,
      amount: resource.amount * EternumGlobalConfig.resources.resourcePrecision,
    })),
  });
  console.log(`Configuring hyperstructure ${tx.statusReceipt}...`);
};

export const setStaminaConfig = async (account: Account, provider: EternumProvider) => {
  for (const [unit_type, stamina] of Object.entries(TROOPS_STAMINAS)) {
    const tx = await provider.set_stamina_config({

      signer: account,
      calls: calldataArray,
    });


  //   console.log(`Configuring building category population ${tx.statusReceipt}...`);
  // };

  // private setPopulationConfig = async (account: Account, provider: EternumProvider) => {
  //   const tx = await provider.set_population_config({
  //     signer: account,
  //     base_population: this.config.basePopulationCapacity,
  //   });

  //   console.log(`Configuring population config ${tx.statusReceipt}...`);
  // };

  // private setBuildingConfig = async (account: Account, provider: EternumProvider) => {
  //   const calldataArray = [];
  //   const buildingCostsScaled = this.getBuildingCostsScaled();

  //   for (const buildingId of Object.keys(this.config.BUILDING_RESOURCE_PRODUCED) as unknown as BuildingType[]) {
  //     if (buildingCostsScaled[buildingId].length !== 0) {
  //       const calldata = {
  //         building_category: buildingId,
  //         building_resource_type: this.config.BUILDING_RESOURCE_PRODUCED[buildingId],
  //         cost_of_building: buildingCostsScaled[buildingId].map((cost) => {
  //           return {
  //             ...cost,
  //             amount: cost.amount * this.config.resources.resourcePrecision,
  //           };
  //         }),
  //       };

  //       calldataArray.push(calldata);
  //     }
  //   }

  //   const tx = await provider.set_building_config({ signer: account, calls: calldataArray });

  //   console.log(`Configuring building cost config ${tx.statusReceipt}...`);
  // };

  // private setResourceBuildingConfig = async (account: Account, provider: EternumProvider) => {
  //   const calldataArray = [];
  //   const resourceBuildingCostsScaled = this.getResourceBuildingCostsScaled();

  //   for (const resourceId of Object.keys(resourceBuildingCostsScaled) as unknown as ResourcesIds[]) {
  //     const calldata = {
  //       building_category: BuildingType.Resource,
  //       building_resource_type: resourceId,
  //       cost_of_building: resourceBuildingCostsScaled[resourceId].map((cost) => {
  //         return {
  //           ...cost,
  //           amount: cost.amount * this.config.resources.resourcePrecision,
  //         };
  //       }),
  //     };

  //     calldataArray.push(calldata);
  //   }

  //   const tx = await provider.set_building_config({ signer: account, calls: calldataArray });

  //   console.log(`Configuring resource building cost config ${tx.statusReceipt}...`);
  // };

  // private setWeightConfig = async (account: Account, provider: EternumProvider) => {
  //   const calldataArray = Object.entries(this.config.WEIGHTS).map(([resourceId, weight]) => ({
  //     entity_type: resourceId,
  //     weight_gram: weight * this.config.resources.resourceMultiplier,
  //   }));

  //   const tx = await provider.set_weight_config({
  //     signer: account,
  //     calls: calldataArray,
  //   });

  //   console.log(`Configuring weight config  ${tx.statusReceipt}...`);
  // };

  // private setCombatConfig = async (account: Account, provider: EternumProvider) => {
  //   const {
  //     health: health,
  //     knightStrength: knight_strength,
  //     paladinStrength: paladin_strength,
  //     crossbowmanStrength: crossbowman_strength,
  //     advantagePercent: advantage_percent,
  //     disadvantagePercent: disadvantage_percent,
  //     pillageHealthDivisor: pillage_health_divisor,
  //     baseArmyNumberForStructure: army_free_per_structure,
  //     armyExtraPerMilitaryBuilding: army_extra_per_military_building,
  // } = this.config.troop;

  //   const tx = await provider.set_troop_config({
  //     signer: account,
  //     config_id: 0,
  //     health,
  //     knight_strength,
  //     paladin_strength,
  //     crossbowman_strength,
  //     advantage_percent,
  //     disadvantage_percent,
  //     pillage_health_divisor,
  //     army_free_per_structure: army_free_per_structure,
  //     army_extra_per_military_building: army_extra_per_military_building,

export const setStaminaRefillConfig = async (account: Account, provider: EternumProvider) => {
  const tx = await provider.set_stamina_refill_config({
    signer: account,
    amount_per_tick: STAMINA_REFILL_PER_TICK,
  });
  console.log(`Configuring stamina refill per tick to ${STAMINA_REFILL_PER_TICK} ${tx.statusReceipt}...`);
};

export const setMercenariesConfig = async (account: Account, provider: EternumProvider) => {
  const tx = await provider.set_mercenaries_config({
    signer: account,
    troops: {
      knight_count:
        BigInt(EternumGlobalConfig.mercenaries.troops.knight_count) *
        BigInt(EternumGlobalConfig.resources.resourcePrecision),
      paladin_count:
        BigInt(EternumGlobalConfig.mercenaries.troops.paladin_count) *
        BigInt(EternumGlobalConfig.resources.resourcePrecision),
      crossbowman_count:
        BigInt(EternumGlobalConfig.mercenaries.troops.crossbowman_count) *
        BigInt(EternumGlobalConfig.resources.resourcePrecision),
    },
    rewards: EternumGlobalConfig.mercenaries.rewards.map((reward) => ({
      resource: reward.resource,
      amount:
        reward.amount *
        EternumGlobalConfig.resources.resourcePrecision *
        EternumGlobalConfig.resources.resourceMultiplier,
    })),

  });

    console.log(`Configuring combat config ${tx.statusReceipt}...`);
  };

  private setupGlobals = async (account: Account, provider: EternumProvider) => {
    // Set the bank config
    const txBank = await provider.set_bank_config({
      signer: account,
      lords_cost: this.config.banks.lordsCost * this.config.resources.resourcePrecision,
      lp_fee_num: this.config.banks.lpFeesNumerator,
      lp_fee_denom: this.config.banks.lpFeesDenominator,
    });

    console.log(`Configuring bank config ${txBank.statusReceipt}...`);

    const txDefaultTick = await provider.set_tick_config({
      signer: account,
      tick_id: TickIds.Default,
      tick_interval_in_seconds: this.config.tick.defaultTickIntervalInSeconds,
    });
    console.log(`Configuring tick config ${txDefaultTick.statusReceipt}...`);

    const txArmiesTick = await provider.set_tick_config({
      signer: account,
      tick_id: TickIds.Armies,
      tick_interval_in_seconds: this.config.tick.armiesTickIntervalInSeconds,
    });

    console.log(`Configuring tick config ${txArmiesTick.statusReceipt}...`);

    const txExplore = await provider.set_exploration_config({
      signer: account,
      wheat_burn_amount: this.config.exploration.costs[ResourcesIds.Wheat] * this.config.resources.resourcePrecision,
      fish_burn_amount: this.config.exploration.costs[ResourcesIds.Fish] * this.config.resources.resourcePrecision,
      reward_amount: this.config.exploration.reward * this.config.resources.resourcePrecision,
      shards_mines_fail_probability: this.config.exploration.shardsMinesFailProbability,
    });

    console.log(`Configuring exploration config ${txExplore.statusReceipt}...`);

    const txExploreStaminaCost = await provider.set_travel_stamina_cost_config({
      signer: account,
      travel_type: TravelTypes.Explore,
      cost: this.config.staminaCost.explore,
    });
    console.log(`Configuring explore stamina cost config ${txExploreStaminaCost.statusReceipt}...`);

    const txTravelStaminaCost = await provider.set_travel_stamina_cost_config({
      signer: account,
      travel_type: TravelTypes.Travel,
      cost: this.config.staminaCost.travel,
    });

    console.log(`Configuring travel stamina cost config ${txTravelStaminaCost.statusReceipt}...`);
  };

  private setCapacityConfig = async (account: Account, provider: EternumProvider) => {
    const txDonkey = await provider.set_capacity_config({
      signer: account,
      entity_type: DONKEY_ENTITY_TYPE,
      weight_gram: this.config.carryCapacity.donkey * this.config.resources.resourcePrecision,
    });

    console.log(`Configuring capacity Donkey config ${txDonkey.statusReceipt}...`);

    const txArmy = await provider.set_capacity_config({
      signer: account,
      entity_type: ARMY_ENTITY_TYPE,
      weight_gram: this.config.carryCapacity.army * this.config.resources.resourcePrecision,
    });

    console.log(`Configuring capacity Army config ${txArmy.statusReceipt}...`);
  };

  private setSpeedConfig = async (account: Account, provider: EternumProvider) => {
    const txDonkey = await provider.set_speed_config({
      signer: account,
      entity_type: DONKEY_ENTITY_TYPE,
      sec_per_km: this.config.speed.donkey,
    });

    console.log(`Configuring speed Donkey config ${txDonkey.statusReceipt}...`);

    const txArmy = await provider.set_speed_config({
      signer: account,
      entity_type: ARMY_ENTITY_TYPE,
      sec_per_km: this.config.speed.army,
    });

    console.log(`Configuring speed Army config ${txArmy.statusReceipt}...`);
  };

  private setHyperstructureConfig = async (account: Account, provider: EternumProvider) => {
    const hyperstructureTotalCostsScaled = this.getHyperstructureTotalCostsScaled();

    const tx = await provider.set_hyperstructure_config({
      signer: account,
      resources_for_completion: hyperstructureTotalCostsScaled.map((resource) => ({
        ...resource,
        amount: resource.amount * this.config.resources.resourcePrecision,
      })),
    });
    console.log(`Configuring hyperstructure ${tx.statusReceipt}...`);
  };

  private setStaminaConfig = async (account: Account, provider: EternumProvider) => {
    for (const [unit_type, stamina] of Object.entries(this.config.TROOPS_STAMINAS)) {
      const tx = await provider.set_stamina_config({
        signer: account,
        unit_type: unit_type,
        max_stamina: stamina,
      });
      console.log(`Configuring staminas ${unit_type} ${tx.statusReceipt}...`);
    }
  };

  private setMercenariesConfig = async (account: Account, provider: EternumProvider) => {
    const tx = await provider.set_mercenaries_config({
      signer: account,
      troops: {
        knight_count:
          BigInt(this.config.mercenaries.troops.knight_count) * BigInt(this.config.resources.resourcePrecision),
        paladin_count:
          BigInt(this.config.mercenaries.troops.paladin_count) * BigInt(this.config.resources.resourcePrecision),
        crossbowman_count:
          BigInt(this.config.mercenaries.troops.crossbowman_count) * BigInt(this.config.resources.resourcePrecision),
      },
      rewards: this.config.mercenaries.rewards.map((reward) => ({
        resource: reward.resourceId,
        amount: reward.amount * this.config.resources.resourcePrecision * this.config.resources.resourceMultiplier,
      })),
    });
    console.log(`Configuring mercenaries ${tx.statusReceipt}...`);
  };
}
