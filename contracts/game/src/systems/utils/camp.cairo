use core::num::traits::zero::Zero;
use dojo::model::ModelStorage;
use dojo::world::{IWorldDispatcherTrait, WorldStorage};
use crate::alias::ID;
use crate::models::config::{
    MapConfig, TickImpl, TickInterval, TroopLimitConfig, TroopStaminaConfig, VillageFoundResourcesConfig,
    WorldConfigUtilImpl,
};
use crate::models::map::TileOccupier;
use crate::models::position::Coord;
use crate::models::resource::production::building::{BuildingCategory, BuildingImpl};
use crate::models::resource::production::production::ProductionStrategyImpl;
use crate::models::resource::resource::{
    ResourceMinMaxList, ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
};
use crate::models::structure::StructureCategory;
use crate::models::troop::{GuardSlot, TroopTier, TroopType};
use crate::system_libraries::rng_library::{IRNGlibraryDispatcherTrait, rng_library};
use crate::system_libraries::structure_libraries::structure_creation_library::{
    IStructureCreationlibraryDispatcherTrait, structure_creation_library,
};
use crate::systems::utils::troop::iMercenariesImpl;

#[generate_trait]
pub impl iCampDiscoveryImpl of iCampDiscoveryTrait {
    fn grant_starting_resources(ref world: WorldStorage, structure_id: ID) {
        let village_found_resources_config: VillageFoundResourcesConfig = WorldConfigUtilImpl::get_member(
            world, selector!("village_find_resources_config"),
        );
        let mut structure_weight = WeightStoreImpl::retrieve(ref world, structure_id);

        for index in 0..village_found_resources_config.resources_mm_list_count {
            let resource: ResourceMinMaxList = world
                .read_model((village_found_resources_config.resources_mm_list_id, index));
            let resource_weight_grams = ResourceWeightImpl::grams(ref world, resource.resource_type);
            let mut structure_resource = SingleResourceStoreImpl::retrieve(
                ref world, structure_id, resource.resource_type, ref structure_weight, resource_weight_grams, true,
            );
            structure_resource.add(resource.min_amount, ref structure_weight, resource_weight_grams);
            structure_resource.store(ref world);
        }

        structure_weight.store(ref world, structure_id);
    }

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
        let camp_owner_address = Zero::zero();
        let structure_creation_library = structure_creation_library::get_dispatcher(@world);
        structure_creation_library
            .make_structure(
                world,
                coord,
                camp_owner_address,
                structure_id,
                StructureCategory::Camp,
                array![].span(), // No initial resources
                Default::default(),
                TileOccupier::Camp,
                false,
            );

        Self::grant_starting_resources(ref world, structure_id);

        BuildingImpl::create(
            ref world,
            camp_owner_address,
            structure_id,
            StructureCategory::Camp.into(),
            coord,
            BuildingCategory::ResourceLabor,
            BuildingImpl::center(),
        );

        ProductionStrategyImpl::seed_unbounded_structure_labor_output(ref world, structure_id);

        // slot must start from delta, to charlie, to beta, to alpha
        let slot_tiers = array![(GuardSlot::Delta, TroopTier::T1, TroopType::Crossbowman)].span();
        let tick_config: TickInterval = TickImpl::get_tick_interval(ref world);
        iMercenariesImpl::add(
            ref world, structure_id, vrf_seed, slot_tiers, troop_limit_config, troop_stamina_config, tick_config,
        );

        return true;
    }
}
