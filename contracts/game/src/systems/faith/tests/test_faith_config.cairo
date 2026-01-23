#[cfg(test)]
mod tests {
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use dojo_snf_test::{ContractDef, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world};

    use crate::alias::ID;
    use crate::constants::DEFAULT_NS_STR;
    use crate::models::config::WorldConfigUtilImpl;
    use crate::models::faith::{
        DEFAULT_FAITH_CONFIG, FaithConfig, FaithConfigTrait, WonderFaith,
    };

    fn namespace_def() -> NamespaceDef {
        NamespaceDef {
            namespace: DEFAULT_NS_STR(),
            resources: [
                TestResource::Model("WorldConfig"),
                TestResource::Model("WonderFaith"),
            ]
                .span(),
        }
    }

    fn spawn_world() -> WorldStorage {
        let mut world = spawn_test_world([namespace_def()].span());
        let contract_defs: Span<ContractDef> = array![].span();
        world.sync_perms_and_inits(contract_defs);
        world
    }

    #[test]
    fn test_faith_config_storage() {
        let mut world = spawn_world();
        let mut config: FaithConfig = DEFAULT_FAITH_CONFIG();
        config.owner_share_bps = 2500;
        config.follower_share_bps = 7500;

        WorldConfigUtilImpl::set_member(ref world, selector!("faith_config"), config);

        let stored: FaithConfig = WorldConfigUtilImpl::get_member(world, selector!("faith_config"));
        assert!(stored.owner_share_bps == 2500, "owner share mismatch");
        assert!(stored.follower_share_bps == 7500, "follower share mismatch");
    }

    #[test]
    #[should_panic(expected: "Invalid faith share split")]
    fn test_faith_config_invalid_shares() {
        let mut config: FaithConfig = DEFAULT_FAITH_CONFIG();
        config.owner_share_bps = 2000;
        config.follower_share_bps = 7000;
        config.assert_valid();
    }

    #[test]
    fn test_wonder_faith_default_values() {
        let world = spawn_world();
        let wonder_id: ID = 42;
        let faith: WonderFaith = world.read_model(wonder_id);

        assert!(faith.realm_follower_count == 0, "realm follower count should default to 0");
        assert!(faith.village_follower_count == 0, "village follower count should default to 0");
        assert!(faith.wonder_follower_count == 0, "wonder follower count should default to 0");
        assert!(faith.realm_fp_index == 0, "realm index should default to 0");
        assert!(faith.village_fp_index == 0, "village index should default to 0");
        assert!(faith.wonder_fp_index == 0, "wonder index should default to 0");
        assert!(faith.total_fp_generated == 0, "total FP should default to 0");
        assert!(faith.current_owner_fp == 0, "owner FP should default to 0");
        assert!(faith.last_tick_processed == 0, "last tick should default to 0");
        assert!(faith.season_fp == 0, "season FP should default to 0");
    }
}
