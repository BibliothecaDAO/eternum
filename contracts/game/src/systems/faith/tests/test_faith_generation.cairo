#[cfg(test)]
mod tests {
    use dojo::model::{Model, ModelStorage, ModelStorageTest};
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use dojo_snf_test::{ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world};
    use snforge_std::{start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address};
    use starknet::ContractAddress;

    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR};
    use crate::models::config::{TickConfig, WorldConfigUtilImpl};
    use crate::models::faith::{
        DEFAULT_FAITH_CONFIG, FaithConfig, FollowerFaithBalance, WonderFaith,
    };
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
        config.owner_share_bps = 3000;
        config.follower_share_bps = 7000;
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
    fn test_faith_generation_baseline() {
        let mut world = spawn_world();
        let wonder_id: ID = 100;
        let wonder_owner = starknet::contract_address_const::<'wonder_owner_base'>();

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
    fn test_faith_generation_with_realm_followers() {
        let mut world = spawn_world();
        let wonder_id: ID = 101;
        let realm_id: ID = 102;
        let wonder_owner = starknet::contract_address_const::<'wonder_owner_realm'>();
        let realm_owner = starknet::contract_address_const::<'realm_owner_realm'>();

        write_structure(ref world, wonder_id, wonder_owner, StructureCategory::Realm, true);
        write_structure(ref world, realm_id, realm_owner, StructureCategory::Realm, false);
        set_tick_config(ref world, 1);
        set_faith_config(ref world, 50, 10, 1, 50);

        start_cheat_block_timestamp_global(200);
        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.last_tick_processed = 199;
        world.write_model_test(@faith);

        let (system_addr, dispatcher) = faith_dispatcher(ref world);
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.pledge_faith(realm_id, wonder_id);
        stop_cheat_caller_address(system_addr);
        dispatcher.process_faith(wonder_id);

        let stored: WonderFaith = world.read_model(wonder_id);
        assert!(stored.total_fp_generated == 60, "base + realm follower FP should be generated");
        assert!(stored.realm_fp_index == 7, "realm index should track per-follower share");

        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.settle_faith_balance(realm_id);
        stop_cheat_caller_address(system_addr);
        let realm_balance: FollowerFaithBalance = world.read_model((wonder_id, stored.season_id, realm_owner));
        assert!(realm_balance.total_fp == 7, "realm holder share should settle from index");
    }

    #[test]
    fn test_faith_generation_mixed_followers() {
        let mut world = spawn_world();
        let wonder_id: ID = 110;
        let realm_id: ID = 111;
        let village_id: ID = 112;
        let sub_wonder_id: ID = 113;
        let wonder_owner = starknet::contract_address_const::<'wonder_owner_mix'>();
        let realm_owner = starknet::contract_address_const::<'realm_owner_mix'>();
        let village_owner = starknet::contract_address_const::<'village_owner_mix'>();
        let sub_wonder_owner = starknet::contract_address_const::<'sub_wonder_owner_mix'>();

        write_structure(ref world, wonder_id, wonder_owner, StructureCategory::Realm, true);
        write_structure(ref world, realm_id, realm_owner, StructureCategory::Realm, false);
        write_structure(ref world, village_id, village_owner, StructureCategory::Village, false);
        write_structure(ref world, sub_wonder_id, sub_wonder_owner, StructureCategory::Realm, true);
        set_tick_config(ref world, 1);
        set_faith_config(ref world, 50, 10, 1, 50);

        start_cheat_block_timestamp_global(300);
        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.last_tick_processed = 299;
        world.write_model_test(@faith);

        let (system_addr, dispatcher) = faith_dispatcher(ref world);
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.pledge_faith(realm_id, wonder_id);
        stop_cheat_caller_address(system_addr);
        start_cheat_caller_address(system_addr, village_owner);
        dispatcher.pledge_faith(village_id, wonder_id);
        stop_cheat_caller_address(system_addr);
        start_cheat_caller_address(system_addr, sub_wonder_owner);
        dispatcher.pledge_faith(sub_wonder_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        dispatcher.process_faith(wonder_id);

        let stored: WonderFaith = world.read_model(wonder_id);
        assert!(stored.total_fp_generated == 111, "base + mixed followers FP should be generated");
    }

    #[test]
    fn test_faith_generation_multi_day_catchup() {
        let mut world = spawn_world();
        let wonder_id: ID = 120;
        let wonder_owner = starknet::contract_address_const::<'wonder_owner_catchup'>();

        write_structure(ref world, wonder_id, wonder_owner, StructureCategory::Realm, true);
        set_tick_config(ref world, 1);
        set_faith_config(ref world, 10, 0, 0, 0);

        start_cheat_block_timestamp_global(400);
        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.last_tick_processed = 397;
        world.write_model_test(@faith);

        let (_, dispatcher) = faith_dispatcher(ref world);
        dispatcher.process_faith(wonder_id);

        let stored: WonderFaith = world.read_model(wonder_id);
        assert!(stored.total_fp_generated == 30, "catch-up should generate per-tick FP");
    }

    #[test]
    fn test_faith_generation_idempotent() {
        let mut world = spawn_world();
        let wonder_id: ID = 130;
        let wonder_owner = starknet::contract_address_const::<'wonder_owner_idem'>();

        write_structure(ref world, wonder_id, wonder_owner, StructureCategory::Realm, true);
        set_tick_config(ref world, 1);
        set_faith_config(ref world, 10, 0, 0, 0);

        start_cheat_block_timestamp_global(500);
        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.last_tick_processed = 499;
        world.write_model_test(@faith);

        let (_, dispatcher) = faith_dispatcher(ref world);
        dispatcher.process_faith(wonder_id);
        let first: WonderFaith = world.read_model(wonder_id);

        dispatcher.process_faith(wonder_id);
        let second: WonderFaith = world.read_model(wonder_id);

        assert!(first.total_fp_generated == second.total_fp_generated, "idempotent per tick");
    }

    #[test]
    fn test_faith_distribution_split() {
        let mut world = spawn_world();
        let wonder_id: ID = 140;
        let realm_id: ID = 141;
        let wonder_owner = starknet::contract_address_const::<'wonder_owner_split'>();
        let realm_owner = starknet::contract_address_const::<'realm_owner_split'>();

        write_structure(ref world, wonder_id, wonder_owner, StructureCategory::Realm, true);
        write_structure(ref world, realm_id, realm_owner, StructureCategory::Realm, false);
        set_tick_config(ref world, 1);
        // Use easy numbers for proportional split.
        set_faith_config(ref world, 100, 100, 0, 0);

        start_cheat_block_timestamp_global(600);
        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.last_tick_processed = 599;
        world.write_model_test(@faith);

        let (system_addr, dispatcher) = faith_dispatcher(ref world);
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.pledge_faith(realm_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        dispatcher.process_faith(wonder_id);

        let stored: WonderFaith = world.read_model(wonder_id);
        assert!(stored.current_owner_fp == 130, "owner gets 30% + holder share");

        let owner_balance: FollowerFaithBalance = world.read_model((wonder_id, stored.season_id, wonder_owner));
        assert!(owner_balance.total_fp == 70, "owner holder share should be 70");

        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.settle_faith_balance(realm_id);
        stop_cheat_caller_address(system_addr);
        let realm_balance: FollowerFaithBalance = world.read_model((wonder_id, stored.season_id, realm_owner));
        assert!(realm_balance.total_fp == 70, "realm holder share should be 70");
    }
}
