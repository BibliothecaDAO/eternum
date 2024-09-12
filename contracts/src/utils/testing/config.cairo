use core::array::{SpanTrait, ArrayTrait, SpanIndex};
use core::integer::BoundedU128;
use core::ops::index::IndexView;
use eternum::constants::{
    ResourceTypes, RESOURCE_PRECISION, WORLD_CONFIG_ID, ARMY_ENTITY_TYPE, DONKEY_ENTITY_TYPE, TickIds
};

use eternum::models::{
    config::TroopConfig, combat::Troops, config::CapacityConfig, config::CapacityConfigCategory, config::MapConfig
};

use eternum::systems::config::contracts::{
    ITroopConfigDispatcher, ITroopConfigDispatcherTrait, IStaminaConfigDispatcher, IStaminaConfigDispatcherTrait,
    IStaminaRefillConfigDispatcher, IStaminaRefillConfigDispatcherTrait, ICapacityConfigDispatcher,
    ICapacityConfigDispatcherTrait, ITransportConfigDispatcher, ITransportConfigDispatcherTrait,
    IMercenariesConfigDispatcher, IMercenariesConfigDispatcherTrait, IBankConfigDispatcher, IBankConfigDispatcherTrait,
    ITickConfigDispatcher, ITickConfigDispatcherTrait, IMapConfigDispatcher, IMapConfigDispatcherTrait,
    IWeightConfigDispatcher, IWeightConfigDispatcherTrait, IProductionConfigDispatcher, IProductionConfigDispatcherTrait
};

use eternum::utils::testing::constants::{
    get_resource_weights, MAP_EXPLORE_EXPLORATION_WHEAT_BURN_AMOUNT, MAP_EXPLORE_EXPLORATION_FISH_BURN_AMOUNT,
    MAP_EXPLORE_TRAVEL_WHEAT_BURN_AMOUNT, MAP_EXPLORE_TRAVEL_FISH_BURN_AMOUNT, MAP_EXPLORE_RANDOM_MINT_AMOUNT,
    SHARDS_MINE_FAIL_PROBABILITY_WEIGHT, LORDS_COST, LP_FEES_NUM, LP_FEE_DENOM, STOREHOUSE_CAPACITY_GRAMS,
    EARTHEN_SHARD_PRODUCTION_AMOUNT_PER_TICK
};

use starknet::{ContractAddress};

fn setup_globals(config_systems_address: ContractAddress) {
    set_bank_config(config_systems_address);
    set_tick_config(config_systems_address);
    set_map_config(config_systems_address);
}

fn set_bank_config(config_systems_address: ContractAddress) {
    IBankConfigDispatcher { contract_address: config_systems_address }
        .set_bank_config(LORDS_COST, LP_FEES_NUM, LP_FEE_DENOM);
}

fn set_tick_config(config_systems_address: ContractAddress) {
    ITickConfigDispatcher { contract_address: config_systems_address }.set_tick_config(TickIds::DEFAULT, 1);
    ITickConfigDispatcher { contract_address: config_systems_address }.set_tick_config(TickIds::ARMIES, 7200);
}

fn set_map_config(config_systems_address: ContractAddress) {
    let map_config = MapConfig {
        config_id: WORLD_CONFIG_ID,
        explore_wheat_burn_amount: MAP_EXPLORE_EXPLORATION_WHEAT_BURN_AMOUNT,
        explore_fish_burn_amount: MAP_EXPLORE_EXPLORATION_FISH_BURN_AMOUNT,
        travel_wheat_burn_amount: MAP_EXPLORE_TRAVEL_WHEAT_BURN_AMOUNT,
        travel_fish_burn_amount: MAP_EXPLORE_TRAVEL_FISH_BURN_AMOUNT,
        reward_resource_amount: MAP_EXPLORE_RANDOM_MINT_AMOUNT,
        shards_mines_fail_probability: SHARDS_MINE_FAIL_PROBABILITY_WEIGHT
    };

    IMapConfigDispatcher { contract_address: config_systems_address }.set_map_config(map_config);
}

fn get_combat_config() -> TroopConfig {
    return TroopConfig {
        config_id: WORLD_CONFIG_ID,
        health: 7_200,
        knight_strength: 1,
        paladin_strength: 1,
        crossbowman_strength: 1,
        advantage_percent: 1000,
        disadvantage_percent: 1000,
        max_troop_count: 10_000_000_000_000 * 1000,
        pillage_health_divisor: 8,
        army_free_per_structure: 100,
        army_extra_per_building: 100,
        battle_leave_slash_num: 25,
        battle_leave_slash_denom: 100
    };
}

fn set_combat_config(config_systems_address: ContractAddress) {
    let troop_config = get_combat_config();
    ITroopConfigDispatcher { contract_address: config_systems_address }.set_troop_config(troop_config);
}

fn set_mine_production_config(config_systems_address: ContractAddress) {
    IProductionConfigDispatcher { contract_address: config_systems_address }
        .set_production_config(ResourceTypes::EARTHEN_SHARD, EARTHEN_SHARD_PRODUCTION_AMOUNT_PER_TICK, array![].span());
}

fn set_stamina_config(config_systems_address: ContractAddress) {
    IStaminaRefillConfigDispatcher { contract_address: config_systems_address }.set_stamina_refill_config(100);
    IStaminaConfigDispatcher { contract_address: config_systems_address }
        .set_stamina_config(ResourceTypes::PALADIN, 100);
    IStaminaConfigDispatcher { contract_address: config_systems_address }.set_stamina_config(ResourceTypes::KNIGHT, 80);
    IStaminaConfigDispatcher { contract_address: config_systems_address }
        .set_stamina_config(ResourceTypes::CROSSBOWMAN, 80);
}


fn set_capacity_config(config_systems_address: ContractAddress) {
    ICapacityConfigDispatcher { contract_address: config_systems_address }
        .set_capacity_config(
            CapacityConfig { category: CapacityConfigCategory::Structure, weight_gram: BoundedU128::max(), }
        );

    ICapacityConfigDispatcher { contract_address: config_systems_address }
        .set_capacity_config(CapacityConfig { category: CapacityConfigCategory::Donkey, weight_gram: 100_000, });

    ICapacityConfigDispatcher { contract_address: config_systems_address }
        .set_capacity_config(CapacityConfig { category: CapacityConfigCategory::Army, weight_gram: 300_000, });

    ICapacityConfigDispatcher { contract_address: config_systems_address }
        .set_capacity_config(
            CapacityConfig { category: CapacityConfigCategory::Storehouse, weight_gram: STOREHOUSE_CAPACITY_GRAMS, }
        );
}

fn set_speed_config(config_systems_address: ContractAddress) {
    ITransportConfigDispatcher { contract_address: config_systems_address }.set_speed_config(ARMY_ENTITY_TYPE, 1);
    ITransportConfigDispatcher { contract_address: config_systems_address }.set_speed_config(DONKEY_ENTITY_TYPE, 60);
}

fn set_mercenaries_config(config_systems_address: ContractAddress) {
    let mercenaries_troops = Troops { knight_count: 4_000_000, paladin_count: 4_000_000, crossbowman_count: 4_000_000 };

    let mercenaries_rewards = array![(ResourceTypes::WHEAT, 10_000), (ResourceTypes::FISH, 20_000)].span();

    IMercenariesConfigDispatcher { contract_address: config_systems_address }
        .set_mercenaries_config(mercenaries_troops, mercenaries_rewards);
}

fn set_weight_config(config_systems_address: ContractAddress) {
    let resource_weights = get_resource_weights();
    let mut i = 0;
    while i < resource_weights.len() {
        let (resource_id, weight) = *resource_weights.at(i);
        IWeightConfigDispatcher { contract_address: config_systems_address }
            .set_weight_config(resource_id.into(), weight);
        i += 1;
    }
}

