#[cfg(test)]
mod tests {
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use dojo::world::world;
    use dojo_cairo_test::{
        ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world,
    };

    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR};
    use crate::models::faith::{
        FaithLeaderboardEntry, WonderFaith, WonderRank, m_FaithLeaderboardEntry, m_WonderFaith, m_WonderRank,
    };
    use crate::systems::faith::contracts::faith_systems;
    use crate::systems::faith::contracts::{IFaithSystemsDispatcher, IFaithSystemsDispatcherTrait};

    fn namespace_def() -> NamespaceDef {
        NamespaceDef {
            namespace: DEFAULT_NS_STR(),
            resources: [
                TestResource::Model(m_WonderFaith::TEST_CLASS_HASH),
                TestResource::Model(m_FaithLeaderboardEntry::TEST_CLASS_HASH),
                TestResource::Model(m_WonderRank::TEST_CLASS_HASH),
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

    fn faith_dispatcher(world: WorldStorage) -> IFaithSystemsDispatcher {
        let (addr, _) = world.dns(@"faith_systems").unwrap();
        IFaithSystemsDispatcher { contract_address: addr }
    }

    #[test]
    fn test_leaderboard_updates_on_fp_generation() {
        let mut world = spawn_world();
        let season_id: u32 = 10;
        let wonder_a: ID = 1;
        let wonder_b: ID = 2;

        let mut faith_a: WonderFaith = world.read_model(wonder_a);
        faith_a.season_id = season_id;
        faith_a.season_fp = 200;
        world.write_model_test(@faith_a);

        let mut faith_b: WonderFaith = world.read_model(wonder_b);
        faith_b.season_id = season_id;
        faith_b.season_fp = 100;
        world.write_model_test(@faith_b);

        let dispatcher = faith_dispatcher(world);
        dispatcher.update_faith_leaderboard(season_id, array![wonder_a, wonder_b].span());

        let rank1: FaithLeaderboardEntry = world.read_model((1_u32, season_id));
        let rank2: FaithLeaderboardEntry = world.read_model((2_u32, season_id));
        assert!(rank1.wonder_id == wonder_a, "wonder A should be rank 1");
        assert!(rank2.wonder_id == wonder_b, "wonder B should be rank 2");
    }

    #[test]
    fn test_leaderboard_rank_change_event() {
        let mut world = spawn_world();
        let season_id: u32 = 11;
        let wonder_a: ID = 3;
        let wonder_b: ID = 4;

        let mut faith_a: WonderFaith = world.read_model(wonder_a);
        faith_a.season_id = season_id;
        faith_a.season_fp = 50;
        world.write_model_test(@faith_a);

        let mut faith_b: WonderFaith = world.read_model(wonder_b);
        faith_b.season_id = season_id;
        faith_b.season_fp = 100;
        world.write_model_test(@faith_b);

        let dispatcher = faith_dispatcher(world);
        dispatcher.update_faith_leaderboard(season_id, array![wonder_a, wonder_b].span());

        let rank_a: WonderRank = world.read_model((wonder_a, season_id));
        assert!(rank_a.current_rank == 2, "wonder A should start at rank 2");

        let mut faith_a2: WonderFaith = world.read_model(wonder_a);
        faith_a2.season_fp = 150;
        world.write_model_test(@faith_a2);

        dispatcher.update_faith_leaderboard(season_id, array![wonder_a, wonder_b].span());
        let rank_a2: WonderRank = world.read_model((wonder_a, season_id));
        assert!(rank_a2.current_rank == 1, "wonder A should move to rank 1");
    }

    #[test]
    fn test_leaderboard_tiebreaker() {
        let mut world = spawn_world();
        let season_id: u32 = 12;
        let wonder_a: ID = 5;
        let wonder_b: ID = 6;

        let mut faith_a: WonderFaith = world.read_model(wonder_a);
        faith_a.season_id = season_id;
        faith_a.season_fp = 100;
        world.write_model_test(@faith_a);

        let mut faith_b: WonderFaith = world.read_model(wonder_b);
        faith_b.season_id = season_id;
        faith_b.season_fp = 100;
        world.write_model_test(@faith_b);

        let dispatcher = faith_dispatcher(world);
        dispatcher.update_faith_leaderboard(season_id, array![wonder_a, wonder_b].span());

        let rank1: FaithLeaderboardEntry = world.read_model((1_u32, season_id));
        let rank2: FaithLeaderboardEntry = world.read_model((2_u32, season_id));
        assert!(rank1.wonder_id == wonder_a, "lower ID should win tiebreaker");
        assert!(rank2.wonder_id == wonder_b, "higher ID should be second");
    }
}
