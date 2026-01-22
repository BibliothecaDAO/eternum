#[cfg(test)]
mod tests {
    use core::array::ArrayTrait;
    use dojo::model::{Model, ModelStorage, ModelStorageTest};
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use dojo_snf_test::{ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world};
    use snforge_std::{start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address};
    use starknet::ContractAddress;

    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR};
    use crate::models::config::{TickConfig, WorldConfigUtilImpl};
    use crate::models::faith::{
        DEFAULT_FAITH_CONFIG, FaithConfig, FollowerAllegiance, FollowerFaithBalance, WonderFaith,
    };
    use crate::models::structure::{Structure, StructureCategory, StructureMetadata};
    use crate::systems::faith::contracts::{IFaithSystemsDispatcher, IFaithSystemsDispatcherTrait};

    const MAX_WONDER_ALLEGIANCE_DEPTH: u32 = 16;

    fn namespace_def() -> NamespaceDef {
        NamespaceDef {
            namespace: DEFAULT_NS_STR(),
            resources: [
                TestResource::Model("WorldConfig"),
                TestResource::Model("Structure"),
                TestResource::Model("WonderFaith"),
                TestResource::Model("FollowerAllegiance"),
                TestResource::Model("FollowerFaithBalance"),
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
        set_tick_config(ref world, 1);
        world
    }

    fn set_tick_config(ref world: WorldStorage, tick_seconds: u64) {
        let tick_config = TickConfig { armies_tick_in_seconds: tick_seconds, delivery_tick_in_seconds: tick_seconds };
        WorldConfigUtilImpl::set_member(ref world, selector!("tick_config"), tick_config);
    }

    fn set_faith_config(ref world: WorldStorage, base: u64, realm: u64, village: u64, wonder: u64) {
        let mut config: FaithConfig = DEFAULT_FAITH_CONFIG();
        config.wonder_base_fp = base;
        config.realm_follower_fp = realm;
        config.village_follower_fp = village;
        config.wonder_follower_fp = wonder;
        WorldConfigUtilImpl::set_member(ref world, selector!("faith_config"), config);
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
    fn test_zero_followers_generates_baseline_only() {
        let mut world = spawn_world();
        let wonder_id: ID = 1000;
        let wonder_owner = starknet::contract_address_const::<'zero_followers_owner'>();

        write_structure(ref world, wonder_id, wonder_owner, StructureCategory::Realm, true);
        set_tick_config(ref world, 1);
        set_faith_config(ref world, 50, 10, 1, 50);

        start_cheat_block_timestamp_global(100);
        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.last_tick_processed = 99;
        world.write_model_test(@faith);

        let (_, dispatcher) = faith_dispatcher(ref world);
        dispatcher.process_faith(wonder_id);

        let stored: WonderFaith = world.read_model(wonder_id);
        assert!(stored.total_fp_generated == 50, "baseline FP should be generated");
        assert!(stored.season_fp == 50, "season FP should be generated");
        assert!(stored.current_owner_fp == 50, "owner should receive full FP when solo");
    }

    #[test]
    fn test_follower_leaves_before_fp_tick() {
        let mut world = spawn_world();
        let wonder_id: ID = 1001;
        let realm_id: ID = 1002;
        let wonder_owner = starknet::contract_address_const::<'leave_before_owner'>();
        let realm_owner = starknet::contract_address_const::<'leave_before_realm'>();

        write_structure(ref world, wonder_id, wonder_owner, StructureCategory::Realm, true);
        write_structure(ref world, realm_id, realm_owner, StructureCategory::Realm, false);
        set_tick_config(ref world, 1);
        set_faith_config(ref world, 50, 10, 1, 50);

        start_cheat_block_timestamp_global(100);
        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.last_tick_processed = 99;
        world.write_model_test(@faith);

        let (system_addr, dispatcher) = faith_dispatcher(ref world);
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.pledge_faith(realm_id, wonder_id);
        dispatcher.revoke_faith(realm_id);
        stop_cheat_caller_address(system_addr);

        start_cheat_block_timestamp_global(101);
        dispatcher.process_faith(wonder_id);

        let stored: WonderFaith = world.read_model(wonder_id);
        assert!(stored.season_fp == 100, "baseline should accrue without follower FP");

        let allegiance: FollowerAllegiance = world.read_model(realm_id);
        assert!(allegiance.accumulated_fp == 0, "no FP should accrue before leaving");

        let balance: FollowerFaithBalance = world.read_model((wonder_id, stored.season_id, realm_owner));
        assert!(balance.total_fp == 0, "holder balance should remain empty");
    }

    #[test]
    #[should_panic(expected: ("Circular wonder allegiance", 'ENTRYPOINT_FAILED'))]
    fn test_circular_wonder_allegiance_direct_fails() {
        let mut world = spawn_world();
        let wonder_a: ID = 2000;
        let wonder_b: ID = 2001;
        let owner_a = starknet::contract_address_const::<'cycle_owner_a'>();
        let owner_b = starknet::contract_address_const::<'cycle_owner_b'>();

        write_structure(ref world, wonder_a, owner_a, StructureCategory::Realm, true);
        write_structure(ref world, wonder_b, owner_b, StructureCategory::Realm, true);

        let (system_addr, dispatcher) = faith_dispatcher(ref world);
        start_cheat_caller_address(system_addr, owner_a);
        dispatcher.pledge_faith(wonder_a, wonder_b);

        stop_cheat_caller_address(system_addr);
        start_cheat_caller_address(system_addr, owner_b);
        dispatcher.pledge_faith(wonder_b, wonder_a);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: ("Circular wonder allegiance", 'ENTRYPOINT_FAILED'))]
    fn test_circular_wonder_allegiance_transitive_fails() {
        let mut world = spawn_world();
        let wonder_a: ID = 2100;
        let wonder_b: ID = 2101;
        let wonder_c: ID = 2102;
        let owner_a = starknet::contract_address_const::<'cycle_owner_a2'>();
        let owner_b = starknet::contract_address_const::<'cycle_owner_b2'>();
        let owner_c = starknet::contract_address_const::<'cycle_owner_c2'>();

        write_structure(ref world, wonder_a, owner_a, StructureCategory::Realm, true);
        write_structure(ref world, wonder_b, owner_b, StructureCategory::Realm, true);
        write_structure(ref world, wonder_c, owner_c, StructureCategory::Realm, true);

        let (system_addr, dispatcher) = faith_dispatcher(ref world);
        start_cheat_caller_address(system_addr, owner_a);
        dispatcher.pledge_faith(wonder_a, wonder_b);
        stop_cheat_caller_address(system_addr);
        start_cheat_caller_address(system_addr, owner_b);
        dispatcher.pledge_faith(wonder_b, wonder_c);

        stop_cheat_caller_address(system_addr);
        start_cheat_caller_address(system_addr, owner_c);
        dispatcher.pledge_faith(wonder_c, wonder_a);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    fn test_non_circular_wonder_chain_allowed() {
        let mut world = spawn_world();
        let wonder_a: ID = 2200;
        let wonder_b: ID = 2201;
        let wonder_c: ID = 2202;
        let wonder_d: ID = 2203;
        let owner_a = starknet::contract_address_const::<'chain_owner_a'>();
        let owner_b = starknet::contract_address_const::<'chain_owner_b'>();
        let owner_c = starknet::contract_address_const::<'chain_owner_c'>();
        let owner_d = starknet::contract_address_const::<'chain_owner_d'>();

        write_structure(ref world, wonder_a, owner_a, StructureCategory::Realm, true);
        write_structure(ref world, wonder_b, owner_b, StructureCategory::Realm, true);
        write_structure(ref world, wonder_c, owner_c, StructureCategory::Realm, true);
        write_structure(ref world, wonder_d, owner_d, StructureCategory::Realm, true);

        let (system_addr, dispatcher) = faith_dispatcher(ref world);
        start_cheat_caller_address(system_addr, owner_a);
        dispatcher.pledge_faith(wonder_a, wonder_b);
        stop_cheat_caller_address(system_addr);
        start_cheat_caller_address(system_addr, owner_b);
        dispatcher.pledge_faith(wonder_b, wonder_c);
        stop_cheat_caller_address(system_addr);
        start_cheat_caller_address(system_addr, owner_c);
        dispatcher.pledge_faith(wonder_c, wonder_d);
        stop_cheat_caller_address(system_addr);

        let allegiance_a: FollowerAllegiance = world.read_model(wonder_a);
        let allegiance_b: FollowerAllegiance = world.read_model(wonder_b);
        let allegiance_c: FollowerAllegiance = world.read_model(wonder_c);
        assert!(allegiance_a.wonder_id == wonder_b, "wonder A should follow B");
        assert!(allegiance_b.wonder_id == wonder_c, "wonder B should follow C");
        assert!(allegiance_c.wonder_id == wonder_d, "wonder C should follow D");
    }

    #[test]
    fn test_fp_accumulation_no_overflow() {
        let mut world = spawn_world();
        let wonder_id: ID = 2300;
        let owner = starknet::contract_address_const::<'overflow_owner'>();

        write_structure(ref world, wonder_id, owner, StructureCategory::Realm, true);
        set_tick_config(ref world, 1);
        set_faith_config(ref world, 1_000_000_000_000_000_000, 0, 0, 0);

        start_cheat_block_timestamp_global(2000);
        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.last_tick_processed = 1990;
        world.write_model_test(@faith);

        let (_, dispatcher) = faith_dispatcher(ref world);
        dispatcher.process_faith(wonder_id);

        let stored: WonderFaith = world.read_model(wonder_id);
        assert!(stored.total_fp_generated == 10_000_000_000_000_000_000, "large FP should accumulate safely");
    }

    #[test]
    #[should_panic(expected: ("Entity not found", 'ENTRYPOINT_FAILED'))]
    fn test_deleted_entity_pledge_fails() {
        let mut world = spawn_world();
        let wonder_id: ID = 2400;
        let wonder_owner = starknet::contract_address_const::<'deleted_wonder_owner'>();
        let missing_entity: ID = 2401;
        let missing_owner = starknet::contract_address_const::<'deleted_entity_owner'>();

        write_structure(ref world, wonder_id, wonder_owner, StructureCategory::Realm, true);

        let (system_addr, dispatcher) = faith_dispatcher(ref world);
        start_cheat_caller_address(system_addr, missing_owner);
        dispatcher.pledge_faith(missing_entity, wonder_id);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: ("Faith chain too deep", 'ENTRYPOINT_FAILED'))]
    fn test_max_depth_circular_check() {
        let mut world = spawn_world();
        let mut wonders: Array<ID> = ArrayTrait::new();
        let owner_a = starknet::contract_address_const::<'chain_depth_a'>();
        let owner_b = starknet::contract_address_const::<'chain_depth_b'>();
        let mut i: u32 = 0;
        loop {
            if i > MAX_WONDER_ALLEGIANCE_DEPTH {
                break;
            }
            let wonder_id: ID = 2500 + i;
            let owner = if i % 2 == 0 { owner_a } else { owner_b };
            write_structure(ref world, wonder_id, owner, StructureCategory::Realm, true);
            wonders.append(wonder_id);
            i += 1;
        }

        let extra_wonder: ID = 2600;
        let extra_owner = owner_b;
        write_structure(ref world, extra_wonder, extra_owner, StructureCategory::Realm, true);

        let (system_addr, dispatcher) = faith_dispatcher(ref world);
        let mut idx: u32 = 0;
        loop {
            if idx + 1 >= wonders.len() {
                break;
            }
            let follower_id: ID = *wonders.at(idx);
            let target_id: ID = *wonders.at(idx + 1);
            let owner = if idx % 2 == 0 { owner_a } else { owner_b };
            start_cheat_caller_address(system_addr, owner);
            dispatcher.pledge_faith(follower_id, target_id);
            stop_cheat_caller_address(system_addr);
            idx += 1;
        }

        start_cheat_caller_address(system_addr, extra_owner);
        dispatcher.pledge_faith(extra_wonder, *wonders.at(0));
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: ("Cannot pledge to own Wonder", 'ENTRYPOINT_FAILED'))]
    fn test_village_owned_by_wonder_owner_cannot_pledge() {
        let mut world = spawn_world();
        let wonder_id: ID = 2700;
        let village_id: ID = 2701;
        let owner = starknet::contract_address_const::<'same_owner_village'>();

        write_structure(ref world, wonder_id, owner, StructureCategory::Realm, true);
        write_structure(ref world, village_id, owner, StructureCategory::Village, false);

        let (system_addr, dispatcher) = faith_dispatcher(ref world);
        start_cheat_caller_address(system_addr, owner);
        dispatcher.pledge_faith(village_id, wonder_id);
        stop_cheat_caller_address(system_addr);
    }
}
