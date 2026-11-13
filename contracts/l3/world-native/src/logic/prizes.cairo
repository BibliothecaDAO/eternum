#[starknet::contract]
pub mod PrizesLogic {
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
    use crate::events::RowSet;
    use crate::geometry::tile_key;
    use crate::logic::blitz_results::BlitzResultState;
    use crate::logic::lords::LordsState;
    use crate::logic::release::ReleaseState;
    use crate::map::{BIOME_SCALE, BYTE_RANGE};
    use crate::troops::Coord;

    component!(path: BlitzResultState, storage: blitz, event: BlitzEvent);
    #[abi(embed_v0)]
    impl BlitzResults = BlitzResultState::BlitzResultsImpl<ContractState>;
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;
    component!(path: LordsState, storage: relics, event: RelicEvent);
    #[abi(embed_v0)]
    impl Lords = LordsState::LordsImpl<ContractState>;
    impl LordsInternal = LordsState::InternalImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        relics: LordsState::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
        #[substorage(v0)]
        blitz: BlitzResultState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        RelicEvent: LordsState::Event,
        ReleaseEvent: ReleaseState::Event,
        BlitzEvent: BlitzResultState::Event,
        MapEvent: crate::logic::map::MapState::Event,
        StoryEvent: crate::ownership::StoryEvent,
        RowSet: RowSet,
    }
    #[abi(embed_v0)]
    impl Extraction of crate::exploration_rewards::IExtraction<ContractState> {
        fn extraction_rewards(
            self: @ContractState, game_id: u32,
        ) -> Span<crate::exploration_rewards::ExplorationReward> {
            let preset = crate::logic::preset_record::for_game(game_id);
            let count = preset.exploration_reward_count.read();
            let mut rewards = array![];
            for index in 0..count {
                rewards.append(preset.exploration_rewards.read(index));
            }
            rewards.span()
        }
        fn extract_exploration_reward(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            explorer_id: u64,
            revealed: Option<Coord>,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);
            let explorer = self.revealing_explorer(game_id, actor, explorer_id, context);
            let rules = context.rules.unbox();
            let coord = if crate::rules::rule_enabled(rules, crate::rules::REVEAL_SUPPLIES) {
                match revealed {
                    Some(coord) => coord,
                    None => { return (); },
                }
            } else {
                explorer.coord
            };
            let key = tile_key(game_id, coord);
            let tile = crate::logic::map::tile(key).expect('unrevealed extraction tile');
            assert!(tile.data / BIOME_SCALE % BYTE_RANGE != 0, "tile must be revealed");
            let mut root = context.raw_root;
            let seed = crate::random::game_root(ref root, game_id);
            if tile.data / crate::map::REWARD_EXTRACTED_FLAG % 2 == 1 {
                return ();
            }
            let reward = if crate::rules::rule_enabled(rules, crate::rules::REVEAL_SUPPLIES) {
                crate::exploration_rewards::reveal_reward(
                    explorer.troops,
                    rules.troop_limit_config,
                    crate::logic::expeditions::depth_rules_at(game_id, coord).reveal_percent,
                    seed,
                )
            } else {
                crate::exploration_rewards::pool_reward(
                    self.extraction_rewards(game_id),
                    explorer.troops,
                    rules.troop_limit_config,
                    context.timestamp,
                    seed,
                )
            };
            let paid = self.pay_reveal(game_id, explorer_id, explorer, coord, reward, context);
            crate::logic::map::MapState::mark_reward_extracted(key);
            if rules.day_unit_seconds != 0 {
                crate::progression::IArmyProgressionDispatcherTrait::grant_army_xp(
                    crate::progression::IArmyProgressionLibraryDispatcher {
                        class_hash: self.release.classes(game_id).relics.read(),
                    },
                    crate::troops::ExplorerKey { game_id, explorer_id },
                    crate::progression::XpAward::Reveal(coord),
                    context.timestamp,
                );
            }
            self
                .record_story(
                    game_id, actor, context.timestamp, paid, crate::ownership::Story::ExplorationReward(paid),
                );
            ()
        }
        fn raise_dormant_spire(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            explorer_id: u64,
            coord: Coord,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::execution_context(game_id, context);
            assert!(
                crate::rules::rule_enabled(context.rules.unbox(), crate::rules::DISCOVER_SPIRES),
                "spire discovery is disabled",
            );
            let explorer = self.revealing_explorer(game_id, actor, explorer_id, context);
            crate::logic::map::MapState::occupy(
                tile_key(game_id, coord),
                crate::entity_ids::allocate_home(game_id, explorer.owner),
                crate::taxonomy::DORMANT_SPIRE_OCCUPIER,
                false,
            );
            let reward = crate::exploration_rewards::spire_reward(explorer.troops.boosts, context.timestamp);
            let paid = self.pay_reveal(game_id, explorer_id, explorer, coord, reward, context);
            self.record_story(game_id, actor, context.timestamp, paid, crate::ownership::Story::SpireDiscovered(paid));
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
            let receiver = crate::exploration_rewards::receiver(
                crate::rules::rule_enabled(context.rules.unbox(), crate::rules::HOME_REWARDS),
                explorer_id,
                explorer.owner,
                reward.resource_type,
            );
            crate::exploration_rewards::IExplorationGrantDispatcherTrait::grant_exploration_reward(
                crate::exploration_rewards::IExplorationGrantLibraryDispatcher {
                    class_hash: self.release.classes(game_id).resources.read(),
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
