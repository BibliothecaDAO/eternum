use core::num::traits::Zero;
use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::constants::{ResourceTypes};
use s1_eternum::models::config::{WorldConfigUtilImpl};
use s1_eternum::models::position::{TravelImpl};
use s1_eternum::models::structure::{StructureBaseImpl, StructureMetadata, StructureOwnerStoreImpl};
use s1_eternum::utils::random;
use s1_eternum::utils::random::{VRFImpl};
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
            ResourceTypes::WOOD,
            ResourceTypes::STONE,
            ResourceTypes::COAL,
            ResourceTypes::COPPER,
            ResourceTypes::OBSIDIAN,
            ResourceTypes::SILVER,
            ResourceTypes::IRONWOOD,
            ResourceTypes::COLD_IRON,
            ResourceTypes::GOLD,
            ResourceTypes::HARTWOOD,
            ResourceTypes::DIAMONDS,
            ResourceTypes::SAPPHIRE,
            ResourceTypes::RUBY,
            ResourceTypes::DEEP_CRYSTAL,
            ResourceTypes::IGNIUM,
            ResourceTypes::ETHEREAL_SILICA,
            ResourceTypes::TRUE_ICE,
            ResourceTypes::TWILIGHT_QUARTZ,
            ResourceTypes::ALCHEMICAL_SILVER,
            ResourceTypes::ADAMANTINE,
            ResourceTypes::MITHRAL,
            ResourceTypes::DRAGONHIDE,
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
