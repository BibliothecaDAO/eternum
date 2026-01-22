#[cfg(test)]
mod tests {
    use dojo::model::{Model, ModelStorage, ModelStorageTest};
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use dojo_snf_test::{ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world};
    use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
    use starknet::ContractAddress;

    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR};
    use crate::models::config::{TickConfig, WorldConfigUtilImpl};
    use crate::models::faith::{FollowerAllegiance, FollowerType, WonderFaith};
    use crate::models::structure::{Structure, StructureCategory, StructureMetadata};
    use crate::systems::faith::contracts::{IFaithSystemsDispatcher, IFaithSystemsDispatcherTrait};

    fn namespace_def() -> NamespaceDef {
        NamespaceDef {
            namespace: DEFAULT_NS_STR(),
            resources: [
                TestResource::Model("WorldConfig"),
                TestResource::Model("Structure"),
                TestResource::Model("WonderFaith"),
                TestResource::Model("FollowerAllegiance"),
                TestResource::Contract("faith_systems"),
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
        let mut world = spawn_test_world([namespace_def()].span());
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

    fn faith_dispatcher(ref world: WorldStorage) -> (ContractAddress, IFaithSystemsDispatcher) {
        let (addr, _) = world.dns(@"faith_systems").unwrap();
        (addr, IFaithSystemsDispatcher { contract_address: addr })
    }

    #[test]
    fn test_revoke_faith() {
        let mut world = spawn_world();
        let realm_id: ID = 21;
        let wonder_id: ID = 22;
        let realm_owner = starknet::contract_address_const::<'realm_owner_r'>();
        let wonder_owner = starknet::contract_address_const::<'wonder_owner_r'>();

        write_structure(ref world, realm_id, realm_owner, StructureCategory::Realm, false);
        write_structure(ref world, wonder_id, wonder_owner, StructureCategory::Realm, true);
        set_tick_config(ref world, 1);

        let (system_addr, dispatcher) = faith_dispatcher(ref world);
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.pledge_faith(realm_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        let before: WonderFaith = world.read_model(wonder_id);
        assert!(before.realm_follower_count == 1, "realm follower count should increment");

        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.revoke_faith(realm_id);
        stop_cheat_caller_address(system_addr);

        let allegiance: FollowerAllegiance = world.read_model(realm_id);
        assert!(allegiance.wonder_id == 0, "allegiance should be cleared");

        let after: WonderFaith = world.read_model(wonder_id);
        assert!(after.realm_follower_count == 0, "realm follower count should decrement");
    }

    #[test]
    fn test_revoke_faith_preserves_accrued_fp() {
        let mut world = spawn_world();
        let realm_id: ID = 23;
        let wonder_id: ID = 24;
        let realm_owner = starknet::contract_address_const::<'realm_owner_r2'>();
        let wonder_owner = starknet::contract_address_const::<'wonder_owner_r2'>();

        write_structure(ref world, realm_id, realm_owner, StructureCategory::Realm, false);
        write_structure(ref world, wonder_id, wonder_owner, StructureCategory::Realm, true);
        set_tick_config(ref world, 1);

        let (system_addr, dispatcher) = faith_dispatcher(ref world);
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.pledge_faith(realm_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        let mut allegiance: FollowerAllegiance = world.read_model(realm_id);
        allegiance.accumulated_fp = 123;
        allegiance.last_fp_tick = 777;
        world.write_model_test(@allegiance);

        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.revoke_faith(realm_id);
        stop_cheat_caller_address(system_addr);

        let stored: FollowerAllegiance = world.read_model(realm_id);
        assert!(stored.accumulated_fp == 123, "accumulated FP should remain");
        assert!(stored.last_fp_tick == 777, "last FP tick should remain");
        assert!(stored.entity_type == FollowerType::Realm, "entity type should remain");
    }

    #[test]
    #[should_panic(expected: ("Not pledged", 'ENTRYPOINT_FAILED'))]
    fn test_revoke_faith_when_not_pledged_fails() {
        let mut world = spawn_world();
        let realm_id: ID = 25;
        let wonder_id: ID = 26;
        let realm_owner = starknet::contract_address_const::<'realm_owner_r3'>();
        let wonder_owner = starknet::contract_address_const::<'wonder_owner_r3'>();

        write_structure(ref world, realm_id, realm_owner, StructureCategory::Realm, false);
        write_structure(ref world, wonder_id, wonder_owner, StructureCategory::Realm, true);

        let (system_addr, dispatcher) = faith_dispatcher(ref world);
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.revoke_faith(realm_id);
        stop_cheat_caller_address(system_addr);
    }
}
