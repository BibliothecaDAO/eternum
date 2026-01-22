#[cfg(test)]
mod tests {
    use core::array::ArrayTrait;
    use dojo::model::{Model, ModelStorage, ModelStorageTest};
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use dojo::world::world;
    use dojo_cairo_test::{
        ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world,
    };
    use starknet::ContractAddress;
    use starknet::testing::{set_account_contract_address, set_block_timestamp, set_contract_address};

    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR, WORLD_CONFIG_ID};
    use crate::models::config::{TickConfig, WorldConfigUtilImpl, m_WorldConfig};
    use crate::models::faith::{
        DEFAULT_FAITH_CONFIG, FaithConfig, FaithPrizeBalance, FaithPrizeConfig, FaithSeasonSnapshot,
        FaithSeasonState, FollowerFaithBalance, WonderFaith, m_FaithPrizeBalance, m_FaithSeasonSnapshot,
        m_FaithSeasonState, m_FollowerFaithBalance, m_WonderFaith,
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
                TestResource::Model(m_FaithSeasonState::TEST_CLASS_HASH),
                TestResource::Model(m_FaithSeasonSnapshot::TEST_CLASS_HASH),
                TestResource::Model(m_FaithPrizeBalance::TEST_CLASS_HASH),
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

    fn set_faith_config(ref world: WorldStorage, claim_window_ticks: u32, prize_pool_total: u128) {
        let mut config: FaithConfig = DEFAULT_FAITH_CONFIG();
        config.claim_window_ticks = claim_window_ticks;
        config.prize_pool_total = prize_pool_total;
        WorldConfigUtilImpl::set_member(ref world, selector!("faith_config"), config);
    }

    fn set_faith_prize_config(
        ref world: WorldStorage,
        rank_shares: Span<u16>,
        owner_share_bps: u16,
        holders_share_bps: u16,
    ) {
        let config = FaithPrizeConfig {
            rank_1_share_bps: *rank_shares.at(0),
            rank_2_share_bps: *rank_shares.at(1),
            rank_3_share_bps: *rank_shares.at(2),
            rank_4_share_bps: *rank_shares.at(3),
            rank_5_share_bps: *rank_shares.at(4),
            rank_6_share_bps: *rank_shares.at(5),
            rank_7_share_bps: *rank_shares.at(6),
            rank_8_share_bps: *rank_shares.at(7),
            rank_9_share_bps: *rank_shares.at(8),
            rank_10_share_bps: *rank_shares.at(9),
            wonder_owner_share_bps: owner_share_bps,
            fp_holders_share_bps: holders_share_bps,
            config_id: WORLD_CONFIG_ID,
        };
        WorldConfigUtilImpl::set_member(ref world, selector!("faith_prize_config"), config);
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
    fn test_fund_prize_pool_accumulates() {
        let mut world = spawn_world();
        let season_id: u32 = 1;

        let dispatcher = faith_dispatcher(world);
        dispatcher.fund_faith_prize_pool(season_id, 500);
        dispatcher.fund_faith_prize_pool(season_id, 250);

        let state: FaithSeasonState = world.read_model(season_id);
        assert!(state.prize_pool_total == 750, "prize pool should accumulate");
    }

    #[test]
    fn test_distribute_season_prizes_rank_share_and_owner_split() {
        let mut world = spawn_world();
        let season_id: u32 = 2;
        let owner = starknet::contract_address_const::<'faith_prize_owner'>();

        set_tick_config(ref world, 1);
        set_faith_config(ref world, 5, 0);
        set_faith_prize_config(
            ref world,
            array![2000_u16, 1500_u16, 1200_u16, 1000_u16, 900_u16, 800_u16, 700_u16, 600_u16, 500_u16, 800_u16]
                .span(),
            3000,
            7000,
        );

        let mut wonders: Array<ID> = ArrayTrait::new();
        let mut i: u32 = 0;
        loop {
            if i >= 10 {
                break;
            }
            let wonder_id: ID = i + 1;
            wonders.append(wonder_id);
            write_structure(ref world, wonder_id, owner, StructureCategory::Realm, true);
            let mut faith: WonderFaith = world.read_model(wonder_id);
            faith.season_id = season_id;
            faith.season_fp = 1000_u128 - i.into();
            world.write_model_test(@faith);
            i += 1;
        }

        set_block_timestamp(1000);
        let mut state: FaithSeasonState = world.read_model(season_id);
        state.season_id = season_id;
        state.season_end_tick = 1000;
        world.write_model_test(@state);

        let dispatcher = faith_dispatcher(world);
        dispatcher.fund_faith_prize_pool(season_id, 1000);
        dispatcher.distribute_faith_season_prizes(season_id, wonders.span());

        let snapshot: FaithSeasonSnapshot = world.read_model((season_id, 1));
        assert!(snapshot.total_prize == 200, "rank 1 prize should use share bps");
        assert!(snapshot.owner_prize == 60, "owner share should be applied");
        assert!(snapshot.holders_prize == 140, "holders share should be applied");

        let balance: FaithPrizeBalance = world.read_model((season_id, 1, owner));
        assert!(balance.amount == 60, "owner prize balance should be created");

        let state_after: FaithSeasonState = world.read_model(season_id);
        assert!(state_after.unallocated_prize == 0, "no unallocated prize when all ranks filled");
        assert!(state_after.claim_window_end_tick == 1005, "claim window should be set from config");
        assert!(state_after.distributed, "season should be marked distributed");
    }

    #[test]
    fn test_distribute_season_prizes_tie_combines_ranks() {
        let mut world = spawn_world();
        let season_id: u32 = 3;
        let owner = starknet::contract_address_const::<'tie_owner'>();

        set_tick_config(ref world, 1);
        set_faith_config(ref world, 5, 0);
        set_faith_prize_config(
            ref world,
            array![5000_u16, 3000_u16, 0_u16, 0_u16, 0_u16, 0_u16, 0_u16, 0_u16, 0_u16, 0_u16].span(),
            0,
            10_000,
        );

        let wonder_a: ID = 11;
        let wonder_b: ID = 12;
        write_structure(ref world, wonder_a, owner, StructureCategory::Realm, true);
        write_structure(ref world, wonder_b, owner, StructureCategory::Realm, true);

        let mut faith_a: WonderFaith = world.read_model(wonder_a);
        faith_a.season_id = season_id;
        faith_a.season_fp = 500;
        world.write_model_test(@faith_a);
        let mut faith_b: WonderFaith = world.read_model(wonder_b);
        faith_b.season_id = season_id;
        faith_b.season_fp = 500;
        world.write_model_test(@faith_b);

        set_block_timestamp(2000);
        let mut state: FaithSeasonState = world.read_model(season_id);
        state.season_id = season_id;
        state.season_end_tick = 2000;
        world.write_model_test(@state);

        let dispatcher = faith_dispatcher(world);
        dispatcher.fund_faith_prize_pool(season_id, 1000);
        dispatcher.distribute_faith_season_prizes(season_id, array![wonder_a, wonder_b].span());

        let snap_a: FaithSeasonSnapshot = world.read_model((season_id, wonder_a));
        let snap_b: FaithSeasonSnapshot = world.read_model((season_id, wonder_b));
        assert!(snap_a.total_prize == 400, "tie should split combined rank share");
        assert!(snap_b.total_prize == 400, "tie should split combined rank share");
    }

    #[test]
    fn test_unallocated_prize_for_missing_ranks() {
        let mut world = spawn_world();
        let season_id: u32 = 4;
        let owner = starknet::contract_address_const::<'unallocated_owner'>();

        set_tick_config(ref world, 1);
        set_faith_config(ref world, 5, 0);
        set_faith_prize_config(
            ref world,
            array![1000_u16, 1000_u16, 1000_u16, 1000_u16, 1000_u16, 1000_u16, 1000_u16, 1000_u16, 1000_u16, 1000_u16]
                .span(),
            3000,
            7000,
        );

        let wonder_a: ID = 21;
        let wonder_b: ID = 22;
        write_structure(ref world, wonder_a, owner, StructureCategory::Realm, true);
        write_structure(ref world, wonder_b, owner, StructureCategory::Realm, true);

        let mut faith_a: WonderFaith = world.read_model(wonder_a);
        faith_a.season_id = season_id;
        faith_a.season_fp = 600;
        world.write_model_test(@faith_a);
        let mut faith_b: WonderFaith = world.read_model(wonder_b);
        faith_b.season_id = season_id;
        faith_b.season_fp = 500;
        world.write_model_test(@faith_b);

        set_block_timestamp(3000);
        let mut state: FaithSeasonState = world.read_model(season_id);
        state.season_id = season_id;
        state.season_end_tick = 3000;
        world.write_model_test(@state);

        let dispatcher = faith_dispatcher(world);
        dispatcher.fund_faith_prize_pool(season_id, 1000);
        dispatcher.distribute_faith_season_prizes(season_id, array![wonder_a, wonder_b].span());

        let state_after: FaithSeasonState = world.read_model(season_id);
        assert!(state_after.unallocated_prize == 800, "unused rank share should be tracked");
    }

    #[test]
    #[should_panic(expected: ("Season not ended", 'ENTRYPOINT_FAILED'))]
    fn test_distribute_season_prizes_before_end_fails() {
        let mut world = spawn_world();
        let season_id: u32 = 5;
        let owner = starknet::contract_address_const::<'not_ended_owner'>();

        set_tick_config(ref world, 1);
        set_faith_config(ref world, 5, 0);
        set_faith_prize_config(
            ref world,
            array![1000_u16, 0_u16, 0_u16, 0_u16, 0_u16, 0_u16, 0_u16, 0_u16, 0_u16, 0_u16].span(),
            3000,
            7000,
        );

        let wonder_id: ID = 31;
        write_structure(ref world, wonder_id, owner, StructureCategory::Realm, true);
        let mut faith: WonderFaith = world.read_model(wonder_id);
        faith.season_id = season_id;
        faith.season_fp = 100;
        world.write_model_test(@faith);

        set_block_timestamp(4000);
        let mut state: FaithSeasonState = world.read_model(season_id);
        state.season_id = season_id;
        state.season_end_tick = 5000;
        world.write_model_test(@state);

        let dispatcher = faith_dispatcher(world);
        dispatcher.fund_faith_prize_pool(season_id, 1000);
        dispatcher.distribute_faith_season_prizes(season_id, array![wonder_id].span());
    }

    #[test]
    #[should_panic(expected: ("Already claimed", 'ENTRYPOINT_FAILED'))]
    fn test_claim_prize_twice_fails() {
        let mut world = spawn_world();
        let season_id: u32 = 6;
        let wonder_id: ID = 41;
        let owner = starknet::contract_address_const::<'double_claim_owner'>();

        set_tick_config(ref world, 1);
        set_faith_config(ref world, 5, 0);
        write_structure(ref world, wonder_id, owner, StructureCategory::Realm, true);

        set_block_timestamp(5000);
        let dispatcher = faith_dispatcher(world);
        dispatcher.distribute_faith_prize(season_id, wonder_id, 1, 1000, 300, 700, owner);

        set_caller(owner);
        set_block_timestamp(5001);
        dispatcher.claim_faith_prize(season_id, wonder_id);
        dispatcher.claim_faith_prize(season_id, wonder_id);
    }

    #[test]
    fn test_allocate_holder_prizes_proportional() {
        let mut world = spawn_world();
        let season_id: u32 = 7;
        let wonder_id: ID = 51;
        let owner = starknet::contract_address_const::<'holder_owner'>();
        let other_holder = starknet::contract_address_const::<'holder_other'>();

        set_tick_config(ref world, 1);
        set_faith_config(ref world, 5, 0);
        write_structure(ref world, wonder_id, owner, StructureCategory::Realm, true);

        set_block_timestamp(6000);
        let dispatcher = faith_dispatcher(world);
        dispatcher.distribute_faith_prize(season_id, wonder_id, 1, 1000, 0, 1000, owner);

        let mut balance_owner: FollowerFaithBalance = world.read_model((wonder_id, season_id, owner));
        balance_owner.total_fp = 3;
        world.write_model_test(@balance_owner);

        let mut balance_other: FollowerFaithBalance = world.read_model((wonder_id, season_id, other_holder));
        balance_other.total_fp = 1;
        world.write_model_test(@balance_other);

        dispatcher.allocate_faith_holder_prizes(season_id, wonder_id, array![owner, other_holder].span());

        let snapshot: FaithSeasonSnapshot = world.read_model((season_id, wonder_id));
        assert!(snapshot.total_holder_fp == 4, "total holder FP should be recorded");

        let prize_owner: FaithPrizeBalance = world.read_model((season_id, wonder_id, owner));
        let prize_other: FaithPrizeBalance = world.read_model((season_id, wonder_id, other_holder));
        assert!(prize_owner.amount == 750, "owner should receive proportional holder share");
        assert!(prize_other.amount == 250, "other holder should receive proportional holder share");
    }
}
