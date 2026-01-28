use core::num::traits::zero::Zero;
use dojo::world::{IWorldDispatcherTrait, WorldStorage};
use crate::models::config::{MapConfig, TickImpl, TickInterval, TroopLimitConfig, TroopStaminaConfig};
use crate::models::map::TileOccupier;
use crate::models::position::Coord;
use crate::models::structure::StructureCategory;
use crate::models::troop::{GuardSlot, TroopTier, TroopType};
use crate::system_libraries::rng_library::{IRNGlibraryDispatcherTrait, rng_library};
use crate::system_libraries::structure_libraries::structure_creation_library::{
    IStructureCreationlibraryDispatcherTrait, structure_creation_library,
};
use crate::systems::utils::troop::iMercenariesImpl;

#[generate_trait]
pub impl iCampDiscoveryImpl of iCampDiscoveryTrait {
    fn lottery(map_config: MapConfig, vrf_seed: u256, world: WorldStorage) -> bool {
        // make sure seed is different for each lottery system to prevent same outcome for same probability
        let VRF_OFFSET: u256 = 7; // Use different offset than mines (2), holysite (6) to avoid correlation
        let camp_vrf_seed = if vrf_seed > VRF_OFFSET {
            vrf_seed - VRF_OFFSET
        } else {
            vrf_seed + VRF_OFFSET
        };

        let rng_library_dispatcher = rng_library::get_dispatcher(@world);
        let success: bool = rng_library_dispatcher
            .get_weighted_choice_bool_simple(
                map_config.camp_win_probability.into(), map_config.camp_fail_probability.into(), camp_vrf_seed,
            );

        return success;
    }

    fn create(
        ref world: WorldStorage,
        coord: Coord,
        troop_limit_config: TroopLimitConfig,
        troop_stamina_config: TroopStaminaConfig,
        vrf_seed: u256,
    ) -> bool {
        // make camp structure
        let structure_id = world.dispatcher.uuid();
        let structure_creation_library = structure_creation_library::get_dispatcher(@world);
        structure_creation_library
            .make_structure(
                world,
                coord,
                Zero::zero(), // owner_id: No direct player ownership (bandits)
                structure_id,
                StructureCategory::Camp,
                array![].span(), // No initial resources
                Default::default(),
                TileOccupier::Camp,
                false,
            );

        // add guards to structure
        // slot must start from delta, to charlie, to beta, to alpha
        let slot_tiers = array![(GuardSlot::Delta, TroopTier::T1, TroopType::Crossbowman)].span();
        let tick_config: TickInterval = TickImpl::get_tick_interval(ref world);
        iMercenariesImpl::add(
            ref world, structure_id, vrf_seed, slot_tiers, troop_limit_config, troop_stamina_config, tick_config,
        );

        return true;
    }
}
