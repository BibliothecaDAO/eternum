#[starknet::contract]
pub mod PrizesLogic {
    use starknet::ContractAddress;
    use crate::events::RowSet;
    use crate::geometry::tile_key;
    use crate::logic::lords::LordsState;
    use crate::logic::race::RaceState;
    use crate::logic::release::ReleaseState;
    use crate::map::{BIOME_SCALE, BYTE_RANGE};
    use crate::troops::Coord;

    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;
    component!(path: LordsState, storage: relics, event: RelicEvent);
    #[abi(embed_v0)]
    impl Lords = LordsState::LordsImpl<ContractState>;
    impl LordsInternal = LordsState::InternalImpl<ContractState>;
    component!(path: RaceState, storage: race, event: RaceEvent);
    #[abi(embed_v0)]
    impl DeepTicks = RaceState::DeepTicksImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        relics: LordsState::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
        #[substorage(v0)]
        race: RaceState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        RelicEvent: LordsState::Event,
        ReleaseEvent: ReleaseState::Event,
        RaceEvent: RaceState::Event,
        MapEvent: crate::logic::map::MapState::Event,
        StoryEvent: crate::ownership::StoryEvent,
        RowSet: RowSet,
    }
    #[abi(embed_v0)]
    impl Extraction of crate::exploration_rewards::IExtraction<ContractState> {
        fn extract_exploration_reward(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            explorer_id: u64,
            coord: Coord,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);
            let explorer = crate::logic::extraction::revealing_explorer(game_id, actor, explorer_id, context);
            if explorer.coord != coord {
                return ();
            }
            let key = tile_key(game_id, coord);
            let tile = crate::logic::map::tile(key).expect('unrevealed extraction tile');
            assert!(tile.data / BIOME_SCALE % BYTE_RANGE != 0, "tile must be revealed");
            let mut root = context.raw_root;
            let seed = crate::random::game_root(ref root, game_id);
            if tile.data / crate::map::REWARD_EXTRACTED_FLAG % 2 == 1 {
                return ();
            }
            let reward = crate::exploration_rewards::pool_reward(
                crate::balance::exploration::EXPLORATION_REWARDS.span(),
                explorer.troops,
                context.rules.unbox().troop_limit_config,
                context.timestamp,
                seed,
            );
            let paid = crate::logic::extraction::pay_reveal(game_id, explorer_id, explorer, coord, reward, context);
            crate::logic::map::MapState::mark_reward_extracted(key);
            crate::logic::extraction::record_story(game_id, actor, context.timestamp, paid);
            ()
        }
    }
}
