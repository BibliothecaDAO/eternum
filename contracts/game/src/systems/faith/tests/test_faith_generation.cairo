#[cfg(test)]
mod tests {
    use dojo::model::{Model, ModelStorage, ModelStorageTest};
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use dojo::world::world;
    use dojo_cairo_test::{
        ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world,
    };
    use starknet::ContractAddress;
    use starknet::testing::{set_account_contract_address, set_contract_address, set_block_timestamp};

    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR};
    use crate::models::config::{TickConfig, WorldConfigUtilImpl, m_WorldConfig};
    use crate::models::faith::{
        DEFAULT_FAITH_CONFIG, FaithConfig, FollowerFaithBalance, WonderFaith, m_FollowerAllegiance,
        m_FollowerFaithBalance, m_WonderFaith,
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
                TestResource::Model(m_FollowerFaithBalance::TEST_CLASS_HASH),
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

    fn faith_dispatcher(world: WorldStorage) -> IFaithSystemsDispatcher {
        let (addr, _) = world.dns(@"faith_systems").unwrap();
        IFaithSystemsDispatcher { contract_address: addr }
    }

    fn set_caller(address: ContractAddress) {
        set_contract_address(address);
        set_account_contract_address(address);
    }

    #[test]
    fn test_faith_generation_baseline() {
        let mut world = spawn_world();
        let wonder_id: ID = 100;
        let wonder_owner = starknet::contract_address_const::<'wonder_owner_base'>();

        write_structure(ref world, wonder_id, wonder_owner, StructureCategory::Realm, true);
        set_tick_config(ref world, 1);
        set_faith_config(ref world, 50, 10, 1, 50);

        set_block_timestamp(100);
        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.last_tick_processed = 99;
        world.write_model_test(@faith);

        let dispatcher = faith_dispatcher(world);
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

        set_block_timestamp(200);
        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.last_tick_processed = 199;
        world.write_model_test(@faith);

        set_caller(realm_owner);
        let dispatcher = faith_dispatcher(world);
        dispatcher.pledge_faith(realm_id, wonder_id);
        dispatcher.process_faith(wonder_id);

        let stored: WonderFaith = world.read_model(wonder_id);
        assert!(stored.total_fp_generated == 60, "base + realm follower FP should be generated");
        assert!(stored.realm_fp_index == 7, "realm index should track per-follower share");

        dispatcher.settle_faith_balance(realm_id);
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

        set_block_timestamp(300);
        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.last_tick_processed = 299;
        world.write_model_test(@faith);

        let dispatcher = faith_dispatcher(world);
        set_caller(realm_owner);
        dispatcher.pledge_faith(realm_id, wonder_id);
        set_caller(village_owner);
        dispatcher.pledge_faith(village_id, wonder_id);
        set_caller(sub_wonder_owner);
        dispatcher.pledge_faith(sub_wonder_id, wonder_id);

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

        set_block_timestamp(400);
        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.last_tick_processed = 397;
        world.write_model_test(@faith);

        let dispatcher = faith_dispatcher(world);
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

        set_block_timestamp(500);
        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.last_tick_processed = 499;
        world.write_model_test(@faith);

        let dispatcher = faith_dispatcher(world);
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

        set_block_timestamp(600);
        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.last_tick_processed = 599;
        world.write_model_test(@faith);

        set_caller(realm_owner);
        let dispatcher = faith_dispatcher(world);
        dispatcher.pledge_faith(realm_id, wonder_id);

        dispatcher.process_faith(wonder_id);

        let stored: WonderFaith = world.read_model(wonder_id);
        assert!(stored.current_owner_fp == 130, "owner gets 30% + holder share");

        let owner_balance: FollowerFaithBalance = world.read_model((wonder_id, stored.season_id, wonder_owner));
        assert!(owner_balance.total_fp == 70, "owner holder share should be 70");

        dispatcher.settle_faith_balance(realm_id);
        let realm_balance: FollowerFaithBalance = world.read_model((wonder_id, stored.season_id, realm_owner));
        assert!(realm_balance.total_fp == 70, "realm holder share should be 70");
    }
}
