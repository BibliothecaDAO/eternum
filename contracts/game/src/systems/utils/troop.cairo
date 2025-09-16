use core::num::traits::zero::Zero;
use dojo::event::EventStorage;
use dojo::model::ModelStorage;
use dojo::world::{IWorldDispatcherTrait, WorldStorage};
use s1_eternum::alias::ID;
use s1_eternum::constants::{
    DAYDREAMS_AGENT_ID, RESOURCE_PRECISION, ResourceTypes, WORLD_CONFIG_ID, split_blitz_exploration_reward_and_probs,
    split_resources_and_probs,
};
use s1_eternum::models::agent::{AgentConfig, AgentCountImpl, AgentLordsMintedImpl, AgentOwner};
use s1_eternum::models::config::{
    AgentControllerConfig, CapacityConfig, CombatConfigImpl, MapConfig, TickImpl, TickInterval, TroopLimitConfig,
    TroopStaminaConfig, WorldConfigUtilImpl,
};
use s1_eternum::models::map::{Tile, TileImpl, TileOccupier};
use s1_eternum::models::name::AddressName;
use s1_eternum::models::owner::OwnerAddressTrait;
use s1_eternum::models::position::{Coord, CoordImpl, Direction};
use s1_eternum::models::resource::resource::{
    RelicResourceImpl, Resource, ResourceImpl, ResourceWeightImpl, SingleResource, SingleResourceImpl,
    SingleResourceStoreImpl, WeightStoreImpl,
};
use s1_eternum::models::stamina::StaminaImpl;
use s1_eternum::models::structure::{
    StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureOwnerStoreImpl, StructureTroopExplorerStoreImpl,
    StructureTroopGuardStoreImpl,
};
use s1_eternum::models::troop::{
    ExplorerTroops, GuardImpl, GuardSlot, GuardTroops, TroopBoosts, TroopTier, TroopType, Troops, TroopsImpl,
};
use s1_eternum::models::weight::{Weight, WeightImpl};
use s1_eternum::systems::utils::map::IMapImpl;
use s1_eternum::utils::map::biomes::Biome;
use s1_eternum::utils::math::PercentageValueImpl;
use crate::system_libraries::biome_library::{IBiomeLibraryDispatcherTrait, biome_library};
use crate::system_libraries::rng_library::{IRNGlibraryDispatcherTrait, rng_library};


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
        tick: TickInterval,
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
        troops.stamina.refill(ref troops.boosts, troops.category, troops.tier, troop_stamina_config, current_tick);
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
    fn attempt_move_to_adjacent_tile(ref world: WorldStorage, ref explorer: ExplorerTroops, ref current_tile: Tile) {
        let adjacent_directions = array![
            Direction::East, Direction::NorthEast, Direction::NorthWest, Direction::West, Direction::SouthWest,
            Direction::SouthEast,
        ];
        let current_coord: Coord = current_tile.into();
        for direction in adjacent_directions {
            let adjacent_coord = current_coord.neighbor(direction);
            let mut adjacent_tile: Tile = world.read_model((adjacent_coord.x, adjacent_coord.y));
            if adjacent_tile.not_occupied() {
                if !adjacent_tile.discovered() {
                    let biome_library = biome_library::get_dispatcher(@world);
                    let adjacent_coord_biome: Biome = biome_library
                        .get_biome(adjacent_coord.x.into(), adjacent_coord.y.into());
                    IMapImpl::explore(ref world, ref adjacent_tile, adjacent_coord_biome);
                }

                // occupy the new tile
                let new_tile_occupier = IMapImpl::get_troop_occupier(
                    explorer.owner, explorer.troops.category, explorer.troops.tier,
                );
                IMapImpl::occupy(ref world, ref adjacent_tile, new_tile_occupier, explorer.explorer_id);

                // update explorer coordinate
                explorer.coord = adjacent_coord;
                world.write_model(@explorer);

                // unoccupy the old tile
                IMapImpl::occupy(ref world, ref current_tile, TileOccupier::None, 0);

                break;
            }
        };
    }


    fn create(
        ref world: WorldStorage,
        ref tile: Tile,
        explorer_id: ID,
        owner: ID,
        troop_type: TroopType,
        troop_tier: TroopTier,
        troop_amount: u128,
        troop_stamina_config: TroopStaminaConfig,
        troop_limit_config: TroopLimitConfig,
        current_tick: u64,
    ) -> ExplorerTroops {
        // set explorer as occupier of tile
        let tile_occupier = IMapImpl::get_troop_occupier(owner, troop_type, troop_tier);
        IMapImpl::occupy(ref world, ref tile, tile_occupier, explorer_id);

        // ensure explorer amount does not exceed max
        assert!(
            troop_amount <= troop_limit_config.explorer_guard_max_troop_count.into() * RESOURCE_PRECISION,
            "reached limit of explorers amount per army",
        );

        // set troop stamina
        let mut troops = Troops {
            category: troop_type,
            tier: troop_tier,
            count: troop_amount,
            stamina: Default::default(),
            battle_cooldown_end: 0,
            boosts: TroopBoosts {
                incr_damage_dealt_percent_num: 0,
                incr_damage_dealt_end_tick: 0,
                decr_damage_gotten_percent_num: 0,
                decr_damage_gotten_end_tick: 0,
                incr_stamina_regen_percent_num: 0,
                incr_stamina_regen_tick_count: 0,
                incr_explore_reward_percent_num: 0,
                incr_explore_reward_end_tick: 0,
            },
        };
        let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
        troops.stamina.refill(ref troops.boosts, troops.category, troops.tier, troop_stamina_config, current_tick);

        // set explorer
        let explorer: ExplorerTroops = ExplorerTroops { explorer_id, coord: tile.into(), troops, owner: owner };
        world.write_model(@explorer);

        // initialize explorer resource model
        ResourceImpl::initialize(ref world, explorer_id);
        // increase troop capacity
        Self::update_capacity(ref world, explorer_id, troop_amount, true);
        return explorer;
    }

    fn is_daydreams_agent(self: ExplorerTroops) -> bool {
        self.owner == DAYDREAMS_AGENT_ID
    }

    fn assert_caller_structure_or_agent_owner(self: ExplorerTroops, ref world: WorldStorage) {
        if self.owner == DAYDREAMS_AGENT_ID {
            let agent_owner: AgentOwner = world.read_model(self.explorer_id);
            assert!(agent_owner.address == starknet::get_caller_address(), "caller is not the agent owner");
        } else {
            StructureOwnerStoreImpl::retrieve(ref world, self.owner).assert_caller_owner();
        }
    }

    fn assert_caller_not_structure_or_agent_owner(ref self: ExplorerTroops, ref world: WorldStorage) {
        if self.owner == DAYDREAMS_AGENT_ID {
            let agent_owner: AgentOwner = world.read_model(self.explorer_id);
            assert!(agent_owner.address.is_non_zero(), "agent owner is not set");
            assert!(agent_owner.address != starknet::get_caller_address(), "caller owns the agent but should not");
        } else {
            StructureOwnerStoreImpl::retrieve(ref world, self.owner).assert_caller_not_owner();
        }
    }

    fn burn_stamina_cost(
        ref world: WorldStorage,
        ref explorer: ExplorerTroops,
        troop_stamina_config: TroopStaminaConfig,
        explore: bool,
        mut biomes: Array<Biome>,
        current_tick: u64,
    ) {
        loop {
            match biomes.pop_front() {
                Option::Some(biome) => {
                    let stamina_cost: u64 = match explore {
                        true => { troop_stamina_config.stamina_explore_stamina_cost.into() },
                        false => {
                            let mut stamina_cost: u64 = troop_stamina_config.stamina_travel_stamina_cost.into();
                            let (add, stamina_bonus) = explorer
                                .troops
                                .stamina_travel_bonus(biome, troop_stamina_config);
                            if add {
                                stamina_cost += stamina_bonus.into();
                            } else {
                                stamina_cost -= stamina_bonus.into();
                            }
                            stamina_cost
                        },
                    };
                    explorer
                        .troops
                        .stamina
                        .spend(
                            ref explorer.troops.boosts,
                            explorer.troops.category,
                            explorer.troops.tier,
                            troop_stamina_config,
                            stamina_cost.try_into().unwrap(),
                            current_tick,
                            true,
                        );
                },
                Option::None => { break; },
            }
        };
    }

    fn burn_food_cost(
        ref world: WorldStorage, ref explorer: ExplorerTroops, troop_stamina_config: TroopStaminaConfig, explore: bool,
    ) {
        if explorer.owner == DAYDREAMS_AGENT_ID {
            // daydreams agent does not consume food
            return;
        }

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
        let wheat_burn_amount: u128 = wheat_cost * (explorer.troops.count.into() / RESOURCE_PRECISION);
        let fish_burn_amount: u128 = fish_cost * (explorer.troops.count.into() / RESOURCE_PRECISION);

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

    fn update_capacity(ref world: WorldStorage, explorer_id: ID, troop_amount: u128, add: bool) {
        // set structure capacity
        let capacity_config: CapacityConfig = WorldConfigUtilImpl::get_member(world, selector!("capacity_config"));
        let capacity: u128 = capacity_config.troop_capacity.into() * troop_amount;

        let mut troop_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
        if add {
            troop_weight.add_capacity(capacity);
        } else {
            troop_weight.deduct_capacity(capacity, true);
        }
        troop_weight.store(ref world, explorer_id);
    }

    fn ensure_not_overweight(ref world: WorldStorage, explorer_id: ID) {
        let mut troop_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
        assert!(troop_weight.capacity >= troop_weight.weight, "Eternum: army will be overweight after troop transfer");
    }


    fn explorer_from_agent_delete(ref world: WorldStorage, ref explorer: ExplorerTroops) {
        // decrease agent count
        AgentCountImpl::decrease(ref world);

        // delete agent owner
        let agent_owner = AgentOwner { explorer_id: explorer.explorer_id, address: Zero::zero() };
        world.erase_model(@agent_owner);

        // explorer delete
        Self::_explorer_delete(ref world, ref explorer);
    }


    fn explorer_from_structure_delete(
        ref world: WorldStorage,
        ref explorer: ExplorerTroops,
        structure_explorers: Array<ID>,
        ref structure_base: StructureBase,
        structure_id: ID,
    ) {
        // todo: check if this will cause panic if explorer count is too high
        //       and delete is called after another army wins a battle against this

        // remove explorer from structure
        let mut new_explorers: Array<ID> = array![];
        for explorer_id in structure_explorers {
            if explorer_id != explorer.explorer_id {
                new_explorers.append(explorer_id);
            }
        }
        StructureTroopExplorerStoreImpl::store(new_explorers.span(), ref world, structure_id);

        // update structure base
        structure_base.troop_explorer_count -= 1;
        StructureBaseStoreImpl::store(ref structure_base, ref world, structure_id);

        Self::_explorer_delete(ref world, ref explorer);
    }

    fn exploration_reward_receiver(
        ref world: WorldStorage, explorer: ExplorerTroops, explorer_reward_resource: u8,
    ) -> ID {
        if RelicResourceImpl::is_relic(explorer_reward_resource) {
            return explorer.explorer_id;
        }

        if explorer.is_daydreams_agent() {
            return explorer.explorer_id;
        } else {
            return explorer.owner;
        }
    }

    fn exploration_reward(
        ref world: WorldStorage,
        explorer: Option<ExplorerTroops>,
        current_tick: u64,
        config: MapConfig,
        vrf_seed: u256,
        blitz_mode_on: bool,
    ) -> (u8, u128) {
        let mut reward_resource_id: u8 = 0;
        let mut reward_resource_amount: u128 = 0;
        let rng_library = rng_library::get_dispatcher(@world);
        if blitz_mode_on {
            let (resources, resources_probs) = split_blitz_exploration_reward_and_probs();
            let (resource_id, resource_amount): (u8, u128) = *rng_library
                .get_weighted_choice_u8_u128_pair(resources, resources_probs, 1, true, vrf_seed)
                .at(0);
            reward_resource_id = resource_id;
            reward_resource_amount = resource_amount;
        } else {
            let (resource_types, resources_probs) = split_resources_and_probs();
            let resource_id: u8 = *rng_library
                .get_weighted_choice_u8(resource_types, resources_probs, 1, true, vrf_seed)
                .at(0);
            reward_resource_id = resource_id;
            reward_resource_amount = config.reward_resource_amount.into();
        }

        match explorer {
            Option::Some(explorer) => {
                let mut explorer = explorer;
                if current_tick > explorer.troops.boosts.incr_explore_reward_end_tick.into() {
                    explorer.troops.boosts.incr_explore_reward_percent_num = 0;
                }
                reward_resource_amount +=
                    (reward_resource_amount * explorer.troops.boosts.incr_explore_reward_percent_num.into())
                    / PercentageValueImpl::_100().into();
            },
            Option::None => {},
        }

        return (reward_resource_id, reward_resource_amount * RESOURCE_PRECISION);
    }

    fn _explorer_delete(ref world: WorldStorage, ref explorer: ExplorerTroops) {
        // ensure army is dead
        assert!(explorer.troops.count.is_zero(), "explorer unit is alive");

        // remove explorer from tile
        let mut tile: Tile = world.read_model((explorer.coord.x, explorer.coord.y));
        IMapImpl::occupy(ref world, ref tile, TileOccupier::None, 0);

        // erase explorer resource model
        let resource: Resource = ResourceImpl::key_only(explorer.explorer_id);
        world.erase_model(@resource);

        // erase explorer model
        world.erase_model(@explorer);
        // todo: IMPORTANT: check the cost of erasing the resource model
    }
}

pub enum TroopRaidOutcome {
    Success,
    Failure,
    Chance,
}

#[generate_trait]
pub impl iTroopImpl of iTroopTrait {
    fn random_amount(seed: u256, salt: u128, lower_bound: u32, upper_bound: u32, world: WorldStorage) -> u128 {
        let range: u128 = (upper_bound - lower_bound).into();
        let mut troop_amount: u128 = rng_library::get_dispatcher(@world).get_random_in_range(seed, salt, range);
        troop_amount += lower_bound.into();
        troop_amount * RESOURCE_PRECISION
    }

    fn raid_outcome(success_weight: u128, failure_weight: u128) -> TroopRaidOutcome {
        if success_weight > failure_weight * 2 {
            return TroopRaidOutcome::Success;
        }
        if failure_weight > success_weight * 2 {
            return TroopRaidOutcome::Failure;
        }
        return TroopRaidOutcome::Chance;
    }

    fn raid(success_weight: u128, failure_weight: u128, vrf_seed: u256, world: WorldStorage) -> bool {
        let rng_library_dispatcher = rng_library::get_dispatcher(@world);
        let success: bool = rng_library_dispatcher
            .get_weighted_choice_bool_simple(success_weight, failure_weight, vrf_seed);
        return success;
    }

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
        structure_weight.store(ref world, from_structure_id);
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
        tick: TickInterval,
    ) {
        let mut structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
        let mut structure_guards: GuardTroops = StructureTroopGuardStoreImpl::retrieve(ref world, structure_id);
        let mut salt: u128 = 1;

        loop {
            match slot_tiers.pop_front() {
                Option::Some((
                    slot, tier, category,
                )) => {
                    let troop_amount = iTroopImpl::random_amount(
                        seed,
                        salt,
                        troop_limit_config.mercenaries_troop_lower_bound,
                        troop_limit_config.mercenaries_troop_upper_bound,
                        world,
                    );
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
        }

        // update structure guard store
        StructureTroopGuardStoreImpl::store(ref structure_guards, ref world, structure_id);

        // update structure base
        StructureBaseStoreImpl::store(ref structure_base, ref world, structure_id);
    }
}


#[derive(Copy, Drop, Serde)]
#[dojo::event(historical: false)]
struct AgentCreatedEvent {
    #[key]
    explorer_id: ID,
    troop_type: TroopType,
    troop_tier: TroopTier,
    troop_amount: u128,
    timestamp: u64,
}

#[generate_trait]
pub impl iAgentDiscoveryImpl of iAgentDiscoveryTrait {
    fn lottery(map_config: MapConfig, vrf_seed: u256, world: WorldStorage) -> bool {
        // make sure seed is different for each lottery system to prevent same outcome for same probability
        let VRF_OFFSET: u256 = 3;
        let agent_vrf_seed = if vrf_seed > VRF_OFFSET {
            vrf_seed - VRF_OFFSET
        } else {
            vrf_seed + VRF_OFFSET
        };

        let success: bool = rng_library::get_dispatcher(@world)
            .get_weighted_choice_bool_simple(
                map_config.agent_discovery_prob.into(), map_config.agent_discovery_fail_prob.into(), agent_vrf_seed,
            );
        return success;
    }


    fn create(
        ref world: WorldStorage,
        ref tile: Tile,
        mut seed: u256,
        troop_limit_config: TroopLimitConfig,
        troop_stamina_config: TroopStaminaConfig,
        current_tick: u64,
    ) -> ExplorerTroops {
        let mut salt: u128 = 124;
        let troop_amount = iTroopImpl::random_amount(
            seed, salt, troop_limit_config.agents_troop_lower_bound, troop_limit_config.agents_troop_upper_bound, world,
        );

        // select a troop type with equal probability
        let rng_library_dispatcher = rng_library::get_dispatcher(@world);
        let troop_types: Array<TroopType> = array![TroopType::Knight, TroopType::Crossbowman, TroopType::Paladin];
        let random_troop_type_index: u128 = rng_library_dispatcher
            .get_random_in_range(seed, salt, troop_types.len().into());
        let troop_type: TroopType = *troop_types.at(random_troop_type_index.try_into().unwrap());
        let troop_tier: TroopTier = *rng_library_dispatcher
            .get_weighted_choice_trooptier(
                array![TroopTier::T1, TroopTier::T2, TroopTier::T3].span(),
                array![70, 20, 10].span(),
                1,
                true,
                seed + 15,
            )
            .at(0);

        // agent discovery
        let explorer_id: ID = world.dispatcher.uuid();
        let explorer: ExplorerTroops = iExplorerImpl::create(
            ref world,
            ref tile,
            explorer_id,
            DAYDREAMS_AGENT_ID,
            troop_type,
            troop_tier,
            troop_amount,
            troop_stamina_config,
            troop_limit_config,
            current_tick,
        );

        // set name based on id
        let names: Array<felt252> = Self::names();
        let names_index: u128 = rng_library_dispatcher.get_random_in_range(seed, salt, names.len().into());
        let name: felt252 = *names.at(names_index.try_into().unwrap());
        let name: AddressName = AddressName { address: explorer_id.try_into().unwrap(), name: name };
        world.write_model(@name);

        // increase agent count
        AgentCountImpl::increase(ref world);

        // set agent ownership
        let mut agent_controller_config: AgentControllerConfig = WorldConfigUtilImpl::get_member(
            world, selector!("agent_controller_config"),
        );
        world.write_model(@AgentOwner { explorer_id, address: agent_controller_config.address });

        // get random lords amount to give to the agent
        let mut agent_config: AgentConfig = world.read_model(WORLD_CONFIG_ID);
        let lords_difference = agent_config.max_spawn_lords_amount - agent_config.min_spawn_lords_amount;
        let lords_amount = rng_library_dispatcher.get_random_in_range(seed, salt, lords_difference.into() + 1)
            + agent_config.min_spawn_lords_amount.into();
        AgentLordsMintedImpl::increase(ref world, lords_amount.try_into().unwrap());

        // grant random lords amount to the agent
        let mut explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer.explorer_id);
        let lords_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::LORDS);
        let mut lords_resource = SingleResourceStoreImpl::retrieve(
            ref world, explorer.explorer_id, ResourceTypes::LORDS, ref explorer_weight, lords_weight_grams, false,
        );
        lords_resource.add(lords_amount * RESOURCE_PRECISION, ref explorer_weight, lords_weight_grams);
        lords_resource.store(ref world);

        // emit event
        world
            .emit_event(
                @AgentCreatedEvent {
                    explorer_id, troop_type, troop_tier, troop_amount, timestamp: starknet::get_block_timestamp(),
                },
            );
        return explorer;
    }

    fn names() -> Array<felt252> {
        // array![
        //     'Daydreams Agent Bread', 'Daydreams Agent Doughnut', 'Daydreams Agent Chaos', 'Daydreams Agent Giggles',
        //     'Daydreams Agent Noodle', 'Daydreams Agent Pickle', 'Daydreams Agent PuffPuff', 'Daydreams Agent
        //     Sprinkles', 'Daydreams Agent Unstable', 'Daydreams Agent Waffle', 'Daydreams Agent Mischief',
        //     'Daydreams Agent Whiskers', 'Daydreams Agent Poptart', 'Daydreams Agent Bubbles', 'Daydreams Agent Jojo',
        //     'Daydreams Agent Pink', 'Daydreams Agent Biscuit', 'Daydreams Agent Sparkle', 'Daydreams Agent Whimsy',
        //     'Daydreams Agent Pancake', 'Daydreams Agent Mario', 'Daydreams Agent Scramble', 'Daydreams Agent
        //     Jitters', 'Daydreams Agent Funny', 'Daydreams Agent Waffles', 'Daydreams Agent Doodle', 'Daydreams Agent
        //     Katy', 'Daydreams Agent Bumblebee', 'Daydreams Agent Happy', 'Daydreams Agent Marshmallow',
        //     'Daydreams Agent Zigzag', 'Daydreams Agent Pebble', 'Daydreams Agent Wiggles', 'Daydreams Agent
        //     Cinnamon', 'Daydreams Agent Noodles', 'Daydreams Agent Popsicle', 'Daydreams Agent Loot', 'Daydreams
        //     Agent Mumble', 'Daydreams Agent French', 'Daydreams Agent Angry', 'Daydreams Agent Dazzle', 'Daydreams
        //     Agent Pretzel', 'Daydreams Agent Bubblegum', 'Daydreams Agent Banana', 'Daydreams Agent Pickle',
        //     'Daydreams Agent Blobert',
        // ]
        array!['']
    }
}
