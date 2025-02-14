use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::constants::split_resources_and_probs;
use s1_eternum::constants::{RESOURCE_PRECISION, ResourceTypes, WORLD_CONFIG_ID};
use s1_eternum::models::config::WorldConfigUtilImpl;
use s1_eternum::models::config::{MapConfig, TroopConfig, TroopLimitConfig, TroopStaminaConfig, CapacityConfig};

use s1_eternum::models::position::{Occupier, OccupierImpl};
use s1_eternum::models::resource::resource::{
    Resource, ResourceImpl, ResourceWeightImpl, SingleResource, SingleResourceImpl, SingleResourceStoreImpl,
    WeightStoreImpl,
};
use s1_eternum::models::stamina::{Stamina, StaminaImpl};
use s1_eternum::models::structure::Structure;
use s1_eternum::models::troop::{
    ExplorerTroops, GuardImpl, GuardSlot, GuardTroops, TroopTier, TroopType, Troops, TroopsImpl,
};
use s1_eternum::models::weight::{Weight, WeightImpl};
use s1_eternum::utils::map::biomes::Biome;
use s1_eternum::utils::random;
use s1_eternum::utils::random::VRFImpl;
use starknet::ContractAddress;


#[generate_trait]
pub impl iExplorerImpl of iExplorerTrait {
    fn burn_stamina_cost(
        ref world: WorldStorage,
        ref explorer: ExplorerTroops,
        troop_stamina_config: TroopStaminaConfig,
        explore: bool,
        mut biomes: Array<Biome>,
        current_tick: u64,
    ) {
        let stamina_cost = match explore {
            true => {
                let mut stamina_cost: u128 = troop_stamina_config.stamina_explore_stamina_cost.into()
                    * biomes.len().into();
                loop {
                    match biomes.pop_front() {
                        Option::Some(biome) => {
                            let (add, stamina_bonus) = explorer
                                .troops
                                .stamina_movement_bonus(biome, troop_stamina_config);
                            if add {
                                stamina_cost += stamina_bonus.into();
                            } else {
                                if stamina_bonus.into() > stamina_cost {
                                    stamina_cost = 0;
                                } else {
                                    stamina_cost -= stamina_bonus.into();
                                }
                            }
                        },
                        Option::None => { break; },
                    }
                };

                stamina_cost
            },
            false => troop_stamina_config.stamina_travel_stamina_cost.into() * biomes.len().into(),
        };

        explorer
            .troops
            .stamina
            .spend(explorer.troops.category, troop_stamina_config, stamina_cost.try_into().unwrap(), current_tick);
    }

    fn burn_food_cost(
        ref world: WorldStorage, ref explorer: ExplorerTroops, troop_stamina_config: TroopStaminaConfig, explore: bool,
    ) {
        let (wheat_cost, fish_cost) = match explore {
            true => {
                (
                    troop_stamina_config.stamina_explore_wheat_cost.into(),
                    troop_stamina_config.stamina_explore_fish_cost.into(),
                )
            },
            false => {
                (
                    troop_stamina_config.stamina_travel_wheat_cost.into(),
                    troop_stamina_config.stamina_travel_fish_cost.into(),
                )
            },
        };

        // multiply by troop count
        let wheat_burn_amount: u128 = wheat_cost * explorer.troops.count.into();
        let fish_burn_amount: u128 = fish_cost * explorer.troops.count.into();

        // spend wheat resource
        let mut explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer.explorer_id);
        let wheat_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::WHEAT);
        let mut wheat_resource = SingleResourceStoreImpl::retrieve(
            ref world, explorer.explorer_id, ResourceTypes::WHEAT, ref explorer_weight, wheat_weight_grams, false,
        );
        wheat_resource.spend(wheat_burn_amount, ref explorer_weight, wheat_weight_grams);
        wheat_resource.store(ref world);

        // spend fish resource
        let fish_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::FISH);
        let mut fish_resource = SingleResourceStoreImpl::retrieve(
            ref world, explorer.explorer_id, ResourceTypes::FISH, ref explorer_weight, fish_weight_grams, false,
        );
        fish_resource.spend(fish_burn_amount, ref explorer_weight, fish_weight_grams);
        fish_resource.store(ref world);

        // update explorer weight
        explorer_weight.store(ref world, explorer.explorer_id);
    }

    fn update_capacity(
        ref world: WorldStorage, explorer_id: ID, explorer: ExplorerTroops, troop_amount: u128, add: bool,
    ) {
        // set structure capacity
        let capacity_config: CapacityConfig = WorldConfigUtilImpl::get_member(world, selector!("capacity_config"));
        let capacity: u128 = capacity_config.troop_capacity.into() * troop_amount;
        
        let mut troop_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
        if add {
            troop_weight.add_capacity(capacity);
        } else {
            troop_weight.deduct_capacity(capacity);
        }
        troop_weight.store(ref world, explorer_id);
    }


    fn explorer_delete(ref world: WorldStorage, ref explorer: ExplorerTroops) {
        // ensure army is dead
        assert!(explorer.troops.count.is_zero(), "explorer unit is alive");

        let occupier: Occupier = OccupierImpl::key_only(explorer.coord);
        let resource: Resource = ResourceImpl::key_only(explorer.explorer_id);

        // delete explorer
        world.erase_model(@occupier);
        world.erase_model(@explorer);
        world.erase_model(@resource);
        // todo: IMPORTANT: check the cost of erasing the resource model

    }

    fn exploration_reward(ref world: WorldStorage, config: MapConfig) -> (u8, u128) {
        let (resource_types, resources_probs) = split_resources_and_probs();

        let vrf_provider: ContractAddress = WorldConfigUtilImpl::get_member(world, selector!("vrf_provider_address"));
        let vrf_seed: u256 = VRFImpl::seed(starknet::get_caller_address(), vrf_provider);
        let reward_resource_id: u8 = *random::choices(
            resource_types, resources_probs, array![].span(), 1, true, vrf_seed,
        )
            .at(0);

        return (reward_resource_id, config.reward_resource_amount);
    }
}

#[generate_trait]
pub impl iTroopImpl of iTroopTrait {
    fn make_payment(
        ref world: WorldStorage,
        from_structure_id: ID,
        amount: u128,
        category: TroopType,
        tier: TroopTier,
        current_tick: u64,
    ) {
        let resource_type = match tier {
            TroopTier::T1 => {
                match category {
                    TroopType::Knight => ResourceTypes::KNIGHT_T1,
                    TroopType::Crossbowman => ResourceTypes::CROSSBOWMAN_T1,
                    TroopType::Paladin => ResourceTypes::PALADIN_T1,
                }
            },
            TroopTier::T2 => {
                match category {
                    TroopType::Knight => ResourceTypes::KNIGHT_T2,
                    TroopType::Crossbowman => ResourceTypes::CROSSBOWMAN_T2,
                    TroopType::Paladin => ResourceTypes::PALADIN_T2,
                }
            },
            TroopTier::T3 => {
                match category {
                    TroopType::Knight => ResourceTypes::KNIGHT_T3,
                    TroopType::Crossbowman => ResourceTypes::CROSSBOWMAN_T3,
                    TroopType::Paladin => ResourceTypes::PALADIN_T3,
                }
            },
        };

        // burn troop resource to pay for troop
        let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, from_structure_id);
        let troop_resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);
        let mut structure_troop_resource: SingleResource = SingleResourceStoreImpl::retrieve(
            ref world, from_structure_id, resource_type, ref structure_weight, troop_resource_weight_grams, true,
        );
        structure_troop_resource.spend(amount, ref structure_weight, troop_resource_weight_grams);
        structure_troop_resource.store(ref world);
    }
}


#[generate_trait]
pub impl iMercenariesImpl of iMercenariesTrait {
    fn add(
        ref world: WorldStorage,
        structure_id: ID,
        mut seed: u256,
        mut slot_tiers: Span<(GuardSlot, TroopTier, TroopType)>,
        troop_limit_config: TroopLimitConfig,
        troop_stamina_config: TroopStaminaConfig,
        current_tick: u64,
    ) {
        let mut structure: Structure = world.read_model(structure_id);
        let mut salt: u128 = 1;
        let mut guards: GuardTroops = structure.guards;

        loop {
            match slot_tiers.pop_front() {
                Option::Some((
                    slot, tier, category,
                )) => {
                    let lower_bound: u128 = troop_limit_config.mercenaries_troop_lower_bound.into()
                        * RESOURCE_PRECISION;
                    let upper_bound: u128 = troop_limit_config.mercenaries_troop_upper_bound.into()
                        * RESOURCE_PRECISION;
                    let max_troops_from_lower_bound: u128 = upper_bound - lower_bound;
                    let mut troop_amount: u128 = random::random(seed, salt, max_troops_from_lower_bound);
                    troop_amount += lower_bound;

                    // update guard count
                    structure.troop.guard_count += 1;

                    // set category and tier
                    let (mut troops, _): (Troops, u32) = guards.from_slot(*slot);
                    troops.category = *category;
                    troops.tier = *tier;
                    troops.count += troop_amount;
                    troops.stamina.refill(troops.category, troop_stamina_config, current_tick);

                    // update troop in guard slot
                    guards.to_slot(*slot, troops, current_tick);
                },
                Option::None => { break; },
            }
        };

        // update related models
        structure.guards = guards;
        world.write_model(@structure);
    }
}
