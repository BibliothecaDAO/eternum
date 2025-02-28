use achievement::store::{StoreTrait};
use core::num::traits::zero::Zero;
use dojo::model::{ModelStorage};
use dojo::world::{IWorldDispatcherTrait, WorldStorage};
use s1_eternum::models::config::TickImpl;
use s1_eternum::models::config::{MapConfig, TickConfig, TroopLimitConfig, TroopStaminaConfig, WorldConfigUtilImpl};
use s1_eternum::models::hyperstructure::{Access, Hyperstructure};
use s1_eternum::models::map::{TileOccupier};
use s1_eternum::models::position::{Coord, CoordImpl, TravelImpl};

use s1_eternum::models::structure::{StructureCategory, StructureImpl};
use s1_eternum::models::troop::{GuardSlot, TroopTier, TroopType};
use s1_eternum::systems::utils::structure::iStructureImpl;
use s1_eternum::systems::utils::troop::iMercenariesImpl;
use s1_eternum::utils::random;
use s1_eternum::utils::random::{VRFImpl};
use s1_eternum::utils::tasks::index::{Task, TaskTrait};


#[generate_trait]
pub impl iHyperstructureDiscoveryImpl of iHyperstructureDiscoveryTrait {
    fn lottery(ref world: WorldStorage, coord: Coord, map_config: MapConfig, vrf_seed: u256) -> bool {
        let tile_distance_count: u128 = coord.tile_distance(CoordImpl::center());
        let hyps_fail_prob_increase: u128 = tile_distance_count * map_config.hyps_fail_prob_increase.into();
        let hyps_probs_original_sum: u128 = map_config.hyps_win_prob.into() + map_config.hyps_fail_prob.into();
        let hyps_win_prob = if hyps_fail_prob_increase < map_config.hyps_win_prob.into() {
            map_config.hyps_win_prob.into() - hyps_fail_prob_increase
        } else {
            1
        };
        let hyps_fail_prob = hyps_probs_original_sum - hyps_win_prob;
        let success: bool = *random::choices(
            array![true, false].span(),
            array![hyps_win_prob, hyps_fail_prob].span(),
            array![].span(),
            1,
            true,
            vrf_seed,
        )[0];

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
    ) {
        // make hyper structure
        let structure_id = world.dispatcher.uuid();
        iStructureImpl::create(
            ref world,
            coord,
            Zero::zero(),
            structure_id,
            StructureCategory::Hyperstructure,
            true,
            array![].span(),
            Default::default(),
            TileOccupier::Hyperstructure,
        );

        // add guards to structure
        let slot_tiers = array![(GuardSlot::Delta, TroopTier::T3, TroopType::Paladin)].span();

        let tick_config: TickConfig = TickImpl::get_tick_config(ref world);
        iMercenariesImpl::add(
            ref world, structure_id, vrf_seed, slot_tiers, troop_limit_config, troop_stamina_config, tick_config,
        );

        // create hyperstructure model
        let now = starknet::get_block_timestamp();
        world
            .write_model(
                @Hyperstructure {
                    entity_id: structure_id,
                    current_epoch: 0,
                    completed: false,
                    last_updated_by: Zero::zero(),
                    last_updated_timestamp: now,
                    access: Access::Private,
                    randomness: vrf_seed.try_into().unwrap(),
                },
            );

        // [Achievement] Hyperstructure Creation
        let player_id: felt252 = caller.into();
        let task_id: felt252 = Task::Builder.identifier();
        let store = StoreTrait::new(world);
        store.progress(player_id, task_id, count: 1, time: now);
    }
}
