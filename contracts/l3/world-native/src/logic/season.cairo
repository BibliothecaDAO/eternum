#[starknet::interface]
pub trait IGameplay<T> {
    fn execute_gameplay(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: crate::commands::Command,
        nonce: u64,
        context: crate::commands::ExecutionContext,
    ) -> Result<Span<felt252>, felt252>;
}

#[starknet::contract]
pub mod SeasonLogic {
    use games_storage::release::LogicClasses;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
    use starknet::{ContractAddress, get_tx_info};
    use crate::commands::{Command, ExecutionContext as DomainContext};
    use crate::events::RowSet;
    use crate::logic::release::ReleaseState;
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
        fn close_season(ref self: ContractState, game_id: u32, actor: ContractAddress, context: DomainContext) -> u64 {
            let classes = self.release.classes(game_id);
            crate::commands::assert_context_time(context.timestamp);
            let mut game = crate::logic::game::game(game_id);
            crate::game::assert_playing(game, context.timestamp);
            assert!(
                crate::rules::rule_enabled(crate::logic::game::rules(game_id), crate::rules::SEASON_CLOSE),
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
            );
            if remaining != 0 {
                return remaining.into();
            }
            self.data.season.close_initiators.write(game_id, None);
            if self.data.season.player_points.read((game_id, initiator)) < threshold {
                return 0;
            }
            game.end_at = context.timestamp;
            crate::logic::game::write_game(game_id, game);
            self.record_season_end(game_id, initiator, context.timestamp);
            0
        }
    }
    #[abi(embed_v0)]
    impl GameSettlement of crate::registrar::IGameSettlement<ContractState> {
        fn mark_game_settled(
            ref self: ContractState, game_id: u32, actor: ContractAddress, context: DomainContext,
        ) -> u64 {
            assert!(actor == self.release.authority(), "only domain authority");
            crate::commands::assert_context_time(context.timestamp);
            let mut game = crate::logic::game::game(game_id);
            if game.settled {
                return 0;
            }
            assert!(
                crate::game::status_at(game, context.timestamp) == crate::game::GameStatus::Ended, "game has not ended",
            );
            assert!(
                game.end_grace_seconds == 0 || context.timestamp > game.end_at + game.end_grace_seconds.into(),
                "game settlement grace period is active",
            );
            let remaining = self.settle_final_points(game_id, context.timestamp);
            if remaining != 0 {
                return remaining.into();
            }
            game.settled = true;
            crate::logic::game::write_game(game_id, game);
            0
        }
    }
    #[abi(embed_v0)]
    impl Points of crate::game::IPoints<ContractState> {
        fn register_relic_points(ref self: ContractState, game_id: u32, actor: ContractAddress) {
            let points = crate::logic::game::rules(game_id).victory_points_grant_config.relic_open_points;
            self.register_points(game_id, actor, points.into(), crate::game::PointActivity::RelicChest);
        }
        fn register_hyperstructure_points(ref self: ContractState, game_id: u32, actor: ContractAddress, amount: u128) {
            crate::logic::game::game(game_id);
            self.register_points(game_id, actor, amount, crate::game::PointActivity::Hyperstructure);
        }
        fn player_points(self: @ContractState, game_id: u32, actor: ContractAddress) -> u128 {
            self.data.season.player_points.read((game_id, actor))
        }
        fn season_points(self: @ContractState, game_id: u32) -> u128 {
            self.data.season.season_points.read(game_id)
        }
        fn register_capture(ref self: ContractState, game_id: u32, actor: ContractAddress, category: u8) -> u128 {
            let rules = crate::logic::game::rules(game_id).victory_points_grant_config;
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
        fn register_exploration(ref self: ContractState, game_id: u32, actor: ContractAddress) {
            let amount = crate::logic::game::rules(game_id).victory_points_grant_config.explore_tiles_points;
            self.register_points(game_id, actor, amount.into(), crate::game::PointActivity::Exploration);
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        fn settle_final_points(ref self: ContractState, game_id: u32, timestamp: u64) -> u32 {
            crate::hyperstructures::IHyperstructuresDispatcherTrait::settle_final_hyperstructures(
                crate::hyperstructures::IHyperstructuresLibraryDispatcher {
                    class_hash: self.release.classes(game_id).economy.read(),
                },
                game_id,
                timestamp,
            )
        }
        fn record_season_end(ref self: ContractState, game_id: u32, winner: ContractAddress, timestamp: u64) {
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 1,
                        game_id,
                        id: crate::logic::game::allocate_entity(game_id),
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
        classes: starknet::storage::StoragePath<LogicClasses>,
        game_id: u32,
        actor: ContractAddress,
        command: Command,
        context: DomainContext,
    ) -> Result<Span<felt252>, Array<felt252>> {
        let mut calldata = array![game_id.into(), actor.into()];
        let (target, selector) = match command {
            Command::DepositResource(value) => {
                value.serialize(ref calldata);
                (classes.bridge.read(), selector!("deposit_resource"))
            },
            Command::WithdrawResource(value) => {
                value.serialize(ref calldata);
                (classes.bridge.read(), selector!("withdraw_resource"))
            },
            Command::ClaimBitcoinPhase(value) => {
                value.serialize(ref calldata);
                (classes.prizes.read(), selector!("claim_bitcoin_phase"))
            },
            Command::ContributeBitcoinLabor(value) => {
                value.serialize(ref calldata);
                (classes.prizes.read(), selector!("contribute_bitcoin_labor"))
            },
            Command::CloseBitcoinPhase(value) => {
                value.serialize(ref calldata);
                (classes.prizes.read(), selector!("close_bitcoin_phase"))
            },
            Command::BindBitcoinPhase(value) => {
                value.serialize(ref calldata);
                (classes.prizes.read(), selector!("bind_bitcoin_phase"))
            },
            Command::CreateGuild(value) => {
                value.serialize(ref calldata);
                (classes.registry.read(), selector!("create_guild"))
            },
            Command::JoinGuild(value) => {
                value.serialize(ref calldata);
                (classes.registry.read(), selector!("join_guild"))
            },
            Command::ManageTroops(value) => {
                value.serialize(ref calldata);
                (classes.troops.read(), selector!("manage_troops"))
            },
            Command::GuardAttack(value) => {
                value.serialize(ref calldata);
                (classes.combat.read(), selector!("guard_attack"))
            },
            Command::Raid(value) => {
                value.serialize(ref calldata);
                (classes.raid.read(), selector!("raid"))
            },
            Command::MarkGameSettled => (classes.season.read(), selector!("mark_game_settled")),
            Command::LeaveGuild => (classes.registry.read(), selector!("leave_guild")),
            Command::SetGuildWhitelist(value) => {
                value.serialize(ref calldata);
                (classes.registry.read(), selector!("set_guild_whitelist"))
            },
            Command::RemoveGuildMember(value) => {
                value.serialize(ref calldata);
                (classes.registry.read(), selector!("remove_guild_member"))
            },
            Command::CraftRelic(value) => {
                value.serialize(ref calldata);
                (classes.relics.read(), selector!("craft_relic"))
            },
            Command::RecordBlitzResults(value) => {
                value.serialize(ref calldata);
                (classes.prizes.read(), selector!("record_blitz_results"))
            },
            Command::PledgeFaith(value) => {
                value.serialize(ref calldata);
                (classes.prizes.read(), selector!("pledge_faith"))
            },
            Command::RemoveFaith(value) => {
                value.serialize(ref calldata);
                (classes.prizes.read(), selector!("remove_faith"))
            },
            Command::UpdateWonderOwnership(value) => {
                value.serialize(ref calldata);
                (classes.prizes.read(), selector!("update_wonder_ownership"))
            },
            Command::UpdateFaithfulOwnership(value) => {
                value.serialize(ref calldata);
                (classes.prizes.read(), selector!("update_faithful_ownership"))
            },
            Command::ClaimWonderPoints(value) => {
                value.serialize(ref calldata);
                (classes.prizes.read(), selector!("claim_wonder_points"))
            },
            Command::ClaimPlayerFaithPoints(value) => {
                value.serialize(ref calldata);
                (classes.prizes.read(), selector!("claim_player_faith_points"))
            },
            Command::CloseSeason => (classes.season.read(), selector!("close_season")),
            Command::CreateExplorer(value) => {
                value.serialize(ref calldata);
                (classes.troops.read(), selector!("create_explorer"))
            },
            Command::Explore(value) => {
                value.serialize(ref calldata);
                (classes.troops.read(), selector!("explore"))
            },
            Command::CreateBanks(value) => {
                value.serialize(ref calldata);
                (classes.economy.read(), selector!("create_banks"))
            },
            Command::BuyFromBank(value) => {
                value.serialize(ref calldata);
                (classes.economy.read(), selector!("buy_from_bank"))
            },
            Command::SellToBank(value) => {
                value.serialize(ref calldata);
                (classes.economy.read(), selector!("sell_to_bank"))
            },
            Command::AddBankLiquidity(value) => {
                value.serialize(ref calldata);
                (classes.economy.read(), selector!("add_bank_liquidity"))
            },
            Command::RemoveBankLiquidity(value) => {
                value.serialize(ref calldata);
                (classes.economy.read(), selector!("remove_bank_liquidity"))
            },
            Command::InitializeHyperstructure(value) => {
                value.serialize(ref calldata);
                (classes.economy.read(), selector!("initialize_hyperstructure"))
            },
            Command::ContributeHyperstructure(value) => {
                value.serialize(ref calldata);
                (classes.economy.read(), selector!("contribute_hyperstructure"))
            },
            Command::AllocateHyperstructureShares(value) => {
                value.serialize(ref calldata);
                (classes.economy.read(), selector!("allocate_hyperstructure_shares"))
            },
            Command::SetConstructionAccess(value) => {
                value.serialize(ref calldata);
                (classes.economy.read(), selector!("set_construction_access"))
            },
            Command::OpenRelicChest(value) => {
                value.serialize(ref calldata);
                (classes.relics.read(), selector!("open_relic_chest"))
            },
            Command::ApplyRelic(value) => {
                value.serialize(ref calldata);
                (classes.relics.read(), selector!("apply_relic"))
            },
            Command::CreateTradeOrder(value) => {
                value.serialize(ref calldata);
                (classes.economy.read(), selector!("create_trade_order"))
            },
            Command::AcceptTradeOrder(value) => {
                value.serialize(ref calldata);
                (classes.economy.read(), selector!("accept_trade_order"))
            },
            Command::CancelTradeOrder(value) => {
                value.serialize(ref calldata);
                (classes.economy.read(), selector!("cancel_trade_order"))
            },
            Command::BattleGuard(value) => {
                value.serialize(ref calldata);
                (classes.combat.read(), selector!("battle_guard"))
            },
            Command::Battle(value) => {
                value.serialize(ref calldata);
                (classes.combat.read(), selector!("battle"))
            },
            Command::Move(value) => {
                value.serialize(ref calldata);
                (classes.troops.read(), selector!("move_explorer"))
            },
            Command::ToggleAlternate(value) => {
                value.serialize(ref calldata);
                (classes.troops.read(), selector!("toggle_alternate"))
            },
            Command::TransferStructureOwnership(value) => {
                value.serialize(ref calldata);
                (classes.structures.read(), selector!("transfer_structure_ownership"))
            },
            Command::SetEntityName(value) => {
                value.serialize(ref calldata);
                (classes.structures.read(), selector!("set_entity_name"))
            },
            Command::SettleVillage(value) => {
                value.serialize(ref calldata);
                (classes.settlement.read(), selector!("settle_village"))
            },
            Command::ReceiveVillageArmy(value) => {
                value.serialize(ref calldata);
                (classes.structures.read(), selector!("receive_village_army"))
            },
            Command::SettleSeason(value) => {
                value.serialize(ref calldata);
                (classes.settlement.read(), selector!("settle_season"))
            },
            Command::SettleBlitzRoster => (classes.settlement.read(), selector!("settle_blitz_roster")),
            Command::ProvisionAndUpgradeRealm(value) => {
                value.serialize(ref calldata);
                (classes.structures.read(), selector!("provision_and_upgrade_realm"))
            },
            Command::ProvisionRealm(value) => {
                value.serialize(ref calldata);
                (classes.structures.read(), selector!("activate_realm_economy"))
            },
            Command::CreateReservedHyperstructure(value) => {
                value.serialize(ref calldata);
                (classes.structures.read(), selector!("create_reserved_hyperstructure"))
            },
            Command::EnterDepth(value) => {
                value.serialize(ref calldata);
                (classes.troops.read(), selector!("enter_depth"))
            },
            Command::BuyRealmUpgrade(value) => {
                value.serialize(ref calldata);
                (classes.construction.read(), selector!("buy_realm_upgrade"))
            },
            Command::LevelUp(value) => {
                value.serialize(ref calldata);
                (classes.construction.read(), selector!("level_up"))
            },
            Command::BurnLaborForResourceProduction(value) => {
                value.serialize(ref calldata);
                (classes.production.read(), selector!("burn_labor_for_resource_production"))
            },
            Command::BurnResourceForResourceProduction(value) => {
                value.serialize(ref calldata);
                (classes.production.read(), selector!("burn_resource_for_resource_production"))
            },
            Command::CreateBuilding(value) => {
                value.serialize(ref calldata);
                (classes.construction.read(), selector!("create_building"))
            },
            Command::DestroyBuilding(value) => {
                value.serialize(ref calldata);
                (classes.construction.read(), selector!("destroy_building"))
            },
            Command::PauseBuildingProduction(value) => {
                value.serialize(ref calldata);
                (classes.construction.read(), selector!("pause_building_production"))
            },
            Command::ResumeBuildingProduction(value) => {
                value.serialize(ref calldata);
                (classes.construction.read(), selector!("resume_building_production"))
            },
            Command::BurnStructureResources(value) => {
                value.serialize(ref calldata);
                (classes.resources.read(), selector!("burn_structure_resources"))
            },
            Command::TransferExplorerResources(value) => {
                value.serialize(ref calldata);
                (classes.resources.read(), selector!("transfer_explorer_resources"))
            },
            Command::TransferStructureResourcesToExplorer(value) => {
                value.serialize(ref calldata);
                (classes.resources.read(), selector!("transfer_structure_resources_to_explorer"))
            },
            Command::SendResources(value) => {
                value.serialize(ref calldata);
                (classes.resources.read(), selector!("send_resources"))
            },
            Command::TransferExplorerResourcesToStructure(value) => {
                value.serialize(ref calldata);
                (classes.resources.read(), selector!("transfer_explorer_resources_to_structure"))
            },
            Command::OffloadArrival(value) => {
                value.serialize(ref calldata);
                (classes.resources.read(), selector!("offload_arrival"))
            },
        };
        context.serialize(ref calldata);
        starknet::syscalls::library_call_syscall(target, selector, calldata.span())
    }

    #[abi(embed_v0)]
    impl Gameplay of super::IGameplay<ContractState> {
        fn execute_gameplay(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: Command,
            nonce: u64,
            context: DomainContext,
        ) -> Result<Span<felt252>, felt252> {
            if crate::commands::command_items(command) > crate::commands::MAX_COMMAND_ITEMS {
                return Err('INVALID_COMMAND');
            }
            let rules = crate::logic::game::rules(game_id);
            let mut command_fields = array![];
            command.serialize(ref command_fields);
            let command_index: u128 = (*command_fields.at(0)).try_into().unwrap();
            if !crate::rules::command_enabled(rules.command_mask, command_index) {
                return Err('COMMAND_DISABLED');
            }
            if !crate::logic::game::game(game_id).ready && command != Command::SettleBlitzRoster {
                return Err('ROSTER_NOT_READY');
            }
            let result = dispatch(self.release.classes(game_id), game_id, actor, command, context)
                .map_err(|_error| 'GAMEPLAY_REJECTED')?;
            match command {
                Command::SettleBlitzRoster | Command::CloseSeason | Command::MarkGameSettled |
                Command::ClaimBitcoinPhase(_) |
                Command::RecordBlitzResults(_) => {
                    let mut output = result;
                    let remaining: u64 = Serde::deserialize(ref output).expect('missing batch result');
                    assert!(output.is_empty(), "invalid batch result");
                    self.emit(crate::commands::BatchProgress { game_id, actor, nonce, remaining });
                },
                _ => {},
            }
            Ok(result)
        }
    }
}
