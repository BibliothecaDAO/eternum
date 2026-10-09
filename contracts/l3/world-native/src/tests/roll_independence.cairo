use snforge_std::{EventSpyTrait, EventsFilterTrait};
use crate::commands::Command;
use crate::tests::play_fixture::{IPlayFixtureSafeDispatcher, IPlayFixtureSafeDispatcherTrait, TestAction};
use crate::tests::{Deployment, play_fixture};

const ROUTES: u32 = 72;
const ROOTS: u64 = 32;

// Every value is a fully typed command. Missing entities and unavailable lifecycle transitions exercise domain refusals.
fn typed_commands() -> Array<Command> {
    array![
        Command::CreateExplorer(
            crate::commands::CreateExplorer { structure_id: 999999, category: 0, tier: 0, amount: 1, direction: 0 },
        ),
        Command::Explore(crate::commands::Explore { explorer_id: 999999, direction: 0 }),
        Command::Battle(
            crate::combat_actions::AttackExplorer {
                attacker_id: 999999,
                defender_id: 999999,
                steal_resources: array![crate::resources::ResourceAmount { resource_type: 1, amount: 1 }].span(),
            },
        ),
        Command::Move(crate::commands::Move { explorer_id: 999999, directions: array![0_u8].span() }),
        Command::ToggleAlternate(crate::commands::ToggleAlternate { explorer_id: 999999, spire_direction: 0 }),
        Command::TransferStructureOwnership(
            crate::ownership::TransferOwnership { entity_id: 999999, new_owner: 999.try_into().unwrap() },
        ),
        Command::LevelUp(999999),
        Command::SettleBlitzRoster,
        Command::ProvisionRealm(999999),
        Command::CreateReservedHyperstructure(crate::troops::Coord { alt: false, x: 2000000, y: 2000000 }),
        Command::SettleSeason(crate::realms::SettleSeason { name: 'route', selected_realm: None }),
        Command::SettleVillage(crate::village::SettleVillage { pass_id: 1, connected_realm_entity_id: 999999 }),
        Command::ReceiveVillageArmy(999999),
        Command::BurnStructureResources(
            crate::resources::ResourceBurn {
                entity_id: 999999,
                resources: array![crate::resources::ResourceAmount { resource_type: 1, amount: 1 }].span(),
            },
        ),
        Command::TransferExplorerResources(
            crate::resources::ResourceTransfer {
                from_entity_id: 999999,
                to_entity_id: 999999,
                resources: array![crate::resources::ResourceAmount { resource_type: 1, amount: 1 }].span(),
            },
        ),
        Command::TransferStructureResourcesToExplorer(
            crate::resources::ResourceTransfer {
                from_entity_id: 999999,
                to_entity_id: 999999,
                resources: array![crate::resources::ResourceAmount { resource_type: 1, amount: 1 }].span(),
            },
        ),
        Command::OffloadArrival(
            crate::arrivals::OffloadArrival { entity_id: 999999, day: 0, slot: 0, resource_count: 1 },
        ),
        Command::SendResources(
            crate::resources::ResourceTransfer {
                from_entity_id: 999999,
                to_entity_id: 999999,
                resources: array![crate::resources::ResourceAmount { resource_type: 1, amount: 1 }].span(),
            },
        ),
        Command::TransferExplorerResourcesToStructure(
            crate::resources::ResourceTransfer {
                from_entity_id: 999999,
                to_entity_id: 999999,
                resources: array![crate::resources::ResourceAmount { resource_type: 1, amount: 1 }].span(),
            },
        ),
        Command::BurnLaborForResourceProduction(
            crate::production::RefillProduction {
                structure_id: 999999,
                resource_types: array![1_u8].span(),
                amounts: array![1_u128].span(),
            },
        ),
        Command::BurnResourceForResourceProduction(
            crate::production::RefillProduction {
                structure_id: 999999,
                resource_types: array![1_u8].span(),
                amounts: array![1_u128].span(),
            },
        ),
        Command::CreateBuilding(
            crate::buildings::CreateBuilding {
                structure_id: 999999,
                directions: array![0_u8].span(),
                category: 0,
                use_simple: false,
            },
        ),
        Command::DestroyBuilding(
            crate::buildings::ChangeBuilding {
                structure_id: 999999,
                coord: crate::troops::Coord { alt: false, x: 2000000, y: 2000000 },
            },
        ),
        Command::PauseBuildingProduction(
            crate::buildings::ChangeBuilding {
                structure_id: 999999,
                coord: crate::troops::Coord { alt: false, x: 2000000, y: 2000000 },
            },
        ),
        Command::ResumeBuildingProduction(
            crate::buildings::ChangeBuilding {
                structure_id: 999999,
                coord: crate::troops::Coord { alt: false, x: 2000000, y: 2000000 },
            },
        ),
        Command::ContributeBitcoinLabor(crate::bitcoin::ContributeLabor { structure_id: 999999, amount: 1 }),
        Command::CloseBitcoinPhase(999999),
        Command::BindBitcoinPhase(999999),
        Command::ClaimBitcoinPhase(crate::bitcoin::ClaimPhase { phase: 0, mine_ids: array![999999_u64].span() }),
        Command::BattleGuard(crate::commands::Battle { attacker_id: 999999, defender_id: 999999 }),
        Command::CreateTradeOrder(
            crate::trade::CreateOrder {
                maker_id: 999999,
                taker_id: 999999,
                offered_resource: 1,
                requested_resource: 2,
                offered_per_lot: 1,
                requested_per_lot: 1,
                lots: 1,
                expires_at: 0,
            },
        ),
        Command::AcceptTradeOrder(crate::trade::AcceptOrder { trade_id: 999999, taker_id: 999999, lots: 1 }),
        Command::CancelTradeOrder(999999),
        Command::CreateBanks(
            array![
                crate::market::BankPlacement {
                    name: 'bank',
                    coord: crate::troops::Coord { alt: false, x: 2000000, y: 2000000 },
                },
                crate::market::BankPlacement {
                    name: 'bank',
                    coord: crate::troops::Coord { alt: false, x: 2000010, y: 2000000 },
                },
                crate::market::BankPlacement {
                    name: 'bank',
                    coord: crate::troops::Coord { alt: false, x: 2000020, y: 2000000 },
                },
                crate::market::BankPlacement {
                    name: 'bank',
                    coord: crate::troops::Coord { alt: false, x: 2000030, y: 2000000 },
                },
                crate::market::BankPlacement {
                    name: 'bank',
                    coord: crate::troops::Coord { alt: false, x: 2000040, y: 2000000 },
                },
                crate::market::BankPlacement {
                    name: 'bank',
                    coord: crate::troops::Coord { alt: false, x: 2000050, y: 2000000 },
                },
            ].span(),
        ),
        Command::BuyFromBank(
            crate::market::Swap { bank_id: 999999, structure_id: 999999, resource_type: 1, amount: 1 },
        ),
        Command::SellToBank(
            crate::market::Swap { bank_id: 999999, structure_id: 999999, resource_type: 1, amount: 1 },
        ),
        Command::AddBankLiquidity(
            crate::market::AddLiquidity {
                bank_id: 999999,
                structure_id: 999999,
                resource_type: 1,
                resource_amount: 1,
                lords_amount: 1,
            },
        ),
        Command::RemoveBankLiquidity(
            crate::market::RemoveLiquidity { bank_id: 999999, structure_id: 999999, resource_type: 1, shares: 1 },
        ),
        Command::InitializeHyperstructure(999999),
        Command::ContributeHyperstructure(
            crate::hyperstructures::Contribution {
                hyperstructure_id: 999999,
                from_structure_id: 999999,
                resources: array![crate::resources::ResourceAmount { resource_type: 1, amount: 1 }].span(),
            },
        ),
        Command::AllocateHyperstructureShares(
            crate::hyperstructures::AllocateShares {
                hyperstructure_id: 999999,
                shareholders:
                    array![crate::hyperstructures::Share { player: 999.try_into().unwrap(), bps: 10000 }].span(),
            },
        ),
        Command::SetConstructionAccess(
            crate::hyperstructures::SetConstructionAccess {
                hyperstructure_id: 999999,
                access: crate::hyperstructures::ConstructionAccess::Public,
            },
        ),
        Command::OpenRelicChest(
            crate::relics::OpenChest {
                explorer_id: 999999,
                coord: crate::troops::Coord { alt: false, x: 2000000, y: 2000000 },
            },
        ),
        Command::ApplyRelic(
            crate::relics::ApplyRelic {
                entity_id: 999999,
                relic_id: 39,
                recipient: crate::relics::Recipient::Explorer,
            },
        ),
        Command::CloseSeason,
        Command::PledgeFaith(crate::faith::Pledge { structure_id: 999999, wonder_id: 999999 }),
        Command::RemoveFaith(999999),
        Command::UpdateWonderOwnership(999999),
        Command::UpdateFaithfulOwnership(999999),
        Command::ClaimWonderPoints(999999),
        Command::ClaimPlayerFaithPoints(
            crate::faith::ClaimPlayer { player: 999.try_into().unwrap(), wonder_id: 999999 },
        ),
        Command::RecordBlitzResults(
            crate::blitz_results::RecordBlitzResults {
                start: 0,
                players:
                    array![
                        crate::blitz_results::PlayerResult { player: 999.try_into().unwrap(), points: 0, rank: 1 },
                    ].span(),
            },
        ),
        Command::CraftRelic(999999),
        Command::CreateGuild(
            crate::guilds::CreateGuild { owned_structure_id: 999999, public: false, name: 'route' },
        ),
        Command::JoinGuild(
            crate::guilds::JoinGuild { owned_structure_id: 999999, guild_id: 999.try_into().unwrap() },
        ),
        Command::LeaveGuild,
        Command::SetGuildWhitelist(
            crate::guilds::SetWhitelist {
                player: 999.try_into().unwrap(),
                owned_structure_id: 999999,
                allowed: false,
            },
        ),
        Command::RemoveGuildMember(999.try_into().unwrap()),
        Command::MarkGameSettled,
        Command::ManageTroops(
            crate::troop_management::ManageTroops::RecruitGuard(crate::troop_management::RecruitGuard {
                guard: crate::troop_management::GuardSlot { structure_id: 999999, slot: 0 },
                category: crate::troops::TroopType::Knight,
                tier: crate::troops::TroopTier::T1,
                amount: 1,
            }),
        ),
        Command::GuardAttack(
            crate::combat_actions::GuardAttack {
                guard: crate::troop_management::GuardSlot { structure_id: 999999, slot: 0 },
                explorer_id: 999999,
            },
        ),
        Command::Raid(
            crate::combat_actions::Raid {
                explorer_id: 999999,
                structure_id: 999999,
                steal_resources: array![crate::resources::ResourceAmount { resource_type: 1, amount: 1 }].span(),
            },
        ),
        Command::DepositResource(
            crate::bridge::Deposit {
                structure_id: 999999,
                resource_type: 1,
                amount: 1,
                client_fee_recipient: 999.try_into().unwrap(),
            },
        ),
        Command::WithdrawResource(
            crate::bridge::Withdraw {
                structure_id: 999999,
                recipient: 999.try_into().unwrap(),
                resource_type: 1,
                amount: 1,
                client_fee_recipient: 999.try_into().unwrap(),
            },
        ),
        Command::ProvisionAndUpgradeRealm(999999),
        Command::SetEntityName(crate::names::SetEntityName { entity_id: 999999, name: 'route' }),
        Command::EnterDepth(crate::commands::EnterDepth { explorer_id: 999999, depth: 0 }),
        Command::Research(crate::research::Research { structure_id: 999999, row: 0, choice: 0 }),
        Command::BuyTier(
            crate::progression::BuyTier {
                explorer_id: 999999,
                attribute: crate::progression::Attribute::Battle,
                kind: None,
            },
        ),
        Command::InteractSite(
            crate::relics::InteractSite {
                explorer_id: 999999,
                coord: crate::troops::Coord { alt: false, x: 2000000, y: 2000000 },
            },
        ),
        Command::RefillStamina(crate::relics::RefillStamina { explorer_id: 999999 }),
        Command::WithdrawLords(crate::relics::WithdrawLords { structure_id: 999999, amount: 1 }),
    ]
}

fn fresh_world(ready: bool) -> Deployment {
    let d = super::setup_with_domains(true, "StructuresLogic", "TroopsLogic");
    let game = crate::game::IGameDispatcherTrait::game(crate::game::IGameDispatcher { contract_address: d.games }, 1);
    let rules = crate::rules::SliceRules {
        command_mask: 0xffffffffffffffffff,
        entry_rule: crate::rules::ENTRY_ENTITLEMENT,
        ..play_fixture::rules(),
    };
    play_fixture::seed_game(d.games, 1, crate::game::GameRegistry {
        ready, dev_mode_on: false, start_settling_at: 20, start_main_at: 20, end_at: 200, ..game
    }, rules);
    if ready { super::set_launcher(d, d.actor); }
    d
}

fn assert_route(command: Command, index: u32) {
    let encoded = play_fixture::encode(command);
    let (actual, _, _) = crate::commands::validated_command(encoded).expect('INVALID_TYPED_VECTOR');
    assert_eq!(actual, index);
}

#[test]
#[feature("safe_dispatcher")]
fn all_72_typed_entry_refusals_are_root_independent() {
    let commands = typed_commands();
    assert_eq!(commands.len(), ROUTES);
    assert_eq!(crate::command_routes::COMMAND_ROUTES.span().len(), ROUTES);
    for index in 0..ROUTES {
        let command = *commands.at(index);
        assert_route(command, index);
        let mut expected = None;
        for root in 0..ROOTS {
            let d = fresh_world(false);
            if let Command::WithdrawLords(_) = command {
                snforge_std::start_cheat_transaction_hash(d.games, (100000_u64 + root).into());
            }
            let before = play_fixture::gameplay_snapshot(d.games);
            let (release, preset) = play_fixture::pins(d.games, 1);
            play_fixture::caller(d.games, d.actor, 100);
            let mut spy = snforge_std::spy_events();
            let error = IPlayFixtureSafeDispatcher { contract_address: d.games }
                .play_with_root(1, release, preset, play_fixture::encode(command), root.into()).unwrap_err();
            if let Some(previous) = expected { assert_eq!(error.span(), previous); }
            expected = Some(error.span());
            assert_eq!(play_fixture::gameplay_snapshot(d.games), before);
            assert!(spy.get_events().emitted_by(d.games).events.is_empty());
        }
    }
}

#[test]
fn all_72_real_domain_verdicts_are_root_independent() {
    let commands = typed_commands();
    assert_eq!(commands.len(), ROUTES);
    for index in 0..ROUTES {
        let command = *commands.at(index);
        assert_route(command, index);
        let mut expected = None;
        for root in 0..ROOTS {
            let d = fresh_world(true);
            if let Command::WithdrawLords(_) = command {
                snforge_std::start_cheat_transaction_hash(d.games, (200000_u64 + root).into());
            }
            let mut spy = snforge_std::spy_events();
            let applied = play_fixture::play(d.games, TestAction { game_id: 1, actor: d.actor, command }, root.into(), 100);
            if let Some(previous) = expected { assert_eq!(applied, previous, "route {} root {}", index, root); }
            expected = Some(applied);
            if !applied {
                let rejected = play_fixture::rejection(ref spy, d.games);
                assert_eq!(rejected.status_class, 'GAMEPLAY_REJECTED');
                assert_eq!(rejected.actor, d.actor);
            }
        }
    }
}

fn draw_case(case: u8) -> (Deployment, TestAction, u64) {
    match case {
        0 => explorer_case(false),
        1 => explorer_case(true),
        2 => battle_case(),
        3 => {
            let (d, home) = super::artificer::setup(false);
            (d, TestAction { game_id: 3, actor: d.actor, command: Command::CraftRelic(home.entity_id) }, 30)
        },
        4 => chest_case(),
        5 => season_case(),
        6 => {
            let (d, home) = super::village::setup(false);
            super::village::register_pass(d, 7);
            let command = Command::SettleVillage(crate::village::SettleVillage { pass_id: 7, connected_realm_entity_id: home });
            (d, TestAction { game_id: 3, actor: d.actor, command }, 100)
        },
        _ => panic!("unknown draw case"),
    }
}

fn explorer_case(explore: bool) -> (Deployment, TestAction, u64) {
    let (d, home) = super::camps::setup(false);
    super::resource_commands::grant(d, home, 26, 100 * crate::rules::RESOURCE_PRECISION);
    let create = Command::CreateExplorer(crate::commands::CreateExplorer {
        structure_id: home.entity_id, category: 0, tier: 0, amount: crate::rules::RESOURCE_PRECISION, direction: 0,
    });
    let command = if explore {
        assert!(super::resource_commands::execute(d, create, 80));
        let army = crate::tests::state::StructureObservationTrait::home_armies(
            crate::structures::IStructureOperationsDispatcher { contract_address: d.games }, home,
        );
        Command::Explore(crate::commands::Explore { explorer_id: *army.at(0), direction: 0 })
    } else { create };
    (d, TestAction { game_id: 3, actor: d.actor, command }, 140)
}

fn battle_case() -> (Deployment, TestAction, u64) {
    let (d, _, _, attacker, defender) = super::combat_actions::setup_with_cooldown(
        false, 0, super::play_fixture::ETERNUM_RULES | crate::rules::COMBAT_DICE, 0, (1000, 1000),
    );
    let command = Command::Battle(crate::combat_actions::AttackExplorer {
        attacker_id: attacker, defender_id: defender, steal_resources: array![].span(),
    });
    (d, TestAction { game_id: 3, actor: d.actor, command }, 80)
}

fn chest_case() -> (Deployment, TestAction, u64) {
    let (d, _, explorer) = super::relics::setup(true);
    let coord = super::relics::chest(d, crate::troops::Coord { alt: false, x: 2000200, y: 2000200 }, 321, 40);
    super::relics::move_fixture(d, explorer, crate::geometry::neighbor(coord, 0));
    let command = Command::OpenRelicChest(crate::relics::OpenChest { explorer_id: explorer.entity_id, coord });
    (d, TestAction { game_id: 3, actor: d.actor, command }, 50)
}

fn season_case() -> (Deployment, TestAction, u64) {
    let d = super::registrar::setup();
    let registrar = crate::registrar::IRegistrarDispatcher { contract_address: d.games };
    snforge_std::start_cheat_caller_address(d.games, super::authority());
    crate::registrar::IRegistrarDispatcherTrait::register_preset(registrar, 1, super::registrar::definition(false));
    let game_id = crate::registrar::IRegistrarDispatcherTrait::create_game(registrar, crate::registrar::CreateGameParams {
        dev_mode_on: true, ..super::registrar::params(false)
    });
    play_fixture::prepare_homes(d.games, game_id, d.actor);
    super::resource_commands::set_fixture(d.games, selector!("realms"), selector!("catalogue_count"), array![].span(), 8000_u32);
    super::resource_commands::set_fixture(d.games, selector!("realms"), selector!("traits"), array![1].span(), 0x4000001_u32);
    let command = Command::SettleSeason(crate::realms::SettleSeason { name: 'root-independent', selected_realm: Some(1) });
    (d, TestAction { game_id, actor: d.actor, command }, 350)
}

#[test]
fn successful_real_draw_paths_stay_applied_across_32_roots() {
    for case in 0_u8..7 {
        for root in 0..ROOTS {
            let (d, action, timestamp) = draw_case(case);
            let mut spy = snforge_std::spy_events();
            assert!(play_fixture::play(d.games, action, root.into(), timestamp), "case {} root {}", case, root);
            for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
                assert_ne!(*event.keys.at(0), selector!("GameplayRejected"));
            }
        }
    }
}

fn live_loot_case(raid: bool, insufficient: bool, full: bool) -> (Deployment, TestAction) {
    use starknet::storage::StorageMapWriteAccess;
    let (d, _, target, attacker, defender) = super::combat_actions::setup_with_cooldown(
        false, 0, super::play_fixture::ETERNUM_RULES | crate::rules::COMBAT_DICE, 0, (1000, 1000),
    );
    let from = if raid { target.entity_id } else { defender };
    super::resource_commands::grant(d, crate::resources::ResourceKey { game_id: 3, entity_id: from }, 2, 90);
    if raid { super::combat_actions::set_guard(d, target, 0, 1000); }
    if full {
        snforge_std::interact_with_state(d.games, || crate::state::write().resources.weights.write(
            (3, attacker), crate::resources::Weight { capacity: 0, weight: 0 },
        ));
    }
    let loot = array![crate::resources::ResourceAmount { resource_type: 2, amount: if insufficient { 91 } else { 70 } }].span();
    let command = if raid {
        Command::Raid(crate::combat_actions::Raid { explorer_id: attacker, structure_id: target.entity_id, steal_resources: loot })
    } else {
        Command::Battle(crate::combat_actions::AttackExplorer { attacker_id: attacker, defender_id: defender, steal_resources: loot })
    };
    (d, TestAction { game_id: 3, actor: d.actor, command })
}

#[test]
fn real_battle_and_guarded_raid_loot_verdicts_do_not_select_a_roll() {
    for raid in array![false, true] {
        for insufficient in array![false, true] {
            for full in array![false, true] {
                for root in 0..ROOTS {
                    let (d, action) = live_loot_case(raid, insufficient, full);
                    let before = play_fixture::gameplay_snapshot(d.games);
                    let applied = play_fixture::play(d.games, action, root.into(), 80);
                    assert_eq!(applied, !insufficient, "raid {} missing {} full {} root {}", raid, insufficient, full, root);
                    if !applied { assert_eq!(play_fixture::gameplay_snapshot(d.games), before); }
                }
            }
        }
    }
}

#[test]
fn real_movement_reward_stays_applied_at_full_and_fractional_stores() {
    use starknet::storage::StorageMapWriteAccess;
    for capacity in array![0_u128, crate::rules::RESOURCE_PRECISION - 1] {
        for root in 0..ROOTS {
            let (d, action, timestamp) = explorer_case(true);
            snforge_std::interact_with_state(d.games, || {
                let explorer = crate::logic::troops::explorer(crate::troops::ExplorerKey {
                    game_id: action.game_id,
                    explorer_id: match action.command { Command::Explore(value) => value.explorer_id, _ => panic!("explore fixture required") },
                }).unwrap();
                crate::state::write().resources.weights.write(
                    (action.game_id, explorer.owner), crate::resources::Weight { capacity, weight: 0 },
                );
            });
            assert!(play_fixture::play(d.games, action, root.into(), timestamp), "capacity {} root {}", capacity, root);
        }
    }
}
