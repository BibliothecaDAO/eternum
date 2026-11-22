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
        #[cfg(feature: "blitz")]
        fn extract_exploration_reward(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            explorer_id: u64,
            coord: Coord,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);
            let explorer = self.revealing_explorer(game_id, actor, explorer_id, context);
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
            let paid = self.pay_reveal(game_id, explorer_id, explorer, coord, reward, context);
            crate::logic::map::MapState::mark_reward_extracted(key);
            self
                .record_story(
                    game_id, actor, context.timestamp, paid, crate::ownership::Story::ExplorationReward(paid),
                );
            ()
        }
        #[cfg(not(feature: "blitz"))]
        fn extract_exploration_reward(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            explorer_id: u64,
            coord: Coord,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);
            let explorer = self.revealing_explorer(game_id, actor, explorer_id, context);
            let rules = context.rules.unbox();
            let key = tile_key(game_id, coord);
            let tile = crate::logic::map::tile(key).expect('unrevealed extraction tile');
            assert!(tile.data / BIOME_SCALE % BYTE_RANGE != 0, "tile must be revealed");
            let mut root = context.raw_root;
            let seed = crate::random::game_root(ref root, game_id);
            if tile.data / crate::map::REWARD_EXTRACTED_FLAG % 2 == 1 {
                return ();
            }
            let reward = crate::exploration_rewards::reveal_reward(
                explorer.troops,
                rules.troop_limit_config,
                crate::logic::expeditions::depth_rules_at(game_id, coord).reveal_percent,
                seed,
            );
            let oaths = crate::logic::progression::held_oaths(
                crate::troops::ExplorerKey { game_id, explorer_id }, context,
            );
            let reward = crate::resources::ResourceAmount {
                amount: crate::oaths::reveal_pay(oaths, reward.amount), ..reward,
            };
            let paid = self.pay_reveal(game_id, explorer_id, explorer, coord, reward, context);
            crate::logic::map::MapState::mark_reward_extracted(key);

            self
                .record_story(
                    game_id, actor, context.timestamp, paid, crate::ownership::Story::ExplorationReward(paid),
                );
            ()
        }
    }
    #[generate_trait]
    impl ExtractionInternal of ExtractionInternalTrait {
        /// The surface army standing on its own tile that a reveal pays.
        fn revealing_explorer(
            self: @ContractState,
            game_id: u32,
            actor: ContractAddress,
            explorer_id: u64,
            context: crate::commands::ExecutionContext,
        ) -> crate::troops::ExplorerTroops {
            crate::game::assert_playing(context.game.unbox(), context.timestamp);
            let explorer = crate::logic::troops::command_explorer(
                crate::troops::ExplorerKey { game_id, explorer_id }, Some(actor), context.timestamp, context,
            );
            assert!(!explorer.coord.alt, "extraction requires surface");
            assert!(explorer.troops.count != 0, "explorer is dead");
            let occupied = crate::logic::map::occupancy(tile_key(game_id, explorer.coord))
                .expect('missing army occupancy');
            assert!(occupied.entity_id == explorer_id, "explorer does not occupy tile");
            explorer
        }

        /// Grants a reveal's reward to the army or, under home rewards, to its realm.
        fn pay_reveal(
            ref self: ContractState,
            game_id: u32,
            explorer_id: u64,
            explorer: crate::troops::ExplorerTroops,
            coord: Coord,
            reward: crate::resources::ResourceAmount,
            context: crate::commands::ExecutionContext,
        ) -> crate::exploration_rewards::ExtractedReward {
            let receiver = crate::exploration_rewards::receiver(explorer_id, explorer.owner, reward.resource_type);
            crate::exploration_rewards::IExplorationGrantDispatcherTrait::grant_exploration_reward(
                crate::exploration_rewards::IExplorationGrantLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(game_id, crate::slots::RESOURCES),
                },
                crate::resources::ResourceKey { game_id, entity_id: receiver },
                reward.resource_type,
                reward.amount,
                context.timestamp,
                crate::commands::resource_context(context),
            );
            crate::exploration_rewards::ExtractedReward {
                explorer_id, receiver, coord, resource_type: reward.resource_type, amount: reward.amount,
            }
        }

        /// A reveal's payout story, told once for the army that revealed it.
        fn record_story(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            timestamp: u64,
            paid: crate::exploration_rewards::ExtractedReward,
            story: crate::ownership::Story,
        ) {
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 2,
                        game_id,
                        entity_id: Some(paid.explorer_id),
                        owner: Some(actor),
                        timestamp,
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story,
                    },
                );
        }
    }
}
