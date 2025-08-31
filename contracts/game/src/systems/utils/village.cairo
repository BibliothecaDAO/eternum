use core::num::traits::Zero;
use dojo::model::ModelStorage;
use dojo::world::{IWorldDispatcherTrait, WorldStorage};
use s1_eternum::alias::ID;
use s1_eternum::constants::{ResourceTypes, blitz_produceable_resources};
use s1_eternum::models::config::{
    MapConfig, TickImpl, TickInterval, TroopLimitConfig, TroopStaminaConfig, VillageFoundResourcesConfig,
    WorldConfigUtilImpl,
};
use s1_eternum::models::map::TileOccupier;
use s1_eternum::models::position::{Coord, TravelImpl};
use s1_eternum::models::resource::production::building::{BuildingCategory, BuildingImpl};
use s1_eternum::models::resource::production::production::ProductionImpl;
use s1_eternum::models::resource::resource::{
    ResourceMinMaxList, ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
};
use s1_eternum::models::structure::{
    StructureBaseImpl, StructureCategory, StructureImpl, StructureMetadata, StructureOwnerStoreImpl,
};
use s1_eternum::models::troop::{GuardSlot, TroopTier, TroopType};
use s1_eternum::models::weight::Weight;
use s1_eternum::systems::utils::structure::iStructureImpl;
use s1_eternum::systems::utils::troop::iMercenariesImpl;
use s1_eternum::utils::random;
use s1_eternum::utils::random::VRFImpl;
use starknet::ContractAddress;

#[generate_trait]
pub impl iVillageImpl of iVillageTrait {
    fn village_realm_distance() -> u32 {
        2
    }

    fn ensure_village_realm(
        ref world: WorldStorage, village_structure_metadata: StructureMetadata, check_realm_entity_id: ID,
    ) {
        assert!(village_structure_metadata.village_realm.is_non_zero(), "village owner is not set");
        assert!(check_realm_entity_id.is_non_zero(), "village realm owner is not set");

        if village_structure_metadata.village_realm == check_realm_entity_id {
            return;
        }

        let actual_realm_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(
            ref world, village_structure_metadata.village_realm,
        );
        let check_realm_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(
            ref world, check_realm_entity_id,
        );
        assert!(
            actual_realm_structure_owner == check_realm_structure_owner,
            "villages can only receive troops from realms associated with the same address as the connected realm owner",
        );
    }
}


#[generate_trait]
pub impl iVillageResourceImpl of iVillageResourceTrait {
    fn random(owner: starknet::ContractAddress, world: WorldStorage) -> u8 {
        let vrf_provider: ContractAddress = WorldConfigUtilImpl::get_member(world, selector!("vrf_provider_address"));
        let vrf_seed: u256 = VRFImpl::seed(owner, vrf_provider);
        let resource: u8 = *random::choices(
            Self::resources().span(), Self::resource_probabilities().span(), array![].span(), 1, true, vrf_seed,
        )[0];

        return resource;
    }

    fn resources() -> Array<u8> {
        array![
            ResourceTypes::WOOD, ResourceTypes::STONE, ResourceTypes::COAL, ResourceTypes::COPPER,
            ResourceTypes::OBSIDIAN, ResourceTypes::SILVER, ResourceTypes::IRONWOOD, ResourceTypes::COLD_IRON,
            ResourceTypes::GOLD, ResourceTypes::HARTWOOD, ResourceTypes::DIAMONDS, ResourceTypes::SAPPHIRE,
            ResourceTypes::RUBY, ResourceTypes::DEEP_CRYSTAL, ResourceTypes::IGNIUM, ResourceTypes::ETHEREAL_SILICA,
            ResourceTypes::TRUE_ICE, ResourceTypes::TWILIGHT_QUARTZ, ResourceTypes::ALCHEMICAL_SILVER,
            ResourceTypes::ADAMANTINE, ResourceTypes::MITHRAL, ResourceTypes::DRAGONHIDE,
        ]
    }

    fn resource_probabilities() -> Array<u128> {
        array![
            19_815, // 19.815%
            15_556, // 15.556%
            15_062, // 15.062%
            10_556, // 10.556%
            8_951, // 8.951%
            7_130, // 7.130%
            5_031, // 5.031%
            3_920, // 3.920%
            3_673, // 3.673%
            2_531, // 2.531%
            1_358, // 1.358%
            0_926, // 0.926%
            0_988, // 0.988%
            1_049, // 1.049%
            0_710, // 0.710%
            0_741, // 0.741%
            0_556, // 0.556%
            0_494, // 0.494%
            0_401, // 0.401%
            0_278, // 0.278%
            0_185, // 0.185%
            0_093 // 0.093%
        ]
    }
}


#[generate_trait]
pub impl iVillageDiscoveryImpl of iVillageDiscoveryTrait {
    fn lottery(map_config: MapConfig, vrf_seed: u256) -> bool {
        // make sure seed is different for each lottery system to prevent same outcome for same probability
        let VRF_OFFSET: u256 = 5;
        let village_vrf_seed = if vrf_seed > VRF_OFFSET {
            vrf_seed - VRF_OFFSET
        } else {
            vrf_seed + VRF_OFFSET
        };

        let success: bool = *random::choices(
            array![true, false].span(),
            array![map_config.village_win_probability.into(), map_config.village_fail_probability.into()].span(),
            array![].span(),
            1,
            true,
            // make sure seed is different for each lottery system to prevent same outcome for same probability
            village_vrf_seed,
        )[0];

        return success;
    }

    fn create(
        ref world: WorldStorage,
        coord: Coord,
        troop_limit_config: TroopLimitConfig,
        troop_stamina_config: TroopStaminaConfig,
        vrf_seed: u256,
    ) -> bool {
        // make discoverable village structure
        let structure_id = world.dispatcher.uuid();
        iStructureImpl::create(
            ref world,
            coord,
            Zero::zero(),
            structure_id,
            StructureCategory::Village,
            blitz_produceable_resources().span(),
            Default::default(),
            TileOccupier::Village,
            false,
        );

        // add guards to structure
        // slot must start from delta, to charlie, to beta, to alpha
        let slot_tiers = array![(GuardSlot::Delta, TroopTier::T1, TroopType::Crossbowman)].span();
        let tick_config: TickInterval = TickImpl::get_tick_interval(ref world);
        iMercenariesImpl::add(
            ref world, structure_id, vrf_seed, slot_tiers, troop_limit_config, troop_stamina_config, tick_config,
        );

        // add starting resources to village structure
        let village_find_resources_config: VillageFoundResourcesConfig = WorldConfigUtilImpl::get_member(
            world, selector!("village_find_resources_config"),
        );
        let starting_resources_id = village_find_resources_config.resources_mm_list_id;
        let starting_resources_count = village_find_resources_config.resources_mm_list_count;

        let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, structure_id);

        for i in 0..starting_resources_count {
            let starting_resource_min_max: ResourceMinMaxList = world.read_model((starting_resources_id, i));
            let starting_resource_amount_range = starting_resource_min_max.max_amount
                - starting_resource_min_max.min_amount;
            let mut starting_resource_amount = starting_resource_min_max.min_amount;
            if starting_resource_amount_range.is_non_zero() {
                starting_resource_amount += random::random(vrf_seed, i.into(), starting_resource_amount_range);
            }
            let starting_resource_type = starting_resource_min_max.resource_type;

            // add starting resource to structure
            let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, starting_resource_type);
            let mut starting_resource = SingleResourceStoreImpl::retrieve(
                ref world, structure_id, starting_resource_type, ref structure_weight, resource_weight_grams, true,
            );
            starting_resource.add(starting_resource_amount, ref structure_weight, resource_weight_grams);
            starting_resource.store(ref world);
        }

        // update structure weight
        structure_weight.store(ref world, structure_id);

        // place castle building
        BuildingImpl::create(
            ref world,
            Zero::zero(),
            structure_id,
            StructureCategory::Village.into(),
            coord,
            BuildingCategory::ResourceLabor,
            BuildingImpl::center(),
        );
        return true;
    }
}
