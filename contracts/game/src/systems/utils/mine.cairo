use core::num::traits::zero::Zero;
use dojo::world::{IWorldDispatcherTrait, WorldStorage};
use s1_eternum::constants::{RESOURCE_PRECISION, ResourceTypes};
use s1_eternum::models::config::{
    MapConfig, TickImpl, TickInterval, TroopLimitConfig, TroopStaminaConfig, WorldConfigUtilImpl,
};
use s1_eternum::models::map::TileOccupier;
use s1_eternum::models::position::Coord;
use s1_eternum::models::resource::production::building::{BuildingCategory, BuildingImpl};
use s1_eternum::models::resource::production::production::{Production, ProductionImpl};
use s1_eternum::models::resource::resource::{
    ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
};
use s1_eternum::models::structure::{StructureCategory, StructureImpl};
use s1_eternum::models::troop::{GuardSlot, TroopTier, TroopType};
use s1_eternum::models::weight::Weight;
use s1_eternum::systems::utils::structure::iStructureImpl;
use s1_eternum::systems::utils::troop::iMercenariesImpl;
use crate::system_libraries::rng_library::{rng_library, IRNGlibraryDispatcherTrait};


#[generate_trait]
pub impl iMineDiscoveryImpl of iMineDiscoveryTrait {
    fn lottery(map_config: MapConfig, vrf_seed: u256, world: WorldStorage) -> bool {
        // make sure seed is different for each lottery system to prevent same outcome for same probability
        let VRF_OFFSET: u256 = 2;
        let mine_vrf_seed = if vrf_seed > VRF_OFFSET {
            vrf_seed - VRF_OFFSET
        } else {
            vrf_seed + VRF_OFFSET
        };

        let rng_library_dispatcher = rng_library::get_dispatcher(@world);
        let success: bool = rng_library_dispatcher.get_weighted_choice_bool_simple(
            map_config.shards_mines_win_probability.into(), map_config.shards_mines_fail_probability.into(),
            mine_vrf_seed,
        );

        return success;
    }

    fn create(
        ref world: WorldStorage,
        coord: Coord,
        season_mode_on: bool,
        map_config: MapConfig,
        troop_limit_config: TroopLimitConfig,
        troop_stamina_config: TroopStaminaConfig,
        vrf_seed: u256,
    ) -> bool {
        // make fragment mine structure
        let structure_id = world.dispatcher.uuid();
        iStructureImpl::create(
            ref world,
            coord,
            Zero::zero(),
            structure_id,
            StructureCategory::FragmentMine,
            array![].span(),
            Default::default(),
            TileOccupier::FragmentMine,
            false,
        );
        // add guards to structure
        // slot must start from delta, to charlie, to beta, to alpha
        let slot_tiers = array![(GuardSlot::Delta, TroopTier::T1, TroopType::Crossbowman)].span();
        let tick_config: TickInterval = TickImpl::get_tick_interval(ref world);
        iMercenariesImpl::add(
            ref world, structure_id, vrf_seed, slot_tiers, troop_limit_config, troop_stamina_config, tick_config,
        );

        // allow fragment mine to produce limited amount of resource
        let (
            reward_resource_building_category, reward_resource_type, reward_resource_amount,
        ): (BuildingCategory, u8, u128) =
            if season_mode_on {
            (
                BuildingCategory::ResourceEarthenShard,
                ResourceTypes::EARTHEN_SHARD,
                Self::_season_mode_reward_amount(ref world, vrf_seed),
            )
        } else {
            (BuildingCategory::ResourceEssence, ResourceTypes::ESSENCE, Self::_blitz_mode_reward_amount(ref world))
        };

        let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, structure_id);
        let reward_resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, reward_resource_type);
        let mut reward_resource_resource = SingleResourceStoreImpl::retrieve(
            ref world, structure_id, reward_resource_type, ref structure_weight, reward_resource_weight_grams, true,
        );
        let mut reward_resource_resource_production: Production = reward_resource_resource.production;
        reward_resource_resource_production.increase_output_amout_left(reward_resource_amount);
        reward_resource_resource.production = reward_resource_resource_production;
        reward_resource_resource.store(ref world);

        // update structure weight
        structure_weight.store(ref world, structure_id);
        // create reward resource production building
        BuildingImpl::create(
            ref world,
            Zero::zero(),
            structure_id,
            StructureCategory::FragmentMine.into(),
            coord,
            reward_resource_building_category,
            BuildingImpl::center(),
        );

        return true;
    }

    fn _season_mode_reward_amount(ref world: WorldStorage, randomness: u256) -> u128 {
        let multipliers: Array<u128> = array![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

        let rng_library_dispatcher = rng_library::get_dispatcher(@world);
        let random_index: u128 = rng_library_dispatcher.get_random_in_range(randomness, 124, multipliers.len().into());
        let random_multiplier: u128 = *multipliers.at(random_index.try_into().unwrap());
        let minimum_amount: u128 = 300_000 * RESOURCE_PRECISION;
        let actual_amount: u128 = minimum_amount * random_multiplier;
        return actual_amount;
    }

    fn _blitz_mode_reward_amount(ref world: WorldStorage) -> u128 {
        36_000 * RESOURCE_PRECISION
    }
}
