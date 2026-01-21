#[starknet::interface]
pub trait IFaithSystems<T> {
    fn pledge_faith(ref self: T, entity_id: u32, wonder_id: u32);
    fn revoke_faith(ref self: T, entity_id: u32);
}

#[dojo::contract]
pub mod faith_systems {
    use core::num::traits::zero::Zero;
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use starknet::ContractAddress;

    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, ErrorMessages};
    use crate::models::faith::{FollowerAllegiance, FollowerType, WonderFaith};
    use crate::models::structure::{Structure, StructureCategory, StructureOwnerStoreImpl};

    #[abi(embed_v0)]
    impl FaithSystemsImpl of super::IFaithSystems<ContractState> {
        fn pledge_faith(ref self: ContractState, entity_id: ID, wonder_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let caller = starknet::get_caller_address();

            let entity_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, entity_id);
            assert!(entity_owner.is_non_zero(), "Entity not found");
            assert!(entity_owner == caller, ErrorMessages::NOT_OWNER);

            let wonder_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, wonder_id);
            assert!(wonder_owner.is_non_zero(), "Wonder not found");

            if entity_owner == wonder_owner {
                panic!("Cannot pledge to own Wonder");
            }

            let allegiance: FollowerAllegiance = world.read_model(entity_id);
            assert!(allegiance.wonder_id.is_zero(), "Already pledged");

            let structure: Structure = world.read_model(entity_id);
            assert!(structure.category.is_non_zero(), "Entity not found");

            let entity_type = if structure.metadata.has_wonder {
                FollowerType::Wonder
            } else if structure.category == StructureCategory::Village.into() {
                FollowerType::Village
            } else {
                FollowerType::Realm
            };

            let now = starknet::get_block_timestamp();
            world.write_model(
                @FollowerAllegiance {
                    entity_id,
                    wonder_id,
                    pledge_tick: now,
                    last_fp_tick: now,
                    accumulated_fp: 0,
                    entity_type,
                },
            );

            let mut faith: WonderFaith = world.read_model(wonder_id);
            match entity_type {
                FollowerType::Realm => { faith.realm_follower_count += 1; },
                FollowerType::Village => { faith.village_follower_count += 1; },
                FollowerType::Wonder => { faith.wonder_follower_count += 1; },
                FollowerType::None => {},
            }
            world.write_model(@faith);
        }

        fn revoke_faith(ref self: ContractState, entity_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let caller = starknet::get_caller_address();
            let entity_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, entity_id);
            assert!(entity_owner.is_non_zero(), "Entity not found");
            assert!(entity_owner == caller, ErrorMessages::NOT_OWNER);

            let mut allegiance: FollowerAllegiance = world.read_model(entity_id);
            assert!(allegiance.wonder_id.is_non_zero(), "Not pledged");
            allegiance.wonder_id = 0;
            world.write_model(@allegiance);
        }
    }
}
