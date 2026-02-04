use core::num::traits::zero::Zero;
use dojo::model::ModelStorage;
use dojo::world::{IWorldDispatcherTrait, WorldStorage};
use crate::constants::WORLD_CONFIG_ID;
use crate::models::bitcoin_mine::{BitcoinMineRegistry, BitcoinMineState};
use crate::models::config::{
    BitcoinMineConfig, MapConfig, TickImpl, TickInterval, TroopLimitConfig, TroopStaminaConfig, WorldConfigUtilImpl,
};
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
pub impl iBitcoinMineDiscoveryImpl of iBitcoinMineDiscoveryTrait {
    fn lottery(map_config: MapConfig, vrf_seed: u256, world: WorldStorage) -> bool {
        // Use unique VRF offset to avoid correlation with other lotteries
        let VRF_OFFSET: u256 = 10;
        let mine_vrf_seed = if vrf_seed > VRF_OFFSET {
            vrf_seed - VRF_OFFSET
        } else {
            vrf_seed + VRF_OFFSET
        };

        let rng_library_dispatcher = rng_library::get_dispatcher(@world);
        let success: bool = rng_library_dispatcher
            .get_weighted_choice_bool_simple(
                map_config.bitcoin_mine_win_probability.into(),
                map_config.bitcoin_mine_fail_probability.into(),
                mine_vrf_seed,
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
        // Bitcoin mines can only be discovered in the Ethereal (alt) layer
        assert!(coord.alt, "Bitcoin mines can only be in Ethereal layer");

        // Create bitcoin mine structure
        let structure_id = world.dispatcher.uuid();
        let structure_creation_library = structure_creation_library::get_dispatcher(@world);
        structure_creation_library
            .make_structure(
                world,
                coord,
                Zero::zero(), // owner_id: No direct player ownership (bandits)
                structure_id,
                StructureCategory::BitcoinMine,
                array![].span(), // No initial troops
                Default::default(),
                TileOccupier::BitcoinMine,
                false,
            );

        // Add T3 guards to structure (same tier as Ethereal Agents)
        let slot_tiers = array![(GuardSlot::Delta, TroopTier::T3, TroopType::Paladin)].span();
        let tick_config: TickInterval = TickImpl::get_tick_interval(ref world);
        iMercenariesImpl::add(
            ref world, structure_id, vrf_seed, slot_tiers, troop_limit_config, troop_stamina_config, tick_config,
        );

        // Initialize mine state
        let bitcoin_mine_config: BitcoinMineConfig = WorldConfigUtilImpl::get_member(
            world, selector!("bitcoin_mine_config"),
        );
        let current_phase = Self::_get_current_phase(ref world, bitcoin_mine_config);

        let mine_state = BitcoinMineState {
            mine_id: structure_id,
            production_level: 0, // Stopped until player activates
            work_accumulated: 0,
            work_last_claimed_phase: current_phase,
            prizes_won: 0,
        };
        world.write_model(@mine_state);

        // Add to registry
        let mut registry: BitcoinMineRegistry = world.read_model(WORLD_CONFIG_ID);
        registry.active_mine_ids.append(structure_id);
        world.write_model(@registry);

        return true;
    }

    fn _get_current_phase(ref world: WorldStorage, config: BitcoinMineConfig) -> u64 {
        let now = starknet::get_block_timestamp();
        now / config.phase_duration_seconds
    }
}
