use core::num::traits::zero::Zero;
use dojo::world::{IWorldDispatcherTrait, WorldStorage};
use s1_eternum::constants::{RESOURCE_PRECISION, ResourceTypes};
use s1_eternum::models::config::TickImpl;
use s1_eternum::models::config::{MapConfig, TickConfig, TroopLimitConfig, TroopStaminaConfig, WorldConfigUtilImpl};
use s1_eternum::models::map::{TileOccupier};
use s1_eternum::models::position::{Coord};
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
use s1_eternum::utils::random;


#[generate_trait]
pub impl iMineDiscoveryImpl of iMineDiscoveryTrait {
    fn lottery(map_config: MapConfig, vrf_seed: u256) -> bool {
        let success: bool = *random::choices(
            array![true, false].span(),
            array![map_config.shards_mines_win_probability.into(), map_config.shards_mines_fail_probability.into()]
                .span(),
            array![].span(),
            1,
            true,
            // make sure seed is different for each lottery system to prevent same outcome for same probability
            vrf_seed - 2,
        )[0];

        return success;
    }

    fn create(
        ref world: WorldStorage,
        coord: Coord,
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
        );
        // add guards to structure
        // slot must start from delta, to charlie, to beta, to alpha
        let slot_tiers = array![(GuardSlot::Delta, TroopTier::T2, TroopType::Paladin)].span();
        let tick_config: TickConfig = TickImpl::get_tick_config(ref world);
        iMercenariesImpl::add(
            ref world, structure_id, vrf_seed, slot_tiers, troop_limit_config, troop_stamina_config, tick_config,
        );

        // allow fragment mine to produce limited amount of shards
        let shards_reward_amount = Self::_reward_amount(ref world, vrf_seed);
        let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, structure_id);
        let shards_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::EARTHEN_SHARD);
        let mut shards_resource = SingleResourceStoreImpl::retrieve(
            ref world, structure_id, ResourceTypes::EARTHEN_SHARD, ref structure_weight, shards_weight_grams, true,
        );
        let mut shards_resource_production: Production = shards_resource.production;
        shards_resource_production.increase_output_amout_left(shards_reward_amount);
        shards_resource.production = shards_resource_production;
        shards_resource.store(ref world);

        // // grant wheat to structure
        // let wheat_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::WHEAT);
        // let mut wheat_resource = SingleResourceStoreImpl::retrieve(
        //     ref world, structure_id, ResourceTypes::WHEAT, ref structure_weight, wheat_weight_grams, true,
        // );
        // wheat_resource
        //     .add(
        //         map_config.mine_wheat_grant_amount.into() * RESOURCE_PRECISION,
        //         ref structure_weight,
        //         wheat_weight_grams,
        //     );
        // wheat_resource.store(ref world);
        // // grant fish to structure
        // let fish_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::FISH);
        // let mut fish_resource = SingleResourceStoreImpl::retrieve(
        //     ref world, structure_id, ResourceTypes::FISH, ref structure_weight, fish_weight_grams, true,
        // );
        // fish_resource
        //     .add(
        //         map_config.mine_fish_grant_amount.into() * RESOURCE_PRECISION, ref structure_weight,
        //         fish_weight_grams,
        //     );
        // fish_resource.store(ref world);

        // update structure weight
        structure_weight.store(ref world, structure_id);
        // create shards production building
        BuildingImpl::create(
            ref world,
            structure_id,
            StructureCategory::FragmentMine.into(),
            coord,
            BuildingCategory::ResourceEarthenShard,
            BuildingImpl::center(),
        );

        return true;
    }

    fn _reward_amount(ref world: WorldStorage, randomness: u256) -> u128 {
        let multipliers: Array<u128> = array![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        let random_index: u128 = random::random(randomness, 124, multipliers.len().into());
        let random_multiplier: u128 = *multipliers.at(random_index.try_into().unwrap());
        let minimum_amount: u128 = 100_000 * RESOURCE_PRECISION;
        let actual_amount: u128 = minimum_amount * random_multiplier;
        return actual_amount;
    }
}
