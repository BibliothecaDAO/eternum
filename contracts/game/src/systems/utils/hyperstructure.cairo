use core::num::traits::zero::Zero;
use cubit::f128::types::fixed::FixedTrait;
use dojo::model::{Model, ModelStorage};
use dojo::world::{IWorldDispatcherTrait, WorldStorage};
use s1_eternum::constants::WORLD_CONFIG_ID;
use s1_eternum::models::config::{
    MapConfig, TickImpl, TickInterval, TroopLimitConfig, TroopStaminaConfig, WorldConfigUtilImpl,
};
use s1_eternum::models::hyperstructure::{ConstructionAccess, Hyperstructure, HyperstructureGlobals};
use s1_eternum::models::map::{Tile, TileOccupier};
use s1_eternum::models::position::{Coord, CoordImpl, Direction, TravelImpl};
use s1_eternum::models::structure::{Structure, StructureCategory, StructureImpl};
use s1_eternum::models::troop::{GuardSlot, TroopTier, TroopType};
use s1_eternum::systems::utils::structure::iStructureImpl;
use s1_eternum::systems::utils::troop::iMercenariesImpl;
use s1_eternum::utils::math::{PercentageImpl, PercentageValueImpl};
use crate::system_libraries::rng_library::{rng_library, IRNGlibraryDispatcherTrait};
use crate::system_libraries::structure_libraries::structure_creation_library::{
    structure_creation_library, IStructureCreationlibraryDispatcherTrait,
};

#[generate_trait]
pub impl iHyperstructureDiscoveryImpl of iHyperstructureDiscoveryTrait {
    fn lottery(world: WorldStorage, coord: Coord, map_config: MapConfig, vrf_seed: u256) -> bool {
        // get hyperstructure foundation find probabilities
        let tile_distance_count: u128 = coord.tile_distance(CoordImpl::center());
        let hyps_fail_prob_increase_p_hex: u128 = map_config.hyps_fail_prob_increase_p_hex.into();
        let mut hyps_win_prob: u128 = map_config.hyps_win_prob.into();
        let hyps_probs_original_sum: u128 = map_config.hyps_win_prob.into() + map_config.hyps_fail_prob.into();

        // Calculate hyperstructure discovery probability adjustment based on distance from center
        // Formula: P_final = P_initial * (failure_increase_rate ^ distance)
        // Example: If initial probability is 10_000, failure rate is 0.95, and distance is 3:
        //   - P_initial = 10_000
        //   - Multiplier = 0.95
        //   - P_final = 10_000 * (0.95)^3 = 10_000 * 0.857375 = 8_573.75
        let win_prob_fixed = FixedTrait::new(hyps_win_prob, false);
        let radius_multiplier_num_fixed = FixedTrait::new(hyps_fail_prob_increase_p_hex, false);
        let radius_multiplier_denom_fixed = FixedTrait::new(PercentageValueImpl::_100().into(), false);
        let tile_distance_count_fixed = FixedTrait::new_unscaled(tile_distance_count, false);
        let radius_multiplier = radius_multiplier_num_fixed / radius_multiplier_denom_fixed;
        let win_prob_after_radius_multiplier = win_prob_fixed * radius_multiplier.pow(tile_distance_count_fixed);
        hyps_win_prob = win_prob_after_radius_multiplier.mag;

        // Calculate hyperstructure discovery probability adjustment based on global count
        // Formula: P_final = max(0, P_initial - (count * failure_rate_per_found))
        // Example: If initial probability is 8_000, failure rate per found is 500, and 10
        // hyperstructures exist:
        //   - P_initial = 8_000
        //   - Penalty = 10 * 500 = 5_000
        //   - P_final = max(0, 8_000 - 5_000) = 3_000
        let hyperstructure_globals: HyperstructureGlobals = world.read_model(WORLD_CONFIG_ID);
        let hyperstructure_count = hyperstructure_globals.created_count;
        let hyps_fail_prob_increase_p_fnd: u128 = hyperstructure_count.into()
            * map_config.hyps_fail_prob_increase_p_fnd.into();
        hyps_win_prob =
            if hyps_fail_prob_increase_p_fnd < hyps_win_prob {
                hyps_win_prob - hyps_fail_prob_increase_p_fnd
            } else {
                0
            };

        // make sure seed is different for each lottery system to prevent same outcome for same
        // probability
        let VRF_OFFSET: u256 = 1;
        let hyps_vrf_seed = if vrf_seed > VRF_OFFSET {
            vrf_seed - VRF_OFFSET
        } else {
            vrf_seed + VRF_OFFSET
        };

        // calculate final probabilities
        let hyps_fail_prob = hyps_probs_original_sum - hyps_win_prob;

        let rng_library_dispatcher = rng_library::get_dispatcher(@world);
        let success: bool = rng_library_dispatcher.get_weighted_choice_bool_simple(hyps_win_prob, hyps_fail_prob, hyps_vrf_seed);

        return success;
    }

    fn create(
        ref world: WorldStorage,
        coord: Coord,
        caller: starknet::ContractAddress,
        map_config: MapConfig,
        troop_limit_config: TroopLimitConfig,
        troop_stamina_config: TroopStaminaConfig,
        vrf_seed: u256,
        hyperstructure_initialized: bool,
        hyperstructure_completed: bool,
    ) {
        // make hyper structure
        let mut hyperstructure_tile_occupier: TileOccupier = TileOccupier::HyperstructureLevel1;
        if hyperstructure_initialized {
            hyperstructure_tile_occupier = TileOccupier::HyperstructureLevel2;
        }
        if hyperstructure_completed {
            hyperstructure_tile_occupier = TileOccupier::HyperstructureLevel3;
        }
        let structure_id = world.dispatcher.uuid();
        let structure_creation_library = structure_creation_library::get_dispatcher(@world);
        structure_creation_library.make_structure(
            world,
            coord,
            Zero::zero(),
            structure_id,
            StructureCategory::Hyperstructure,
            array![].span(),
            Default::default(),
            hyperstructure_tile_occupier,
            false,
        );

        // add guards to structure
        let tick_config: TickInterval = TickImpl::get_tick_interval(ref world);
        let guard_slots = array![GuardSlot::Delta, GuardSlot::Charlie, GuardSlot::Bravo];
        let guard_troop_types_order = array![TroopType::Paladin, TroopType::Knight, TroopType::Crossbowman];
        let mut count = 0;
        for guard_slot in guard_slots {
            iMercenariesImpl::add(
                ref world,
                structure_id,
                vrf_seed + count.into(),
                array![(guard_slot, TroopTier::T2, *guard_troop_types_order.at(count))].span(),
                troop_limit_config,
                troop_stamina_config,
                tick_config,
            );
            count += 1;
        }

        // create hyperstructure model
        world
            .write_model(
                @Hyperstructure {
                    hyperstructure_id: structure_id,
                    initialized: hyperstructure_initialized,
                    completed: hyperstructure_completed,
                    access: ConstructionAccess::Private,
                    randomness: vrf_seed.try_into().unwrap(),
                    points_multiplier: 0,
                },
            );

        // increment hyperstructures created count
        let mut hyperstructure_globals: HyperstructureGlobals = world.read_model(WORLD_CONFIG_ID);
        hyperstructure_globals.created_count += 1;
        if hyperstructure_completed {
            hyperstructure_globals.completed_count += 1;
        }
        world.write_model(@hyperstructure_globals);
    }
}

#[generate_trait]
pub impl iHyperstructureBlitzImpl of iHyperstructureBlitzTrait {
    fn realm_tile_distance() -> u32 {
        8 // manually counted. must be divisible by 2
    }

    fn count_surrounding_realms(ref world: WorldStorage, hyperstructure_coord: Coord) -> u8 {
        let mut start_coord: Coord = hyperstructure_coord;
        let start_directions: Array<(Direction, Direction)> = array![
            (Direction::East, Direction::NorthWest), (Direction::SouthEast, Direction::NorthEast),
            (Direction::SouthWest, Direction::East), (Direction::West, Direction::SouthEast),
            (Direction::NorthWest, Direction::SouthWest), (Direction::NorthEast, Direction::West),
        ];

        let mut count = 0;
        for direction in start_directions {
            let (start_direction, triangle_direction) = direction;
            let potential_realm_coord = start_coord
                .neighbor_after_distance(start_direction, Self::realm_tile_distance())
                .neighbor_after_distance(triangle_direction, Self::realm_tile_distance() / 2);

            let potential_realm_tile: Tile = world.read_model((potential_realm_coord.x, potential_realm_coord.y));
            if potential_realm_tile.occupier_is_structure {
                let structure_category: u8 = world
                    .read_member(
                        Model::<Structure>::ptr_from_keys(potential_realm_tile.occupier_id), selector!("category"),
                    );
                if structure_category == StructureCategory::Realm.into() {
                    count += 1;
                }
            }
        }
        return count;
    }
}
