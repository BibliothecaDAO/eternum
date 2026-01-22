#[cfg(test)]
mod tests {
    use dojo::model::{Model, ModelStorage};
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use dojo::world::world;
    use dojo_cairo_test::{
        ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world,
    };
    use starknet::ContractAddress;
    use starknet::testing::{set_account_contract_address, set_contract_address};

    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR};
    use crate::models::config::{TickConfig, WorldConfigUtilImpl, m_WorldConfig};
    use crate::models::faith::{
        FollowerAllegiance, FollowerType, WonderFaith, m_FollowerAllegiance, m_WonderFaith,
    };
    use crate::models::structure::{Structure, StructureCategory, StructureMetadata, m_Structure};
    use crate::systems::faith::contracts::faith_systems;
    use crate::systems::faith::contracts::{IFaithSystemsDispatcher, IFaithSystemsDispatcherTrait};

    fn namespace_def() -> NamespaceDef {
        NamespaceDef {
            namespace: DEFAULT_NS_STR(),
            resources: [
                TestResource::Model(m_WorldConfig::TEST_CLASS_HASH),
                TestResource::Model(m_Structure::TEST_CLASS_HASH),
                TestResource::Model(m_WonderFaith::TEST_CLASS_HASH),
                TestResource::Model(m_FollowerAllegiance::TEST_CLASS_HASH),
                TestResource::Contract(faith_systems::TEST_CLASS_HASH),
            ]
                .span(),
        }
    }

    fn contract_defs() -> Span<ContractDef> {
        [
            ContractDefTrait::new(DEFAULT_NS(), @"faith_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ]
            .span()
    }

    fn spawn_world() -> WorldStorage {
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        world
    }

    fn set_tick_config(ref world: WorldStorage, tick_seconds: u64) {
        let tick_config = TickConfig { armies_tick_in_seconds: tick_seconds, delivery_tick_in_seconds: tick_seconds };
        WorldConfigUtilImpl::set_member(ref world, selector!("tick_config"), tick_config);
    }

    fn write_structure(
        ref world: WorldStorage, entity_id: ID, owner: ContractAddress, category: StructureCategory, has_wonder: bool,
    ) {
        let structure_ptr = Model::<Structure>::ptr_from_keys(entity_id);
        world.write_member(structure_ptr, selector!("owner"), owner);
        let category_u8: u8 = category.into();
        world.write_member(structure_ptr, selector!("category"), category_u8);
        let mut metadata: StructureMetadata = Default::default();
        metadata.has_wonder = has_wonder;
        world.write_member(structure_ptr, selector!("metadata"), metadata);
    }

    fn faith_dispatcher(world: WorldStorage) -> IFaithSystemsDispatcher {
        let (addr, _) = world.dns(@"faith_systems").unwrap();
        IFaithSystemsDispatcher { contract_address: addr }
    }

    fn set_caller(address: ContractAddress) {
        set_contract_address(address);
        set_account_contract_address(address);
    }

    #[test]
    fn test_pledge_faith_realm_to_wonder() {
        let mut world = spawn_world();
        let realm_id: ID = 1;
        let wonder_id: ID = 2;
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let wonder_owner = starknet::contract_address_const::<'wonder_owner'>();

        write_structure(ref world, realm_id, realm_owner, StructureCategory::Realm, false);
        write_structure(ref world, wonder_id, wonder_owner, StructureCategory::Realm, true);
        set_tick_config(ref world, 1);

        set_caller(realm_owner);
        let dispatcher = faith_dispatcher(world);
        dispatcher.pledge_faith(realm_id, wonder_id);

        let allegiance: FollowerAllegiance = world.read_model(realm_id);
        assert!(allegiance.wonder_id == wonder_id, "allegiance not set");
        assert!(allegiance.entity_type == FollowerType::Realm, "entity type mismatch");

        let faith: WonderFaith = world.read_model(wonder_id);
        assert!(faith.realm_follower_count == 1, "realm follower count not incremented");
    }

    #[test]
    fn test_pledge_faith_village_to_wonder() {
        let mut world = spawn_world();
        let village_id: ID = 3;
        let wonder_id: ID = 4;
        let village_owner = starknet::contract_address_const::<'village_owner'>();
        let wonder_owner = starknet::contract_address_const::<'wonder_owner2'>();

        write_structure(ref world, village_id, village_owner, StructureCategory::Village, false);
        write_structure(ref world, wonder_id, wonder_owner, StructureCategory::Realm, true);
        set_tick_config(ref world, 1);

        set_caller(village_owner);
        let dispatcher = faith_dispatcher(world);
        dispatcher.pledge_faith(village_id, wonder_id);

        let faith: WonderFaith = world.read_model(wonder_id);
        assert!(faith.village_follower_count == 1, "village follower count not incremented");
    }

    #[test]
    fn test_pledge_faith_wonder_to_wonder() {
        let mut world = spawn_world();
        let sub_wonder_id: ID = 5;
        let wonder_id: ID = 6;
        let sub_owner = starknet::contract_address_const::<'sub_owner'>();
        let wonder_owner = starknet::contract_address_const::<'wonder_owner3'>();

        write_structure(ref world, sub_wonder_id, sub_owner, StructureCategory::Realm, true);
        write_structure(ref world, wonder_id, wonder_owner, StructureCategory::Realm, true);
        set_tick_config(ref world, 1);

        set_caller(sub_owner);
        let dispatcher = faith_dispatcher(world);
        dispatcher.pledge_faith(sub_wonder_id, wonder_id);

        let faith: WonderFaith = world.read_model(wonder_id);
        assert!(faith.wonder_follower_count == 1, "wonder follower count not incremented");
    }

    #[test]
    #[should_panic(expected: ("Cannot pledge to own Wonder", 'ENTRYPOINT_FAILED'))]
    fn test_pledge_faith_to_own_wonder_fails() {
        let mut world = spawn_world();
        let realm_id: ID = 7;
        let wonder_id: ID = 8;
        let owner = starknet::contract_address_const::<'same_owner'>();

        write_structure(ref world, realm_id, owner, StructureCategory::Realm, false);
        write_structure(ref world, wonder_id, owner, StructureCategory::Realm, true);
        set_tick_config(ref world, 1);

        set_caller(owner);
        let dispatcher = faith_dispatcher(world);
        dispatcher.pledge_faith(realm_id, wonder_id);
    }

    #[test]
    #[should_panic(expected: ("Already pledged", 'ENTRYPOINT_FAILED'))]
    fn test_pledge_faith_when_already_pledged_fails() {
        let mut world = spawn_world();
        let realm_id: ID = 9;
        let wonder_id: ID = 10;
        let owner = starknet::contract_address_const::<'realm_owner2'>();
        let wonder_owner = starknet::contract_address_const::<'wonder_owner4'>();

        write_structure(ref world, realm_id, owner, StructureCategory::Realm, false);
        write_structure(ref world, wonder_id, wonder_owner, StructureCategory::Realm, true);
        set_tick_config(ref world, 1);
        set_tick_config(ref world, 1);

        set_caller(owner);
        let dispatcher = faith_dispatcher(world);
        dispatcher.pledge_faith(realm_id, wonder_id);
        dispatcher.pledge_faith(realm_id, wonder_id);
    }

    #[test]
    #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
    fn test_pledge_faith_not_owner_fails() {
        let mut world = spawn_world();
        let realm_id: ID = 11;
        let wonder_id: ID = 12;
        let owner = starknet::contract_address_const::<'realm_owner3'>();
        let other = starknet::contract_address_const::<'other_owner'>();
        let wonder_owner = starknet::contract_address_const::<'wonder_owner5'>();

        write_structure(ref world, realm_id, owner, StructureCategory::Realm, false);
        write_structure(ref world, wonder_id, wonder_owner, StructureCategory::Realm, true);

        set_caller(other);
        let dispatcher = faith_dispatcher(world);
        dispatcher.pledge_faith(realm_id, wonder_id);
    }

    #[test]
    fn test_pledge_sets_last_fp_index() {
        let mut world = spawn_world();
        let realm_id: ID = 13;
        let wonder_id: ID = 14;
        let realm_owner = starknet::contract_address_const::<'realm_owner_index'>();
        let wonder_owner = starknet::contract_address_const::<'wonder_owner_index'>();

        write_structure(ref world, realm_id, realm_owner, StructureCategory::Realm, false);
        write_structure(ref world, wonder_id, wonder_owner, StructureCategory::Realm, true);
        set_tick_config(ref world, 1);

        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.realm_fp_index = 42;
        world.write_model_test(@faith);

        set_caller(realm_owner);
        let dispatcher = faith_dispatcher(world);
        dispatcher.pledge_faith(realm_id, wonder_id);

        let allegiance: FollowerAllegiance = world.read_model(realm_id);
        assert!(allegiance.last_fp_index == 42, "last index should match current realm index");
    }
}
