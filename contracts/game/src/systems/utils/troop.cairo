use core::num::traits::zero::Zero;
use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::constants::split_resources_and_probs;
use s1_eternum::constants::{RESOURCE_PRECISION, ResourceTypes};
use s1_eternum::models::config::WorldConfigUtilImpl;
use s1_eternum::models::config::{CapacityConfig, MapConfig, TickConfig, TickImpl, TroopLimitConfig, TroopStaminaConfig};

use s1_eternum::models::position::{Occupied, OccupiedImpl};
use s1_eternum::models::resource::resource::{
    Resource, ResourceImpl, ResourceWeightImpl, SingleResource, SingleResourceImpl, SingleResourceStoreImpl,
    WeightStoreImpl,
};
use s1_eternum::models::stamina::{StaminaImpl};
use s1_eternum::models::structure::{
    StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureTroopExplorerStoreImpl,
    StructureTroopGuardStoreImpl,
};
use s1_eternum::models::troop::{
    ExplorerTroops, GuardImpl, GuardSlot, GuardTroops, TroopTier, TroopType, Troops, TroopsImpl,
};
use s1_eternum::models::weight::{Weight, WeightImpl};
use s1_eternum::utils::map::biomes::Biome;
use s1_eternum::utils::random;
use s1_eternum::utils::random::VRFImpl;
use starknet::ContractAddress;


#[generate_trait]
pub impl iGuardImpl of iGuardTrait {
    fn add(
        ref world: WorldStorage,
        structure_id: ID,
        ref structure_base: StructureBase,
        ref guards: GuardTroops,
        ref troops: Troops,
        slot: GuardSlot,
        category: TroopType,
        tier: TroopTier,
        troops_destroyed_tick: u32,
        amount: u128,
        tick: TickConfig,
        troop_limit_config: TroopLimitConfig,
        troop_stamina_config: TroopStaminaConfig,
    ) {
        let current_tick: u64 = tick.current();
        if troops.count.is_zero() {
            // ensure delay from troop defeat is over
            if troops_destroyed_tick.is_non_zero() {
                let next_troop_update_at = troops_destroyed_tick
                    + tick.convert_from_seconds(troop_limit_config.guard_resurrection_delay.into()).try_into().unwrap();
                assert!(
                    current_tick >= next_troop_update_at.into(),
                    "you need to wait for the delay from troop defeat to be over",
                );
            }

            // ensure structure has not reached the hard limit of guards
            assert!(
                structure_base.troop_guard_count < structure_base.troop_max_guard_count.into(),
                "reached limit of guards per structure",
            );

            // update guard count
            structure_base.troop_guard_count += 1;

            // set category and tier
            troops.category = category;
            troops.tier = tier;
        }

        // update stamina
        troops.stamina.refill(troops.category, troop_stamina_config, current_tick);
        // force stamina to be 0 so it isn't gamed
        // through the refill function and guard deletion
        if troops.count.is_zero() {
            troops.stamina.amount = 0;
        }

        // update troop count
        troops.count += amount;

        // ensure structure troop count does not exceed max count
        assert!(
            troops.count <= troop_limit_config.explorer_guard_max_troop_count.into() * RESOURCE_PRECISION,
            "reached limit of structure guard troop count",
        );

        // update guard slot and structure
        guards.to_slot(slot, troops, troops_destroyed_tick.try_into().unwrap());
    }


    fn delete(
        ref world: WorldStorage,
        structure_id: ID,
        ref structure_base: StructureBase,
        ref guards: GuardTroops,
        ref troops: Troops,
        troops_destroyed_tick: u32,
        slot: GuardSlot,
        current_tick: u64,
    ) {
        // clear troop
        troops.count = 0;
        troops.stamina.reset(current_tick);
        // note: mitigate exploits if we decide to change destroy_tick to a different value
        guards.to_slot(slot, troops, troops_destroyed_tick.try_into().unwrap());
        StructureTroopGuardStoreImpl::store(ref guards, ref world, structure_id);

        // reduce structure guard count
        structure_base.troop_guard_count -= 1;
        StructureBaseStoreImpl::store(ref structure_base, ref world, structure_id);
    }
}


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
        let mut stamina_cost: u128 = match explore {
            true => { troop_stamina_config.stamina_explore_stamina_cost.into() * biomes.len().into() },
            false => troop_stamina_config.stamina_travel_stamina_cost.into() * biomes.len().into(),
        };

        let mut total_additional_stamina_cost: u128 = 0;
        let mut total_deducted_stamina_cost: u128 = 0;
        loop {
            match biomes.pop_front() {
                Option::Some(biome) => {
                    let (add, stamina_bonus) = explorer.troops.stamina_movement_bonus(biome, troop_stamina_config);
                    if add {
                        total_additional_stamina_cost += stamina_bonus.into();
                    } else {
                        total_deducted_stamina_cost += stamina_bonus.into();
                    }
                },
                Option::None => { break; },
            }
        };

        stamina_cost += total_additional_stamina_cost;
        if total_deducted_stamina_cost > stamina_cost {
            stamina_cost = 0;
        } else {
            stamina_cost -= total_deducted_stamina_cost;
        }
        explorer
            .troops
            .stamina
            .spend(
                explorer.troops.category, troop_stamina_config, stamina_cost.try_into().unwrap(), current_tick, true,
            );
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
        // todo: revisit who should pay food cost
        let mut explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer.owner);
        let wheat_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::WHEAT);
        let mut wheat_resource = SingleResourceStoreImpl::retrieve(
            ref world, explorer.owner, ResourceTypes::WHEAT, ref explorer_weight, wheat_weight_grams, true,
        );
        wheat_resource.spend(wheat_burn_amount, ref explorer_weight, wheat_weight_grams);
        wheat_resource.store(ref world);

        // spend fish resource
        let fish_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::FISH);
        let mut fish_resource = SingleResourceStoreImpl::retrieve(
            ref world, explorer.owner, ResourceTypes::FISH, ref explorer_weight, fish_weight_grams, true,
        );
        fish_resource.spend(fish_burn_amount, ref explorer_weight, fish_weight_grams);
        fish_resource.store(ref world);

        // update explorer weight
        explorer_weight.store(ref world, explorer.owner);
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


    fn explorer_delete(
        ref world: WorldStorage,
        ref explorer: ExplorerTroops,
        structure_explorers: Array<ID>,
        ref structure_base: StructureBase,
        structure_id: ID,
    ) {
        // ensure army is dead
        assert!(explorer.troops.count.is_zero(), "explorer unit is alive");

        // todo: check if this will cause panic if explorer count is too high
        //       and delete is called after another army wins a battle against this

        // remove explorer from structure
        let mut new_explorers: Array<ID> = array![];
        for explorer_id in structure_explorers {
            if explorer_id != explorer.explorer_id {
                new_explorers.append(explorer_id);
            }
        };
        StructureTroopExplorerStoreImpl::store(new_explorers.span(), ref world, structure_id);

        // update structure base
        structure_base.troop_explorer_count -= 1;
        StructureBaseStoreImpl::store(ref structure_base, ref world, structure_id);

        let occupied: Occupied = OccupiedImpl::key_only(explorer.coord);
        let resource: Resource = ResourceImpl::key_only(explorer.explorer_id);

        // delete explorer
        world.erase_model(@occupied);
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

        return (reward_resource_id, config.reward_resource_amount.into() * RESOURCE_PRECISION);
    }
}

#[generate_trait]
pub impl iTroopImpl of iTroopTrait {
    fn make_payment(
        ref world: WorldStorage, from_structure_id: ID, amount: u128, category: TroopType, tier: TroopTier,
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

        // ensure amount is fully divisible by resource precision
        assert!(amount % RESOURCE_PRECISION == 0, "amount must be divisible by resource precision");
        assert!(amount > 0, "amount must be greater than 0");

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
        tick: TickConfig,
    ) {
        let mut structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
        let mut structure_guards: GuardTroops = StructureTroopGuardStoreImpl::retrieve(ref world, structure_id);
        let mut salt: u128 = 1;

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
                    let (mut troops, _): (Troops, u32) = structure_guards.from_slot(*slot);

                    iGuardImpl::add(
                        ref world,
                        structure_id,
                        ref structure_base,
                        ref structure_guards,
                        ref troops,
                        *slot,
                        *category,
                        *tier,
                        0,
                        troop_amount,
                        tick,
                        troop_limit_config,
                        troop_stamina_config,
                    );
                },
                Option::None => { break; },
            }
        };

        // update structure guard store
        StructureTroopGuardStoreImpl::store(ref structure_guards, ref world, structure_id);

        // update structure base
        StructureBaseStoreImpl::store(ref structure_base, ref world, structure_id);
    }
}
