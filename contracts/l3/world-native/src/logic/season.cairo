#[starknet::interface]
pub trait IGameplay<T> {
    fn execute_gameplay(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        arguments: Span<felt252>,
        nonce: u64,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> Result<Span<felt252>, eternum_randomness_protocol::recording::Rejection>;
}

#[starknet::contract]
pub mod SeasonLogic {
    use eternum_randomness_protocol::recording::{Rejection, rejection, short_reason};
    use games_storage::release::LogicClasses;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
    use starknet::{ContractAddress, get_tx_info};
    use crate::commands::ExecutionContext as DomainContext;
    use crate::events::RowSet;
    use crate::logic::release::ReleaseState;
    use crate::ownership::StoryResultTrait;
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl ReleaseInternal = ReleaseState::InternalImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[flat]
        data: crate::state::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        RowSet: RowSet,
        PointsAwarded: crate::game::PointsAwarded,
        StoryEvent: crate::ownership::StoryEvent,
        ReleaseEvent: ReleaseState::Event,
        BatchProgress: crate::commands::BatchProgress,
    }
    #[abi(embed_v0)]
    impl SeasonLifecycle of crate::game::ISeasonLifecycle<ContractState> {
        fn configure_season_win(ref self: ContractState, game_id: u32, points: u128) {
            crate::logic::release::assert_authority();
            crate::logic::game::game(game_id);
            assert!(self.data.season.win_thresholds.read(game_id).is_none(), "season win threshold already configured");
            self.data.season.win_thresholds.write(game_id, Some(points));
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'SeasonWinThreshold',
                        keys: array![game_id.into()].span(),
                        values: array![points.into()].span(),
                    },
                );
        }
        fn season_win_threshold(self: @ContractState, game_id: u32) -> u128 {
            self.data.season.win_thresholds.read(game_id).expect('missing season win threshold')
        }
        fn close_season(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> (u64, crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

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
                story_cursor,
            )
                .resume_story(ref story_cursor);
            if remaining != 0 {
                return (remaining.into(), story_cursor);
            }
            self.data.season.close_initiators.write(game_id, None);
            if self.data.season.player_points.read((game_id, initiator)) < threshold {
                return (0, story_cursor);
            }
            game.end_at = context.timestamp;
            crate::logic::game::write_game(game_id, game);
            self.record_season_end(game_id, initiator, context.timestamp, ref story_cursor);
            (0, story_cursor)
        }
    }
    #[abi(embed_v0)]
    impl GameSettlement of crate::registrar::IGameSettlement<ContractState> {
        fn mark_game_settled(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> (u64, crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            assert!(actor == self.release.authority(), "only domain authority");

            let mut game = context.game.unbox();
            if game.settled {
                return (0, story_cursor);
            }
            assert!(
                crate::game::status_at(game, context.timestamp) == crate::game::GameStatus::Ended, "game has not ended",
            );
            assert!(
                game.end_grace_seconds == 0 || context.timestamp > game.end_at + game.end_grace_seconds.into(),
                "game settlement grace period is active",
            );
            let remaining = self.settle_final_points(game_id, context.timestamp, context, ref story_cursor);
            if remaining != 0 {
                return (remaining.into(), story_cursor);
            }
            game.settled = true;
            crate::logic::game::write_game(game_id, game);
            (0, story_cursor)
        }
    }
    #[abi(embed_v0)]
    impl Points of crate::game::IPoints<ContractState> {
        fn register_relic_points(
            ref self: ContractState, game_id: u32, actor: ContractAddress, game_context: crate::commands::ActionContext,
        ) {
            let game_context = crate::commands::load_context(game_id, game_context);

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
            let game_context = crate::commands::load_context(game_id, game_context);

            let rules = game_context.rules.unbox().victory_points_grant_config;
            let amount = if category == 2 {
                rules.claim_hyperstructure_points
            } else {
                rules.claim_otherstructure_points
            };
            self
                .register_points(
                    game_id,
                    actor,
                    amount.into(),
                    if category == 2 {
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
            let game_context = crate::commands::load_context(game_id, game_context);

            let amount = game_context.rules.unbox().victory_points_grant_config.explore_tiles_points;
            self.register_points(game_id, actor, amount.into(), crate::game::PointActivity::Exploration);
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        fn settle_final_points(
            ref self: ContractState,
            game_id: u32,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
            ref story_cursor: crate::ownership::StoryCursor,
        ) -> u32 {
            crate::hyperstructures::IHyperstructuresDispatcherTrait::settle_final_hyperstructures(
                crate::hyperstructures::IHyperstructuresLibraryDispatcher {
                    class_hash: self.release.classes(game_id).economy.read(),
                },
                game_id,
                timestamp,
                crate::commands::action_context(game_context),
                story_cursor,
            )
                .resume_story(ref story_cursor)
        }
        fn record_season_end(
            ref self: ContractState,
            game_id: u32,
            winner: ContractAddress,
            timestamp: u64,
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 1,
                        game_id,
                        order: story_cursor.order,
                        index: crate::ownership::StoryCursorTrait::next(ref story_cursor),
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
            self.emit(crate::game::PointsAwarded { version: 1, game_id, player: actor, activity, points: amount });
            let points = self.data.season.player_points.read((game_id, actor)) + amount;
            let total = self.data.season.season_points.read(game_id) + amount;
            self.data.season.player_points.write((game_id, actor), points);
            self.data.season.season_points.write(game_id, total);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'PlayerPoints',
                        keys: array![game_id.into(), actor.into()].span(),
                        values: array![points.into()].span(),
                    },
                );
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'PointsTotal',
                        keys: array![game_id.into()].span(),
                        values: array![total.into()].span(),
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
        story_cursor: crate::ownership::StoryCursor,
    ) -> Result<Span<felt252>, Array<felt252>> {
        let mut calldata = array![game_id.into(), actor.into()];
        calldata.append_span(arguments);
        crate::commands::action_context(context).serialize(ref calldata);
        story_cursor.serialize(ref calldata);
        starknet::syscalls::library_call_syscall(
            crate::command_routes::logic_class(classes, route.logic), route.selector, calldata.span(),
        )
    }

    // Cairo assertions encode strings as ByteArray; expect/panic_with_felt252 use one short string.
    // The syscall appends ENTRYPOINT_FAILED after the original panic data.
    fn domain_rejection(error: Array<felt252>) -> Rejection {
        let mut fields = error.span();
        let reason = match fields.pop_front() {
            Some(word) => {
                if *word == core::byte_array::BYTE_ARRAY_MAGIC {
                    Serde::<ByteArray>::deserialize(ref fields).expect('malformed domain reason')
                } else {
                    short_reason(*word)
                }
            },
            None => "empty domain panic",
        };
        Rejection { status_class: 'GAMEPLAY_REJECTED', reason }
    }

    #[abi(embed_v0)]
    impl Gameplay of super::IGameplay<ContractState> {
        fn execute_gameplay(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            arguments: Span<felt252>,
            nonce: u64,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> Result<Span<felt252>, eternum_randomness_protocol::recording::Rejection> {
            let context = crate::commands::load_context(game_id, context);

            let (index, route, payload) = crate::commands::route_command(arguments).map_err(|code| rejection(code))?;
            let rules = context.rules.unbox();
            if !crate::rules::command_enabled(rules.command_mask, index.into()) {
                return Err(rejection('COMMAND_DISABLED'));
            }
            if !context.game.unbox().ready && index != crate::command_routes::SETTLE_BLITZ_ROSTER {
                return Err(rejection('ROSTER_NOT_READY'));
            }
            let result = dispatch(self.release.classes(game_id), route, game_id, actor, payload, context, story_cursor)
                .map_err(|error| domain_rejection(error))?;
            if route.batch {
                let mut output = result;
                let (remaining, _cursor): (u64, crate::ownership::StoryCursor) = Serde::deserialize(ref output)
                    .expect('missing batch result');
                assert!(output.is_empty(), "invalid batch result");
                self.emit(crate::commands::BatchProgress { game_id, actor, nonce, remaining });
            }
            Ok(result)
        }
    }
}
