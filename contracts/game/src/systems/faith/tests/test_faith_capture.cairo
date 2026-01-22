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
        DEFAULT_FAITH_CONFIG, FaithConfig, FaithPrizeBalance, WonderFaith, WonderFaithHistory,
        m_FaithPrizeBalance, m_FaithSeasonSnapshot, m_FaithSeasonState, m_WonderFaith, m_WonderFaithHistory,
    };
    use crate::models::structure::{
        Structure, StructureCategory, StructureMetadata, m_Structure, m_StructureOwnerStats,
    };
    use crate::systems::faith::contracts::faith_systems;
    use crate::systems::faith::contracts::{IFaithSystemsDispatcher, IFaithSystemsDispatcherTrait};

    fn namespace_def() -> NamespaceDef {
        NamespaceDef {
            namespace: DEFAULT_NS_STR(),
            resources: [
                TestResource::Model(m_WorldConfig::TEST_CLASS_HASH),
                TestResource::Model(m_Structure::TEST_CLASS_HASH),
                TestResource::Model(m_StructureOwnerStats::TEST_CLASS_HASH),
                TestResource::Model(m_WonderFaith::TEST_CLASS_HASH),
                TestResource::Model(m_WonderFaithHistory::TEST_CLASS_HASH),
                TestResource::Model(m_FaithSeasonState::TEST_CLASS_HASH),
                TestResource::Model(m_FaithSeasonSnapshot::TEST_CLASS_HASH),
                TestResource::Model(m_FaithPrizeBalance::TEST_CLASS_HASH),
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

    fn set_faith_config(ref world: WorldStorage, claim_window_ticks: u32) {
        let mut config: FaithConfig = DEFAULT_FAITH_CONFIG();
        config.claim_window_ticks = claim_window_ticks;
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
    fn test_wonder_capture_creates_history() {
        let mut world = spawn_world();
        let season_id: u32 = 5;
        let wonder_id: ID = 300;
        let old_owner = starknet::contract_address_const::<'wonder_owner_old'>();
        let new_owner = starknet::contract_address_const::<'wonder_owner_new'>();

        write_structure(ref world, wonder_id, old_owner, StructureCategory::Realm, true);
        set_tick_config(ref world, 1);
        set_faith_config(ref world, 10);

        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.season_id = season_id;
        faith.current_owner_fp = 555;
        faith.last_tick_processed = 42;
        world.write_model_test(@faith);

        set_block_timestamp(100);
        let dispatcher = faith_dispatcher(world);
        dispatcher.record_wonder_capture(wonder_id, new_owner);

        let history: WonderFaithHistory = world.read_model((wonder_id, season_id, old_owner));
        assert!(history.fp_earned_while_owner == 555, "history should store owner fp");
        assert!(history.ownership_end_tick == 100, "history end tick should match current tick");
        assert!(!history.prize_claimed, "history prize should be unclaimed");
    }

    #[test]
    fn test_wonder_capture_resets_current_fp() {
        let mut world = spawn_world();
        let wonder_id: ID = 301;
        let old_owner = starknet::contract_address_const::<'wonder_owner_old2'>();
        let new_owner = starknet::contract_address_const::<'wonder_owner_new2'>();

        write_structure(ref world, wonder_id, old_owner, StructureCategory::Realm, true);
        set_tick_config(ref world, 1);
        set_faith_config(ref world, 10);

        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.current_owner_fp = 999;
        world.write_model_test(@faith);

        set_block_timestamp(200);
        let dispatcher = faith_dispatcher(world);
        dispatcher.record_wonder_capture(wonder_id, new_owner);

        let stored: WonderFaith = world.read_model(wonder_id);
        assert!(stored.current_owner_fp == 0, "current owner fp should reset");
    }

    #[test]
    fn test_wonder_capture_preserves_followers() {
        let mut world = spawn_world();
        let wonder_id: ID = 302;
        let old_owner = starknet::contract_address_const::<'wonder_owner_old3'>();
        let new_owner = starknet::contract_address_const::<'wonder_owner_new3'>();

        write_structure(ref world, wonder_id, old_owner, StructureCategory::Realm, true);
        set_tick_config(ref world, 1);
        set_faith_config(ref world, 10);

        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.realm_follower_count = 2;
        faith.village_follower_count = 3;
        faith.wonder_follower_count = 1;
        world.write_model_test(@faith);

        set_block_timestamp(300);
        let dispatcher = faith_dispatcher(world);
        dispatcher.record_wonder_capture(wonder_id, new_owner);

        let stored: WonderFaith = world.read_model(wonder_id);
        assert!(stored.realm_follower_count == 2, "realm followers should persist");
        assert!(stored.village_follower_count == 3, "village followers should persist");
        assert!(stored.wonder_follower_count == 1, "wonder followers should persist");
    }

    #[test]
    fn test_original_owner_claims_historical_prize() {
        let mut world = spawn_world();
        let season_id: u32 = 6;
        let wonder_id: ID = 303;
        let old_owner = starknet::contract_address_const::<'wonder_owner_old4'>();
        let new_owner = starknet::contract_address_const::<'wonder_owner_new4'>();

        write_structure(ref world, wonder_id, old_owner, StructureCategory::Realm, true);
        set_tick_config(ref world, 1);
        set_faith_config(ref world, 2);

        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.season_id = season_id;
        world.write_model_test(@faith);

        set_block_timestamp(400);
        let dispatcher = faith_dispatcher(world);
        dispatcher.record_wonder_capture(wonder_id, new_owner);

        faith_systems::distribute_faith_prize_internal(ref world, season_id, wonder_id, 1, 1000, 300, 700, old_owner);

        set_caller(old_owner);
        dispatcher.claim_faith_prize(season_id, wonder_id);

        let balance: FaithPrizeBalance = world.read_model((season_id, wonder_id, old_owner));
        assert!(balance.claimed, "original owner should claim historical prize");
    }
}
