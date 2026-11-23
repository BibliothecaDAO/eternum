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
    use starknet::{ContractAddress, get_tx_info};
    use crate::commands::{ExecutionContext as DomainContext, domain_rejection, rejection};
    use crate::logic::release::ReleaseState;
    use crate::logic::village::VillageState;
    use crate::settlement::{
        ISettlementCreationDispatcherTrait, ISettlementCreationLibraryDispatcher, ISettlementPoolDispatcherTrait,
        ISettlementPoolLibraryDispatcher, SettlementCreation, VillageCreation,
    };
    use crate::village::{SettleVillage, VillagePassKey};

    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl ReleaseInternal = ReleaseState::InternalImpl<ContractState>;
    component!(path: VillageState, storage: villages, event: VillageEvent);
    impl VillageInternal = VillageState::InternalImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
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
        VillageEvent: VillageState::Event,
        RowSet: crate::events::RowSet,
        StoryEvent: crate::ownership::StoryEvent,
        ReleaseEvent: ReleaseState::Event,
        BatchProgress: crate::commands::BatchProgress,
    }

    #[cfg(feature: "blitz")]
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
            let remaining = crate::logic::blitz::hyperstructures::pay_final_holders(game_id, game.end_at);
            if remaining != 0 {
                return (remaining.into());
            }
            game.settled = true;
            crate::logic::game::write_game(game_id, game);
            (0)
        }
    }

    #[cfg(not(feature: "blitz"))]
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
            game.settled = true;
            crate::logic::game::write_game(game_id, game);
            (0)
        }
    }
    fn dispatch(
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
            crate::logic::release::class_of(game_id, route.logic), route.selector, calldata.span(),
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
            let mut context = crate::commands::load_context(game_id, raw_root, timestamp);

            let (index, route, payload) = crate::commands::route_command(arguments).map_err(|code| rejection(code))?;
            if !crate::rules::command_enabled(crate::balance::rules::SWITCHES.command_mask, index.into()) {
                return Err(rejection('COMMAND_DISABLED'));
            }
            crate::banes::IWorldBanesDispatcherTrait::prepare_bane_day(
                crate::banes::IWorldBanesLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(game_id, crate::slots::BRIDGE),
                },
                game_id,
                crate::commands::action_context(context),
            );
            crate::deep::IDeepTicksDispatcherTrait::settle_deep(
                crate::deep::IDeepTicksLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(game_id, crate::slots::PRIZES),
                },
                game_id,
                crate::commands::action_context(context),
            );
            context.game = BoxTrait::new(crate::logic::game::game(game_id));
            if crate::commands::ICommandIngressDispatcherTrait::requires_oath_answer(
                crate::commands::ICommandIngressLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(game_id, crate::slots::INGRESS),
                },
                game_id,
                arguments,
            ) {
                return Err(
                    crate::commands::Rejection { status_class: 'GAMEPLAY_REJECTED', reason: "ANSWER_OATH_FIRST" },
                );
            }
            let result = match dispatch(route, game_id, actor, payload, context) {
                Result::Ok(result) => result,
                Result::Err(error) => { return Err(domain_rejection(error)); },
            };
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

            let owner = actor;
            let game = context.game.unbox();
            assert!(game.dev_mode_on || context.timestamp >= game.start_settling_at, "settling not started");
            assert!(game.end_at == 0 || context.timestamp < game.end_at, "game ended");
            let pass = VillagePassKey { game_id, pass_id: command.pass_id };
            self.villages.require_pass(pass, owner);
            let mut raw_root = context.raw_root;
            let seed = crate::random::game_root(ref raw_root, game_id);
            let village_rules = self.villages.rules(game_id);
            let resource = crate::village::select_resource(village_rules.resource_pool, seed);
            let coord = ISettlementPoolLibraryDispatcher {
                class_hash: crate::logic::release::class_of(game_id, crate::slots::PLACEMENT),
            }
                .claim_village(
                    game_id, seed, crate::settlement_grid::map_center(context.rules.unbox().map_center_offset),
                );
            let village_id = ISettlementCreationLibraryDispatcher {
                class_hash: crate::logic::release::class_of(game_id, crate::slots::STRUCTURES),
            }
                .create_settlement(
                    game_id,
                    actor,
                    coord,
                    SettlementCreation::Village(
                        VillageCreation { connected_realm: command.connected_realm_entity_id, resource },
                    ),
                    crate::commands::action_context(context),
                );
            self.villages.consume(pass, owner, village_id);
            ()
        }
    }
}
