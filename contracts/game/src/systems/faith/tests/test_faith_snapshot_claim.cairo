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
        DEFAULT_FAITH_CONFIG, FaithConfig, FaithPrizeBalance, FaithSeasonSnapshot, FaithSeasonState, WonderFaith,
    };
    use crate::models::structure::{Structure, StructureCategory, StructureMetadata};
    use crate::systems::faith::contracts::faith_systems;
    use crate::systems::faith::contracts::{IFaithSystemsDispatcher, IFaithSystemsDispatcherTrait};

    fn namespace_def() -> NamespaceDef {
        NamespaceDef {
            namespace: DEFAULT_NS_STR(),
            resources: [
                TestResource::Model("WorldConfig"),
                TestResource::Model("Structure"),
                TestResource::Model("WonderFaith"),
                TestResource::Model("FaithSeasonState"),
                TestResource::Model("FaithSeasonSnapshot"),
                TestResource::Model("FaithPrizeBalance"),
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

    fn faith_dispatcher(ref world: WorldStorage) -> (ContractAddress, IFaithSystemsDispatcher) {
        let (addr, _) = world.dns(@"faith_systems").unwrap();
        (addr, IFaithSystemsDispatcher { contract_address: addr })
    }

    #[test]
    fn test_season_snapshot_created_on_distribution() {
        let mut world = spawn_world();
        let season_id: u32 = 1;
        let wonder_id: ID = 200;
        let wonder_owner = starknet::contract_address_const::<'wonder_owner_snap'>();

        write_structure(ref world, wonder_id, wonder_owner, StructureCategory::Realm, true);
        set_tick_config(ref world, 1);
        set_faith_config(ref world, 10);

        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.season_id = season_id;
        faith.season_fp = 999;
        world.write_model_test(@faith);

        start_cheat_block_timestamp_global(1000);
        faith_systems::distribute_faith_prize_internal(
            ref world, season_id, wonder_id, 1, 1000, 300, 700, wonder_owner,
        );

        let snapshot: FaithSeasonSnapshot = world.read_model((season_id, wonder_id));
        assert!(snapshot.season_fp == 999, "snapshot should capture season fp");
        assert!(snapshot.total_prize == 1000, "snapshot should capture prize total");
        assert!(snapshot.distributed, "snapshot should be marked distributed");
    }

    #[test]
    fn test_claim_prize_within_window() {
        let mut world = spawn_world();
        let season_id: u32 = 2;
        let wonder_id: ID = 201;
        let wonder_owner = starknet::contract_address_const::<'wonder_owner_claim'>();

        write_structure(ref world, wonder_id, wonder_owner, StructureCategory::Realm, true);
        set_tick_config(ref world, 1);
        set_faith_config(ref world, 5);

        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.season_id = season_id;
        world.write_model_test(@faith);

        start_cheat_block_timestamp_global(2000);
        let (_, dispatcher) = faith_dispatcher(ref world);
        faith_systems::distribute_faith_prize_internal(
            ref world, season_id, wonder_id, 1, 1000, 300, 700, wonder_owner,
        );

        start_cheat_caller_address(system_addr, wonder_owner);
        start_cheat_block_timestamp_global(2002);
        dispatcher.claim_faith_prize(season_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        let balance: FaithPrizeBalance = world.read_model((season_id, wonder_id, wonder_owner));
        assert!(balance.claimed, "prize should be marked claimed");
    }

    #[test]
    #[should_panic(expected: ("Claim window closed", 'ENTRYPOINT_FAILED'))]
    fn test_claim_prize_after_window_fails() {
        let mut world = spawn_world();
        let season_id: u32 = 3;
        let wonder_id: ID = 202;
        let wonder_owner = starknet::contract_address_const::<'wonder_owner_late'>();

        write_structure(ref world, wonder_id, wonder_owner, StructureCategory::Realm, true);
        set_tick_config(ref world, 1);
        set_faith_config(ref world, 2);

        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.season_id = season_id;
        world.write_model_test(@faith);

        start_cheat_block_timestamp_global(3000);
        let (_, dispatcher) = faith_dispatcher(ref world);
        faith_systems::distribute_faith_prize_internal(
            ref world, season_id, wonder_id, 1, 1000, 300, 700, wonder_owner,
        );

        start_cheat_caller_address(system_addr, wonder_owner);
        start_cheat_block_timestamp_global(3003);
        dispatcher.claim_faith_prize(season_id, wonder_id);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    fn test_withdraw_unclaimed_after_window() {
        let mut world = spawn_world();
        let season_id: u32 = 4;
        let wonder_id: ID = 203;
        let wonder_owner = starknet::contract_address_const::<'wonder_owner_withdraw'>();

        write_structure(ref world, wonder_id, wonder_owner, StructureCategory::Realm, true);
        set_tick_config(ref world, 1);
        set_faith_config(ref world, 2);

        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.season_id = season_id;
        world.write_model_test(@faith);

        start_cheat_block_timestamp_global(4000);
        let (system_addr, dispatcher) = faith_dispatcher(ref world);
        faith_systems::distribute_faith_prize_internal(
            ref world, season_id, wonder_id, 1, 1000, 300, 700, wonder_owner,
        );

        start_cheat_block_timestamp_global(4003);
        dispatcher.withdraw_unclaimed_faith_prize(season_id);

        let state: FaithSeasonState = world.read_model(season_id);
        assert!(state.leftover_withdrawn, "leftover should be marked withdrawn");
    }
}
