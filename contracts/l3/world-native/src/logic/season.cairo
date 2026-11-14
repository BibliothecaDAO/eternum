#[starknet::interface]
pub trait IGameplay<T> {
    fn execute_gameplay(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        arguments: Span<felt252>,
        raw_root: u256,
        timestamp: u64,
    ) -> Result<Span<felt252>, crate::commands::Rejection>;
}

#[starknet::contract]
pub mod SeasonLogic {
    const MAX_PHASES_PER_CLAIM: u32 = 8;
    use games_storage::release::LogicClasses;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
    use starknet::{ContractAddress, get_tx_info};
    use crate::commands::{ExecutionContext as DomainContext, domain_rejection, rejection};
    use crate::game::assert_playing;
    use crate::logic::release::ReleaseState;
    use crate::logic::village::VillageState;
    use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};
    use crate::settlement::{
        ISettlementCreationDispatcherTrait, ISettlementCreationLibraryDispatcher, ISettlementPoolDispatcherTrait,
        ISettlementPoolLibraryDispatcher, SettlementCreation, VillageCreation,
    };
    use crate::village::{SettleVillage, VillagePassKey};

    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl ReleaseInternal = ReleaseState::InternalImpl<ContractState>;
    component!(path: VillageState, storage: villages, event: VillageEvent);
    impl VillageInternal = VillageState::InternalImpl<ContractState>;
    component!(path: crate::logic::bitcoin::BitcoinState, storage: bitcoin, event: BitcoinEvent);
    impl BitcoinInternal = crate::logic::bitcoin::BitcoinState::InternalImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        bitcoin: crate::logic::bitcoin::BitcoinState::Storage,
        #[substorage(v0)]
        villages: VillageState::Storage,
        #[flat]
        data: crate::state::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        BitcoinEvent: crate::logic::bitcoin::BitcoinState::Event,
        VillageEvent: VillageState::Event,
        RowSet: crate::events::RowSet,
        PointsAwarded: crate::game::PointsAwarded,
        StoryEvent: crate::ownership::StoryEvent,
        ReleaseEvent: ReleaseState::Event,
        BatchProgress: crate::commands::BatchProgress,
    }

    #[abi(embed_v0)]
    impl SeasonLifecycle of crate::game::ISeasonLifecycle<ContractState> {
        fn season_win_threshold(self: @ContractState, game_id: u32) -> u128 {
            crate::logic::preset_record::for_game(game_id).season_win_points.read()
        }
        fn close_season(
            ref self: ContractState, game_id: u32, actor: ContractAddress, context: crate::commands::ActionContext,
        ) -> u64 {
            let context = crate::commands::execution_context(game_id, context);

            let classes = self.release.classes(game_id);

            let mut game = context.game.unbox();
            crate::game::assert_playing(game, context.timestamp);
            assert!(
                crate::rules::rule_enabled(context.rules.unbox(), crate::rules::SEASON_CLOSE),
                "season closure is disabled",
            );
            let threshold = self.season_win_threshold(game_id);
            assert!(threshold != 0, "season win threshold is zero");
            let initiator = match self.data.season.close_initiators.read(game_id) {
                Some(initiator) => initiator,
                None => {
                    self.data.season.close_initiators.write(game_id, Some(actor));
                    actor
                },
            };
            let remaining = crate::hyperstructures::IHyperstructuresDispatcherTrait::settle_completed_hyperstructures(
                crate::hyperstructures::IHyperstructuresLibraryDispatcher { class_hash: classes.economy.read() },
                game_id,
                context.timestamp,
                crate::commands::action_context(context),
            );
            if remaining != 0 {
                return (remaining.into());
            }
            self.data.season.close_initiators.write(game_id, None);
            if self.data.season.player_points.read((game_id, initiator)) < threshold {
                return (0);
            }
            game.end_at = context.timestamp;
            crate::logic::game::write_game(game_id, game);
            self.record_season_end(game_id, initiator, context.timestamp);
            (0)
        }
    }
    #[abi(embed_v0)]
    impl GameSettlement of crate::registrar::IGameSettlement<ContractState> {
        fn mark_game_settled(
            ref self: ContractState, game_id: u32, actor: ContractAddress, context: crate::commands::ActionContext,
        ) -> u64 {
            let context = crate::commands::execution_context(game_id, context);
            let mut game = context.game.unbox();
            if game.settled {
                return (0);
            }
            assert!(
                crate::game::status_at(game, context.timestamp) == crate::game::GameStatus::Ended, "game has not ended",
            );
            assert!(
                game.end_grace_seconds == 0 || context.timestamp > game.end_at + game.end_grace_seconds.into(),
                "game settlement grace period is active",
            );
            let remaining = self.settle_final_points(game_id, context.timestamp, context);
            if remaining != 0 {
                return (remaining.into());
            }
            game.settled = true;
            crate::logic::game::write_game(game_id, game);
            (0)
        }
    }
    #[abi(embed_v0)]
    impl Points of crate::game::IPoints<ContractState> {
        fn register_relic_points(
            ref self: ContractState, game_id: u32, actor: ContractAddress, game_context: crate::commands::ActionContext,
        ) {
            let game_context = crate::commands::execution_context(game_id, game_context);

            let points = game_context.rules.unbox().victory_points_grant_config.relic_open_points;
            self.register_points(game_id, actor, points.into(), crate::game::PointActivity::RelicChest);
        }
        fn register_hyperstructure_points(ref self: ContractState, game_id: u32, actor: ContractAddress, amount: u128) {
            self.register_points(game_id, actor, amount, crate::game::PointActivity::Hyperstructure);
        }
        fn player_points(self: @ContractState, game_id: u32, actor: ContractAddress) -> u128 {
            self.data.season.player_points.read((game_id, actor))
        }
        fn season_points(self: @ContractState, game_id: u32) -> u128 {
            self.data.season.season_points.read(game_id)
        }
        fn register_capture(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            category: u8,
            game_context: crate::commands::ActionContext,
        ) -> u128 {
            let game_context = crate::commands::execution_context(game_id, game_context);

            let rules = game_context.rules.unbox().victory_points_grant_config;
            let amount = if category == crate::taxonomy::HYPERSTRUCTURE_CATEGORY {
                rules.claim_hyperstructure_points
            } else {
                rules.claim_otherstructure_points
            };
            self
                .register_points(
                    game_id,
                    actor,
                    amount.into(),
                    if category == crate::taxonomy::HYPERSTRUCTURE_CATEGORY {
                        crate::game::PointActivity::HyperstructureCapture
                    } else {
                        crate::game::PointActivity::StructureCapture
                    },
                );
            amount.into()
        }
        fn register_exploration(
            ref self: ContractState, game_id: u32, actor: ContractAddress, game_context: crate::commands::ActionContext,
        ) {
            let game_context = crate::commands::execution_context(game_id, game_context);

            let amount = game_context.rules.unbox().victory_points_grant_config.explore_tiles_points;
            self.register_points(game_id, actor, amount.into(), crate::game::PointActivity::Exploration);
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        fn settle_final_points(
            ref self: ContractState, game_id: u32, timestamp: u64, game_context: crate::commands::ExecutionContext,
        ) -> u32 {
            crate::hyperstructures::IHyperstructuresDispatcherTrait::settle_final_hyperstructures(
                crate::hyperstructures::IHyperstructuresLibraryDispatcher {
                    class_hash: self.release.classes(game_id).economy.read(),
                },
                game_id,
                timestamp,
                crate::commands::action_context(game_context),
            )
        }
        fn record_season_end(ref self: ContractState, game_id: u32, winner: ContractAddress, timestamp: u64) {
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 2,
                        game_id,
                        entity_id: None,
                        owner: Some(winner),
                        timestamp,
                        tx_hash: get_tx_info().unbox().transaction_hash,
                        story: crate::ownership::Story::SeasonEnded(winner),
                    },
                );
        }
        fn register_points(
            ref self: ContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            amount: u128,
            activity: crate::game::PointActivity,
        ) {
            if amount == 0 {
                return;
            }
            let points = self.data.season.player_points.read((game_id, actor)) + amount;
            let total = self.data.season.season_points.read(game_id) + amount;
            self.data.season.player_points.write((game_id, actor), points);
            self.data.season.season_points.write(game_id, total);
            self
                .emit(
                    crate::game::PointsAwarded {
                        version: 1,
                        game_id,
                        player: actor,
                        activity,
                        points: amount,
                        player_points: points,
                        season_points: total,
                    },
                );
        }
    }

    fn dispatch(
        classes: starknet::storage::StoragePointer<LogicClasses>,
        route: crate::command_routes::CommandRoute,
        game_id: u32,
        actor: ContractAddress,
        arguments: Span<felt252>,
        context: DomainContext,
    ) -> Result<Span<felt252>, Array<felt252>> {
        let mut calldata = array![game_id.into(), actor.into()];
        calldata.append_span(arguments);
        crate::commands::action_context(context).serialize(ref calldata);
        starknet::syscalls::library_call_syscall(
            crate::command_routes::logic_class(classes, route.logic), route.selector, calldata.span(),
        )
    }

    #[abi(embed_v0)]
    impl Gameplay of super::IGameplay<ContractState> {
        fn execute_gameplay(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            arguments: Span<felt252>,
            raw_root: u256,
            timestamp: u64,
        ) -> Result<Span<felt252>, crate::commands::Rejection> {
            // The one read of the game and its rules in a play; every library call below receives them.
            let context = crate::commands::load_context(game_id, raw_root, timestamp);

            let (index, route, payload) = crate::commands::route_command(arguments).map_err(|code| rejection(code))?;
            let rules = context.rules.unbox();
            if !crate::rules::command_enabled(rules.command_mask, index.into()) {
                return Err(rejection('COMMAND_DISABLED'));
            }
            if !context.game.unbox().ready && index != crate::command_routes::SETTLE_BLITZ_ROSTER {
                return Err(rejection('ROSTER_NOT_READY'));
            }
            if crate::logic::preset_record::for_game(game_id).bane_rules.read().is_some() {
                crate::banes::IWorldBanesDispatcherTrait::prepare_bane_day(
                    crate::banes::IWorldBanesLibraryDispatcher { class_hash: self.release.classes(game_id).bridge.read() },
                    game_id, crate::commands::action_context(context),
                );
            }
            let result = dispatch(self.release.classes(game_id), route, game_id, actor, payload, context)
                .map_err(|error| domain_rejection(error))?;
            if route.batch {
                let mut output = result;
                let remaining: u64 = Serde::deserialize(ref output).expect('missing batch result');
                assert!(output.is_empty(), "invalid batch result");
                self
                    .emit(
                        crate::commands::BatchProgress {
                            game_id, actor, tx_hash: get_tx_info().unbox().transaction_hash, remaining,
                        },
                    );
            }
            Ok(result)
        }
    }
    #[abi(embed_v0)]
    impl Villages of crate::village::IVillages<ContractState> {
        fn settle_village(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: SettleVillage,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);

            let classes = self.release.classes(game_id);
            let owner = actor;
            let game = context.game.unbox();
            let rules = context.rules.unbox();
            assert!(game.dev_mode_on || context.timestamp >= game.start_settling_at, "settling not started");
            assert!(game.end_at == 0 || context.timestamp < game.end_at, "game ended");
            let dev_entry = game.dev_mode_on && crate::rules::rule_enabled(rules, crate::rules::DEV_VILLAGE_ENTRY);
            let pass = VillagePassKey { game_id, pass_id: command.pass_id };
            if !dev_entry {
                self.villages.require_pass(pass, owner);
            }
            let mut raw_root = context.raw_root;
            let seed = crate::random::game_root(ref raw_root, game_id);
            let village_rules = self.villages.rules(game_id);
            let resource = crate::village::select_resource(village_rules.resource_pool, seed);
            let progress = self.data.settlements.progress.read(game_id);
            let coord = ISettlementPoolLibraryDispatcher { class_hash: classes.placement.read() }
                .claim_village(
                    game_id,
                    progress.registered,
                    seed,
                    crate::settlement_grid::map_center(context.rules.unbox().map_center_offset),
                );
            let village_id = ISettlementCreationLibraryDispatcher { class_hash: classes.structures.read() }
                .create_settlement(
                    game_id,
                    actor,
                    coord,
                    SettlementCreation::Village(
                        VillageCreation { connected_realm: command.connected_realm_entity_id, resource },
                    ),
                    crate::commands::action_context(context),
                );
            if !dev_entry {
                self.villages.consume(pass, owner, village_id);
            }
            ()
        }
    }
    #[abi(embed_v0)]
    impl BitcoinViews of crate::bitcoin::IBitcoinViews<ContractState> {
        #[cfg(feature: "test_support")]
        fn bitcoin_mine(self: @ContractState, key: ResourceKey) -> crate::bitcoin::MineFunding {
            self.bitcoin.mine(key)
        }
        #[cfg(feature: "test_support")]
        fn bitcoin_claimed(self: @ContractState, key: crate::bitcoin::ClaimKey) -> bool {
            self.bitcoin.was_claimed(key)
        }
        #[cfg(feature: "test_support")]
        fn bitcoin_phase(self: @ContractState, key: crate::bitcoin::PhaseKey) -> crate::bitcoin::Phase {
            self.bitcoin.phase(key)
        }
        #[cfg(feature: "test_support")]
        fn bitcoin_contribution(
            self: @ContractState, key: crate::bitcoin::ContributionKey,
        ) -> crate::bitcoin::Contribution {
            self.bitcoin.contribution(key)
        }
        #[cfg(feature: "test_support")]
        fn bitcoin_contributor(self: @ContractState, key: crate::bitcoin::PhaseKey, index: u32) -> ContractAddress {
            self.bitcoin.contributor(key, index)
        }
    }
    #[abi(embed_v0)]
    impl BitcoinFunding of crate::bitcoin::IBitcoinFunding<ContractState> {
        fn register_bitcoin_structure(
            ref self: ContractState,
            key: ResourceKey,
            category: u8,
            timestamp: u64,
            game_context: crate::commands::ActionContext,
        ) {
            let game_context = crate::commands::execution_context(key.game_id, game_context);

            assert!(category == crate::taxonomy::BITCOIN_MINE_CATEGORY, "not a Bitcoin mine");
            let interval = game_context.rules.unbox().tick_config.bitcoin_phase_in_seconds;
            assert!(interval != 0, "zero Bitcoin phase duration");
            self.bitcoin.register_mine(key, timestamp / interval + 1);
        }
        fn bitcoin_mine_captured(
            ref self: ContractState, key: ResourceKey, timestamp: u64, game_context: crate::commands::ActionContext,
        ) {
            let game_context = crate::commands::execution_context(key.game_id, game_context);

            let rules = game_context.rules.unbox();
            let mine = crate::logic::structures::structure(key).expect('missing Bitcoin mine');
            let prize = if mine.owner == 0.try_into().unwrap() {
                0
            } else {
                rules.bitcoin_mine_config.prize_per_phase
            };
            let interval = rules.tick_config.bitcoin_phase_in_seconds;
            let phase = timestamp / interval;
            let closed_before = if timestamp % interval == interval - 1 {
                phase + 1
            } else {
                phase
            };
            self.bitcoin.capture_mine(key, phase + 1, closed_before, prize);
        }
    }
    #[abi(embed_v0)]
    impl BitcoinCommands of crate::bitcoin::IBitcoinCommands<ContractState> {
        fn claim_bitcoin_phase(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::bitcoin::ClaimPhase,
            context: crate::commands::ActionContext,
        ) -> u64 {
            let context = crate::commands::execution_context(game_id, context);

            self.assert_bitcoin_phase_closed(game_id, command.phase, context.timestamp, context);
            assert!(!command.mine_ids.is_empty(), "empty Bitcoin claim batch");
            assert!(command.mine_ids.len() <= crate::commands::MAX_COMMAND_ITEMS, "too many Bitcoin mines");
            crate::commands::assert_unique_entity_ids(command.mine_ids);
            let limit = core::cmp::min(
                MAX_PHASES_PER_CLAIM, crate::commands::MAX_COMMAND_ITEMS / command.mine_ids.len(),
            );
            let mut remaining = 0;
            for mine_id in command.mine_ids {
                remaining += self
                    .claim_bound_phases(
                        ResourceKey { game_id, entity_id: *mine_id }, command.phase, limit, context.timestamp, context,
                    );
            }
            (remaining)
        }

        fn contribute_bitcoin_labor(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::bitcoin::ContributeLabor,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::execution_context(game_id, context);

            self.assert_bitcoin_command(game_id, context.timestamp, context);
            let game = context.game.unbox();
            assert_playing(game, context.timestamp);
            let rules = context.rules.unbox();
            let phase = context.timestamp / rules.tick_config.bitcoin_phase_in_seconds;
            let end = self.bitcoin_phase_end_in_game(phase, context);
            assert!(context.timestamp < end, "Bitcoin contribution window is closed");
            assert!(
                command.amount != 0 && command.amount >= rules.bitcoin_mine_config.min_labor_per_contribution,
                "Bitcoin labor below minimum",
            );
            let key = ResourceKey { game_id, entity_id: command.structure_id };
            assert!(crate::logic::structures::owner(key) == actor, "actor does not own labor source");
            self
                .resources(game_id)
                .spend_resource(key, 23, command.amount, context.timestamp, crate::commands::resource_context(context));
            self
                .bitcoin
                .contribute(
                    crate::bitcoin::ContributionKey { game_id, phase, player: actor },
                    command.structure_id,
                    command.amount,
                );
        }
        fn close_bitcoin_phase(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            phase: u64,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::execution_context(game_id, context);

            self.assert_bitcoin_phase_closed(game_id, phase, context.timestamp, context);
            self.bitcoin.close(crate::bitcoin::PhaseKey { game_id, phase });
        }
        fn bind_bitcoin_phase(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            phase: u64,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::execution_context(game_id, context);

            self.assert_bitcoin_phase_closed(game_id, phase, context.timestamp, context);
            self.bitcoin.bind(crate::bitcoin::PhaseKey { game_id, phase }, context.raw_root);
        }
    }
    #[generate_trait]
    impl BitcoinHelpers of BitcoinHelpersTrait {
        fn resources(self: @ContractState, game_id: u32) -> IResourceOperationsLibraryDispatcher {
            IResourceOperationsLibraryDispatcher { class_hash: self.release.classes(game_id).resources.read() }
        }
        fn claim_bound_phases(
            ref self: ContractState,
            mine: ResourceKey,
            through: u64,
            limit: u32,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) -> u64 {
            let mut phase_id = self.bitcoin.mine(mine).next_phase;
            for _ in 0..limit {
                if phase_id > through {
                    break;
                }
                let phase = self.bitcoin.phase(crate::bitcoin::PhaseKey { game_id: mine.game_id, phase: phase_id });
                if phase.state == crate::bitcoin::PhaseStatus::Open
                    || (phase.total_labor != 0 && phase.state != crate::bitcoin::PhaseStatus::Bound) {
                    break;
                }
                self
                    .claim_bitcoin_mine(
                        crate::bitcoin::ClaimKey { game_id: mine.game_id, phase: phase_id, mine_id: mine.entity_id },
                        phase,
                        timestamp,
                        game_context,
                    );
                phase_id += 1;
            }
            if phase_id > through {
                0
            } else {
                through - phase_id + 1
            }
        }
        fn claim_bitcoin_mine(
            ref self: ContractState,
            key: crate::bitcoin::ClaimKey,
            phase: crate::bitcoin::Phase,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            if self.bitcoin.was_claimed(key) {
                return;
            }
            let resource_key = ResourceKey { game_id: key.game_id, entity_id: key.mine_id };
            let mut funding = self.bitcoin.mine(resource_key);
            assert!(funding.next_phase == key.phase, "claim earlier Bitcoin phase first");
            let mine = crate::logic::structures::structure(resource_key).expect('missing Bitcoin mine');
            assert!(mine.base.category == crate::taxonomy::BITCOIN_MINE_CATEGORY, "not a Bitcoin mine");
            if mine.owner != 0.try_into().unwrap() && key.phase >= funding.eligible_from {
                let config = game_context.rules.unbox().bitcoin_mine_config;
                if phase.total_labor == 0 {
                    funding.unsplit_carry += config.prize_per_phase;
                } else {
                    let winner = self.bitcoin.winner(key);
                    let (winner_share, owner_share) = crate::bitcoin::split_prize(
                        config.prize_per_phase + funding.unsplit_carry, config.owner_cut_bps,
                    );
                    let winner_share = winner_share + funding.winner_carry;
                    let (winner_destination, winner_paid) = self
                        .pay_bitcoin_winner(key, winner, winner_share, timestamp, game_context);
                    let owner_destination = key.mine_id;
                    let owner_paid = self.pay_bitcoin_share(resource_key, owner_share, timestamp, game_context);
                    funding.unsplit_carry = 0;
                    funding.winner_carry = winner_share - winner_paid;
                    self
                        .emit_bitcoin_award(
                            key.game_id,
                            timestamp,
                            crate::bitcoin::BitcoinAwardStory {
                                phase: key.phase,
                                mine_id: key.mine_id,
                                winner,
                                owner: mine.owner,
                                winner_destination,
                                owner_destination,
                                winner_paid,
                                owner_paid,
                            },
                        );
                }
            }
            self.bitcoin.complete_claim(key, funding);
        }
        fn pay_bitcoin_winner(
            ref self: ContractState,
            key: crate::bitcoin::ClaimKey,
            winner: ContractAddress,
            amount: u128,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) -> (u64, u128) {
            let contribution = self
                .bitcoin
                .contribution(
                    crate::bitcoin::ContributionKey { game_id: key.game_id, phase: key.phase, player: winner },
                );
            let destination = ResourceKey { game_id: key.game_id, entity_id: contribution.structure_id };
            if crate::logic::structures::owner(destination) != winner || amount == 0 {
                return (0, 0);
            }
            (destination.entity_id, self.pay_bitcoin_share(destination, amount, timestamp, game_context))
        }
        fn emit_bitcoin_award(
            ref self: ContractState, game_id: u32, timestamp: u64, award: crate::bitcoin::BitcoinAwardStory,
        ) {
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 2,
                        game_id,
                        owner: Some(award.winner),
                        entity_id: Some(award.mine_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        timestamp,
                        story: crate::ownership::Story::BitcoinAwardStory(award),
                    },
                );
        }
        fn pay_bitcoin_share(
            ref self: ContractState,
            destination: ResourceKey,
            amount: u128,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) -> u128 {
            if amount == 0 {
                return 0;
            }
            let rule = crate::logic::resources::rule(destination.game_id, 58);
            assert!(rule.unit_weight == 0, "SAT must be weightless");
            let paid = self
                .resources(destination.game_id)
                .grant_resource(destination, 58, amount, timestamp, crate::commands::resource_context(game_context));
            assert!(paid == amount, "incomplete Bitcoin award");
            paid
        }
        fn assert_bitcoin_command(
            self: @ContractState, game_id: u32, timestamp: u64, game_context: crate::commands::ExecutionContext,
        ) {
            assert!(game_context.rules.unbox().bitcoin_mine_config.enabled, "Bitcoin mining disabled");
        }
        fn bitcoin_phase_end_in_game(
            self: @ContractState, phase: u64, game_context: crate::commands::ExecutionContext,
        ) -> u64 {
            let interval = game_context.rules.unbox().tick_config.bitcoin_phase_in_seconds;
            let end = crate::bitcoin::phase_end(phase, interval);
            let game = game_context.game.unbox();
            // A phase that started before season closure keeps its original settlement window.
            assert!(
                end >= game.start_main_at && (game.end_at == 0 || phase * interval < game.end_at),
                "Bitcoin phase outside game",
            );
            end
        }
        fn assert_bitcoin_phase_closed(
            self: @ContractState,
            game_id: u32,
            phase: u64,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            self.assert_bitcoin_command(game_id, timestamp, game_context);
            let end = self.bitcoin_phase_end_in_game(phase, game_context);
            assert!(timestamp >= end, "Bitcoin phase is still open");
        }
    }
}
