use snforge_std::{EventSpyTrait, EventsFilterTrait};
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerWriteAccess};
use crate::commands::Command;
use crate::tests::play_fixture::{IPlayFixtureSafeDispatcher, IPlayFixtureSafeDispatcherTrait, TestAction};
use crate::tests::{Deployment, play_fixture};

const ROUTES: u32 = 72;
const ROOTS: u64 = 32;

// Every value is a fully typed command. Missing entities and unavailable lifecycle transitions exercise domain
// refusals.
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
        Command::LevelUp(999999), Command::SettleBlitzRoster, Command::ProvisionRealm(999999),
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
                structure_id: 999999, resource_types: array![1_u8].span(), amounts: array![1_u128].span(),
            },
        ),
        Command::BurnResourceForResourceProduction(
            crate::production::RefillProduction {
                structure_id: 999999, resource_types: array![1_u8].span(), amounts: array![1_u128].span(),
            },
        ),
        Command::CreateBuilding(
            crate::buildings::CreateBuilding {
                structure_id: 999999, directions: array![0_u8].span(), category: 0, use_simple: false,
            },
        ),
        Command::DestroyBuilding(
            crate::buildings::ChangeBuilding {
                structure_id: 999999, coord: crate::troops::Coord { alt: false, x: 2000000, y: 2000000 },
            },
        ),
        Command::PauseBuildingProduction(
            crate::buildings::ChangeBuilding {
                structure_id: 999999, coord: crate::troops::Coord { alt: false, x: 2000000, y: 2000000 },
            },
        ),
        Command::ResumeBuildingProduction(
            crate::buildings::ChangeBuilding {
                structure_id: 999999, coord: crate::troops::Coord { alt: false, x: 2000000, y: 2000000 },
            },
        ),
        Command::ContributeBitcoinLabor(crate::bitcoin::ContributeLabor { structure_id: 999999, amount: 1 }),
        Command::CloseBitcoinPhase(999999), Command::BindBitcoinPhase(999999),
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
                    name: 'bank', coord: crate::troops::Coord { alt: false, x: 2000000, y: 2000000 },
                },
                crate::market::BankPlacement {
                    name: 'bank', coord: crate::troops::Coord { alt: false, x: 2000010, y: 2000000 },
                },
                crate::market::BankPlacement {
                    name: 'bank', coord: crate::troops::Coord { alt: false, x: 2000020, y: 2000000 },
                },
                crate::market::BankPlacement {
                    name: 'bank', coord: crate::troops::Coord { alt: false, x: 2000030, y: 2000000 },
                },
                crate::market::BankPlacement {
                    name: 'bank', coord: crate::troops::Coord { alt: false, x: 2000040, y: 2000000 },
                },
                crate::market::BankPlacement {
                    name: 'bank', coord: crate::troops::Coord { alt: false, x: 2000050, y: 2000000 },
                },
            ]
                .span(),
        ),
        Command::BuyFromBank(
            crate::market::Swap { bank_id: 999999, structure_id: 999999, resource_type: 1, amount: 1 },
        ),
        Command::SellToBank(crate::market::Swap { bank_id: 999999, structure_id: 999999, resource_type: 1, amount: 1 }),
        Command::AddBankLiquidity(
            crate::market::AddLiquidity {
                bank_id: 999999, structure_id: 999999, resource_type: 1, resource_amount: 1, lords_amount: 1,
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
                shareholders: array![crate::hyperstructures::Share { player: 999.try_into().unwrap(), bps: 10000 }]
                    .span(),
            },
        ),
        Command::SetConstructionAccess(
            crate::hyperstructures::SetConstructionAccess {
                hyperstructure_id: 999999, access: crate::hyperstructures::ConstructionAccess::Public,
            },
        ),
        Command::OpenRelicChest(
            crate::relics::OpenChest {
                explorer_id: 999999, coord: crate::troops::Coord { alt: false, x: 2000000, y: 2000000 },
            },
        ),
        Command::ApplyRelic(
            crate::relics::ApplyRelic {
                entity_id: 999999, relic_id: 39, recipient: crate::relics::Recipient::Explorer,
            },
        ),
        Command::CloseSeason, Command::PledgeFaith(crate::faith::Pledge { structure_id: 999999, wonder_id: 999999 }),
        Command::RemoveFaith(999999), Command::UpdateWonderOwnership(999999), Command::UpdateFaithfulOwnership(999999),
        Command::ClaimWonderPoints(999999),
        Command::ClaimPlayerFaithPoints(
            crate::faith::ClaimPlayer { player: 999.try_into().unwrap(), wonder_id: 999999 },
        ),
        Command::RecordBlitzResults, Command::CraftRelic(999999),
        Command::CreateGuild(crate::guilds::CreateGuild { owned_structure_id: 999999, public: false, name: 'route' }),
        Command::JoinGuild(crate::guilds::JoinGuild { owned_structure_id: 999999, guild_id: 999.try_into().unwrap() }),
        Command::LeaveGuild,
        Command::SetGuildWhitelist(
            crate::guilds::SetWhitelist { player: 999.try_into().unwrap(), owned_structure_id: 999999, allowed: false },
        ),
        Command::RemoveGuildMember(999.try_into().unwrap()), Command::MarkGameSettled,
        Command::ManageTroops(
            crate::troop_management::ManageTroops::RecruitGuard(
                crate::troop_management::RecruitGuard {
                    guard: crate::troop_management::GuardSlot { structure_id: 999999, slot: 0 },
                    category: crate::troops::TroopType::Knight,
                    tier: crate::troops::TroopTier::T1,
                    amount: 1,
                },
            ),
        ),
        Command::GuardAttack(
            crate::combat_actions::GuardAttack {
                guard: crate::troop_management::GuardSlot { structure_id: 999999, slot: 0 }, explorer_id: 999999,
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
                structure_id: 999999, resource_type: 1, amount: 1, client_fee_recipient: 999.try_into().unwrap(),
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
                explorer_id: 999999, attribute: crate::progression::Attribute::Battle, kind: None,
            },
        ),
        Command::InteractSite(
            crate::relics::InteractSite {
                explorer_id: 999999, coord: crate::troops::Coord { alt: false, x: 2000000, y: 2000000 },
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
        command_mask: 0xffffffffffffffffff, entry_rule: crate::rules::ENTRY_ENTITLEMENT, ..play_fixture::rules(),
    };
    play_fixture::seed_game(
        d.games,
        1,
        crate::game::GameRegistry {
            ready, dev_mode_on: false, start_settling_at: 20, start_main_at: 20, end_at: 200, ..game,
        },
        rules,
    );
    if ready {
        super::set_launcher(d, d.actor);
        // This all-routes synthetic world enables WithdrawLords too; give its pre-roll deadline a real preset value.
        let (_, frontier) = super::preset_projection::current_definition("frontier");
        snforge_std::interact_with_state(
            d.games,
            || {
                crate::state::write().registrar.roster_sizes.write(1, 1);
                crate::state::write()
                    .presets
                    .entry(crate::logic::game::preset_commitment(crate::logic::game::game(1)))
                    .rollover_chest_rules
                    .write(frontier.economy.chests);
            },
        );
    }
    d
}

fn assert_route(command: Command, index: u32) {
    let encoded = play_fixture::encode(command);
    let (actual, _, _) = crate::commands::validated_command(encoded).expect('INVALID_TYPED_VECTOR');
    assert_eq!(actual, index);
}

// Independent fixtures keep each VM below the event bound; every root group also compares against root zero.
#[test_case(name: "route_00_roots_00_07", 0, 0)]
#[test_case(name: "route_00_roots_08_15", 0, 8)]
#[test_case(name: "route_00_roots_16_23", 0, 16)]
#[test_case(name: "route_00_roots_24_31", 0, 24)]
#[test_case(name: "route_01_roots_00_07", 1, 0)]
#[test_case(name: "route_01_roots_08_15", 1, 8)]
#[test_case(name: "route_01_roots_16_23", 1, 16)]
#[test_case(name: "route_01_roots_24_31", 1, 24)]
#[test_case(name: "route_02_roots_00_07", 2, 0)]
#[test_case(name: "route_02_roots_08_15", 2, 8)]
#[test_case(name: "route_02_roots_16_23", 2, 16)]
#[test_case(name: "route_02_roots_24_31", 2, 24)]
#[test_case(name: "route_03_roots_00_07", 3, 0)]
#[test_case(name: "route_03_roots_08_15", 3, 8)]
#[test_case(name: "route_03_roots_16_23", 3, 16)]
#[test_case(name: "route_03_roots_24_31", 3, 24)]
#[test_case(name: "route_04_roots_00_07", 4, 0)]
#[test_case(name: "route_04_roots_08_15", 4, 8)]
#[test_case(name: "route_04_roots_16_23", 4, 16)]
#[test_case(name: "route_04_roots_24_31", 4, 24)]
#[test_case(name: "route_05_roots_00_07", 5, 0)]
#[test_case(name: "route_05_roots_08_15", 5, 8)]
#[test_case(name: "route_05_roots_16_23", 5, 16)]
#[test_case(name: "route_05_roots_24_31", 5, 24)]
#[test_case(name: "route_06_roots_00_07", 6, 0)]
#[test_case(name: "route_06_roots_08_15", 6, 8)]
#[test_case(name: "route_06_roots_16_23", 6, 16)]
#[test_case(name: "route_06_roots_24_31", 6, 24)]
#[test_case(name: "route_07_roots_00_07", 7, 0)]
#[test_case(name: "route_07_roots_08_15", 7, 8)]
#[test_case(name: "route_07_roots_16_23", 7, 16)]
#[test_case(name: "route_07_roots_24_31", 7, 24)]
#[test_case(name: "route_08_roots_00_07", 8, 0)]
#[test_case(name: "route_08_roots_08_15", 8, 8)]
#[test_case(name: "route_08_roots_16_23", 8, 16)]
#[test_case(name: "route_08_roots_24_31", 8, 24)]
#[test_case(name: "route_09_roots_00_07", 9, 0)]
#[test_case(name: "route_09_roots_08_15", 9, 8)]
#[test_case(name: "route_09_roots_16_23", 9, 16)]
#[test_case(name: "route_09_roots_24_31", 9, 24)]
#[test_case(name: "route_10_roots_00_07", 10, 0)]
#[test_case(name: "route_10_roots_08_15", 10, 8)]
#[test_case(name: "route_10_roots_16_23", 10, 16)]
#[test_case(name: "route_10_roots_24_31", 10, 24)]
#[test_case(name: "route_11_roots_00_07", 11, 0)]
#[test_case(name: "route_11_roots_08_15", 11, 8)]
#[test_case(name: "route_11_roots_16_23", 11, 16)]
#[test_case(name: "route_11_roots_24_31", 11, 24)]
#[test_case(name: "route_12_roots_00_07", 12, 0)]
#[test_case(name: "route_12_roots_08_15", 12, 8)]
#[test_case(name: "route_12_roots_16_23", 12, 16)]
#[test_case(name: "route_12_roots_24_31", 12, 24)]
#[test_case(name: "route_13_roots_00_07", 13, 0)]
#[test_case(name: "route_13_roots_08_15", 13, 8)]
#[test_case(name: "route_13_roots_16_23", 13, 16)]
#[test_case(name: "route_13_roots_24_31", 13, 24)]
#[test_case(name: "route_14_roots_00_07", 14, 0)]
#[test_case(name: "route_14_roots_08_15", 14, 8)]
#[test_case(name: "route_14_roots_16_23", 14, 16)]
#[test_case(name: "route_14_roots_24_31", 14, 24)]
#[test_case(name: "route_15_roots_00_07", 15, 0)]
#[test_case(name: "route_15_roots_08_15", 15, 8)]
#[test_case(name: "route_15_roots_16_23", 15, 16)]
#[test_case(name: "route_15_roots_24_31", 15, 24)]
#[test_case(name: "route_16_roots_00_07", 16, 0)]
#[test_case(name: "route_16_roots_08_15", 16, 8)]
#[test_case(name: "route_16_roots_16_23", 16, 16)]
#[test_case(name: "route_16_roots_24_31", 16, 24)]
#[test_case(name: "route_17_roots_00_07", 17, 0)]
#[test_case(name: "route_17_roots_08_15", 17, 8)]
#[test_case(name: "route_17_roots_16_23", 17, 16)]
#[test_case(name: "route_17_roots_24_31", 17, 24)]
#[test_case(name: "route_18_roots_00_07", 18, 0)]
#[test_case(name: "route_18_roots_08_15", 18, 8)]
#[test_case(name: "route_18_roots_16_23", 18, 16)]
#[test_case(name: "route_18_roots_24_31", 18, 24)]
#[test_case(name: "route_19_roots_00_07", 19, 0)]
#[test_case(name: "route_19_roots_08_15", 19, 8)]
#[test_case(name: "route_19_roots_16_23", 19, 16)]
#[test_case(name: "route_19_roots_24_31", 19, 24)]
#[test_case(name: "route_20_roots_00_07", 20, 0)]
#[test_case(name: "route_20_roots_08_15", 20, 8)]
#[test_case(name: "route_20_roots_16_23", 20, 16)]
#[test_case(name: "route_20_roots_24_31", 20, 24)]
#[test_case(name: "route_21_roots_00_07", 21, 0)]
#[test_case(name: "route_21_roots_08_15", 21, 8)]
#[test_case(name: "route_21_roots_16_23", 21, 16)]
#[test_case(name: "route_21_roots_24_31", 21, 24)]
#[test_case(name: "route_22_roots_00_07", 22, 0)]
#[test_case(name: "route_22_roots_08_15", 22, 8)]
#[test_case(name: "route_22_roots_16_23", 22, 16)]
#[test_case(name: "route_22_roots_24_31", 22, 24)]
#[test_case(name: "route_23_roots_00_07", 23, 0)]
#[test_case(name: "route_23_roots_08_15", 23, 8)]
#[test_case(name: "route_23_roots_16_23", 23, 16)]
#[test_case(name: "route_23_roots_24_31", 23, 24)]
#[test_case(name: "route_24_roots_00_07", 24, 0)]
#[test_case(name: "route_24_roots_08_15", 24, 8)]
#[test_case(name: "route_24_roots_16_23", 24, 16)]
#[test_case(name: "route_24_roots_24_31", 24, 24)]
#[test_case(name: "route_25_roots_00_07", 25, 0)]
#[test_case(name: "route_25_roots_08_15", 25, 8)]
#[test_case(name: "route_25_roots_16_23", 25, 16)]
#[test_case(name: "route_25_roots_24_31", 25, 24)]
#[test_case(name: "route_26_roots_00_07", 26, 0)]
#[test_case(name: "route_26_roots_08_15", 26, 8)]
#[test_case(name: "route_26_roots_16_23", 26, 16)]
#[test_case(name: "route_26_roots_24_31", 26, 24)]
#[test_case(name: "route_27_roots_00_07", 27, 0)]
#[test_case(name: "route_27_roots_08_15", 27, 8)]
#[test_case(name: "route_27_roots_16_23", 27, 16)]
#[test_case(name: "route_27_roots_24_31", 27, 24)]
#[test_case(name: "route_28_roots_00_07", 28, 0)]
#[test_case(name: "route_28_roots_08_15", 28, 8)]
#[test_case(name: "route_28_roots_16_23", 28, 16)]
#[test_case(name: "route_28_roots_24_31", 28, 24)]
#[test_case(name: "route_29_roots_00_07", 29, 0)]
#[test_case(name: "route_29_roots_08_15", 29, 8)]
#[test_case(name: "route_29_roots_16_23", 29, 16)]
#[test_case(name: "route_29_roots_24_31", 29, 24)]
#[test_case(name: "route_30_roots_00_07", 30, 0)]
#[test_case(name: "route_30_roots_08_15", 30, 8)]
#[test_case(name: "route_30_roots_16_23", 30, 16)]
#[test_case(name: "route_30_roots_24_31", 30, 24)]
#[test_case(name: "route_31_roots_00_07", 31, 0)]
#[test_case(name: "route_31_roots_08_15", 31, 8)]
#[test_case(name: "route_31_roots_16_23", 31, 16)]
#[test_case(name: "route_31_roots_24_31", 31, 24)]
#[test_case(name: "route_32_roots_00_07", 32, 0)]
#[test_case(name: "route_32_roots_08_15", 32, 8)]
#[test_case(name: "route_32_roots_16_23", 32, 16)]
#[test_case(name: "route_32_roots_24_31", 32, 24)]
#[test_case(name: "route_33_roots_00_07", 33, 0)]
#[test_case(name: "route_33_roots_08_15", 33, 8)]
#[test_case(name: "route_33_roots_16_23", 33, 16)]
#[test_case(name: "route_33_roots_24_31", 33, 24)]
#[test_case(name: "route_34_roots_00_07", 34, 0)]
#[test_case(name: "route_34_roots_08_15", 34, 8)]
#[test_case(name: "route_34_roots_16_23", 34, 16)]
#[test_case(name: "route_34_roots_24_31", 34, 24)]
#[test_case(name: "route_35_roots_00_07", 35, 0)]
#[test_case(name: "route_35_roots_08_15", 35, 8)]
#[test_case(name: "route_35_roots_16_23", 35, 16)]
#[test_case(name: "route_35_roots_24_31", 35, 24)]
#[test_case(name: "route_36_roots_00_07", 36, 0)]
#[test_case(name: "route_36_roots_08_15", 36, 8)]
#[test_case(name: "route_36_roots_16_23", 36, 16)]
#[test_case(name: "route_36_roots_24_31", 36, 24)]
#[test_case(name: "route_37_roots_00_07", 37, 0)]
#[test_case(name: "route_37_roots_08_15", 37, 8)]
#[test_case(name: "route_37_roots_16_23", 37, 16)]
#[test_case(name: "route_37_roots_24_31", 37, 24)]
#[test_case(name: "route_38_roots_00_07", 38, 0)]
#[test_case(name: "route_38_roots_08_15", 38, 8)]
#[test_case(name: "route_38_roots_16_23", 38, 16)]
#[test_case(name: "route_38_roots_24_31", 38, 24)]
#[test_case(name: "route_39_roots_00_07", 39, 0)]
#[test_case(name: "route_39_roots_08_15", 39, 8)]
#[test_case(name: "route_39_roots_16_23", 39, 16)]
#[test_case(name: "route_39_roots_24_31", 39, 24)]
#[test_case(name: "route_40_roots_00_07", 40, 0)]
#[test_case(name: "route_40_roots_08_15", 40, 8)]
#[test_case(name: "route_40_roots_16_23", 40, 16)]
#[test_case(name: "route_40_roots_24_31", 40, 24)]
#[test_case(name: "route_41_roots_00_07", 41, 0)]
#[test_case(name: "route_41_roots_08_15", 41, 8)]
#[test_case(name: "route_41_roots_16_23", 41, 16)]
#[test_case(name: "route_41_roots_24_31", 41, 24)]
#[test_case(name: "route_42_roots_00_07", 42, 0)]
#[test_case(name: "route_42_roots_08_15", 42, 8)]
#[test_case(name: "route_42_roots_16_23", 42, 16)]
#[test_case(name: "route_42_roots_24_31", 42, 24)]
#[test_case(name: "route_43_roots_00_07", 43, 0)]
#[test_case(name: "route_43_roots_08_15", 43, 8)]
#[test_case(name: "route_43_roots_16_23", 43, 16)]
#[test_case(name: "route_43_roots_24_31", 43, 24)]
#[test_case(name: "route_44_roots_00_07", 44, 0)]
#[test_case(name: "route_44_roots_08_15", 44, 8)]
#[test_case(name: "route_44_roots_16_23", 44, 16)]
#[test_case(name: "route_44_roots_24_31", 44, 24)]
#[test_case(name: "route_45_roots_00_07", 45, 0)]
#[test_case(name: "route_45_roots_08_15", 45, 8)]
#[test_case(name: "route_45_roots_16_23", 45, 16)]
#[test_case(name: "route_45_roots_24_31", 45, 24)]
#[test_case(name: "route_46_roots_00_07", 46, 0)]
#[test_case(name: "route_46_roots_08_15", 46, 8)]
#[test_case(name: "route_46_roots_16_23", 46, 16)]
#[test_case(name: "route_46_roots_24_31", 46, 24)]
#[test_case(name: "route_47_roots_00_07", 47, 0)]
#[test_case(name: "route_47_roots_08_15", 47, 8)]
#[test_case(name: "route_47_roots_16_23", 47, 16)]
#[test_case(name: "route_47_roots_24_31", 47, 24)]
#[test_case(name: "route_48_roots_00_07", 48, 0)]
#[test_case(name: "route_48_roots_08_15", 48, 8)]
#[test_case(name: "route_48_roots_16_23", 48, 16)]
#[test_case(name: "route_48_roots_24_31", 48, 24)]
#[test_case(name: "route_49_roots_00_07", 49, 0)]
#[test_case(name: "route_49_roots_08_15", 49, 8)]
#[test_case(name: "route_49_roots_16_23", 49, 16)]
#[test_case(name: "route_49_roots_24_31", 49, 24)]
#[test_case(name: "route_50_roots_00_07", 50, 0)]
#[test_case(name: "route_50_roots_08_15", 50, 8)]
#[test_case(name: "route_50_roots_16_23", 50, 16)]
#[test_case(name: "route_50_roots_24_31", 50, 24)]
#[test_case(name: "route_51_roots_00_07", 51, 0)]
#[test_case(name: "route_51_roots_08_15", 51, 8)]
#[test_case(name: "route_51_roots_16_23", 51, 16)]
#[test_case(name: "route_51_roots_24_31", 51, 24)]
#[test_case(name: "route_52_roots_00_07", 52, 0)]
#[test_case(name: "route_52_roots_08_15", 52, 8)]
#[test_case(name: "route_52_roots_16_23", 52, 16)]
#[test_case(name: "route_52_roots_24_31", 52, 24)]
#[test_case(name: "route_53_roots_00_07", 53, 0)]
#[test_case(name: "route_53_roots_08_15", 53, 8)]
#[test_case(name: "route_53_roots_16_23", 53, 16)]
#[test_case(name: "route_53_roots_24_31", 53, 24)]
#[test_case(name: "route_54_roots_00_07", 54, 0)]
#[test_case(name: "route_54_roots_08_15", 54, 8)]
#[test_case(name: "route_54_roots_16_23", 54, 16)]
#[test_case(name: "route_54_roots_24_31", 54, 24)]
#[test_case(name: "route_55_roots_00_07", 55, 0)]
#[test_case(name: "route_55_roots_08_15", 55, 8)]
#[test_case(name: "route_55_roots_16_23", 55, 16)]
#[test_case(name: "route_55_roots_24_31", 55, 24)]
#[test_case(name: "route_56_roots_00_07", 56, 0)]
#[test_case(name: "route_56_roots_08_15", 56, 8)]
#[test_case(name: "route_56_roots_16_23", 56, 16)]
#[test_case(name: "route_56_roots_24_31", 56, 24)]
#[test_case(name: "route_57_roots_00_07", 57, 0)]
#[test_case(name: "route_57_roots_08_15", 57, 8)]
#[test_case(name: "route_57_roots_16_23", 57, 16)]
#[test_case(name: "route_57_roots_24_31", 57, 24)]
#[test_case(name: "route_58_roots_00_07", 58, 0)]
#[test_case(name: "route_58_roots_08_15", 58, 8)]
#[test_case(name: "route_58_roots_16_23", 58, 16)]
#[test_case(name: "route_58_roots_24_31", 58, 24)]
#[test_case(name: "route_59_roots_00_07", 59, 0)]
#[test_case(name: "route_59_roots_08_15", 59, 8)]
#[test_case(name: "route_59_roots_16_23", 59, 16)]
#[test_case(name: "route_59_roots_24_31", 59, 24)]
#[test_case(name: "route_60_roots_00_07", 60, 0)]
#[test_case(name: "route_60_roots_08_15", 60, 8)]
#[test_case(name: "route_60_roots_16_23", 60, 16)]
#[test_case(name: "route_60_roots_24_31", 60, 24)]
#[test_case(name: "route_61_roots_00_07", 61, 0)]
#[test_case(name: "route_61_roots_08_15", 61, 8)]
#[test_case(name: "route_61_roots_16_23", 61, 16)]
#[test_case(name: "route_61_roots_24_31", 61, 24)]
#[test_case(name: "route_62_roots_00_07", 62, 0)]
#[test_case(name: "route_62_roots_08_15", 62, 8)]
#[test_case(name: "route_62_roots_16_23", 62, 16)]
#[test_case(name: "route_62_roots_24_31", 62, 24)]
#[test_case(name: "route_63_roots_00_07", 63, 0)]
#[test_case(name: "route_63_roots_08_15", 63, 8)]
#[test_case(name: "route_63_roots_16_23", 63, 16)]
#[test_case(name: "route_63_roots_24_31", 63, 24)]
#[test_case(name: "route_64_roots_00_07", 64, 0)]
#[test_case(name: "route_64_roots_08_15", 64, 8)]
#[test_case(name: "route_64_roots_16_23", 64, 16)]
#[test_case(name: "route_64_roots_24_31", 64, 24)]
#[test_case(name: "route_65_roots_00_07", 65, 0)]
#[test_case(name: "route_65_roots_08_15", 65, 8)]
#[test_case(name: "route_65_roots_16_23", 65, 16)]
#[test_case(name: "route_65_roots_24_31", 65, 24)]
#[test_case(name: "route_66_roots_00_07", 66, 0)]
#[test_case(name: "route_66_roots_08_15", 66, 8)]
#[test_case(name: "route_66_roots_16_23", 66, 16)]
#[test_case(name: "route_66_roots_24_31", 66, 24)]
#[test_case(name: "route_67_roots_00_07", 67, 0)]
#[test_case(name: "route_67_roots_08_15", 67, 8)]
#[test_case(name: "route_67_roots_16_23", 67, 16)]
#[test_case(name: "route_67_roots_24_31", 67, 24)]
#[test_case(name: "route_68_roots_00_07", 68, 0)]
#[test_case(name: "route_68_roots_08_15", 68, 8)]
#[test_case(name: "route_68_roots_16_23", 68, 16)]
#[test_case(name: "route_68_roots_24_31", 68, 24)]
#[test_case(name: "route_69_roots_00_07", 69, 0)]
#[test_case(name: "route_69_roots_08_15", 69, 8)]
#[test_case(name: "route_69_roots_16_23", 69, 16)]
#[test_case(name: "route_69_roots_24_31", 69, 24)]
#[test_case(name: "route_70_roots_00_07", 70, 0)]
#[test_case(name: "route_70_roots_08_15", 70, 8)]
#[test_case(name: "route_70_roots_16_23", 70, 16)]
#[test_case(name: "route_70_roots_24_31", 70, 24)]
#[test_case(name: "route_71_roots_00_07", 71, 0)]
#[test_case(name: "route_71_roots_08_15", 71, 8)]
#[test_case(name: "route_71_roots_16_23", 71, 16)]
#[test_case(name: "route_71_roots_24_31", 71, 24)]
#[feature("safe_dispatcher")]
fn all_72_typed_entry_refusals_are_root_independent(index: u32, start: u64) {
    let commands = typed_commands();
    assert_eq!(commands.len(), ROUTES);
    assert_eq!(crate::command_routes::COMMAND_ROUTES.span().len(), ROUTES);
    let command = *commands.at(index);
    assert_route(command, index);
    let mut expected = None;
    assert!(start + 8 <= ROOTS);
    for sample in 0_u64..9 {
        let root = if sample == 0 {
            0
        } else {
            start + sample - 1
        };
        let d = fresh_world(false);
        if let Command::WithdrawLords(_) = command {
            snforge_std::start_cheat_transaction_hash(d.games, (100000_u64 + root).into());
        }
        let before = play_fixture::gameplay_snapshot(d.games);
        let (release, preset) = play_fixture::pins(d.games, 1);
        play_fixture::caller(d.games, d.actor, 100);
        let mut spy = snforge_std::spy_events();
        let error = IPlayFixtureSafeDispatcher { contract_address: d.games }
            .play_with_root(1, release, preset, play_fixture::encode(command), root.into())
            .unwrap_err();
        if let Some(previous) = expected {
            assert_eq!(error.span(), previous);
        }
        expected = Some(error.span());
        assert_eq!(play_fixture::gameplay_snapshot(d.games), before);
        assert!(spy.get_events().emitted_by(d.games).events.is_empty());
    }
}

#[test_case(name: "route_00_roots_00_07", 0, 0)]
#[test_case(name: "route_00_roots_08_15", 0, 8)]
#[test_case(name: "route_00_roots_16_23", 0, 16)]
#[test_case(name: "route_00_roots_24_31", 0, 24)]
#[test_case(name: "route_01_roots_00_07", 1, 0)]
#[test_case(name: "route_01_roots_08_15", 1, 8)]
#[test_case(name: "route_01_roots_16_23", 1, 16)]
#[test_case(name: "route_01_roots_24_31", 1, 24)]
#[test_case(name: "route_02_roots_00_07", 2, 0)]
#[test_case(name: "route_02_roots_08_15", 2, 8)]
#[test_case(name: "route_02_roots_16_23", 2, 16)]
#[test_case(name: "route_02_roots_24_31", 2, 24)]
#[test_case(name: "route_03_roots_00_07", 3, 0)]
#[test_case(name: "route_03_roots_08_15", 3, 8)]
#[test_case(name: "route_03_roots_16_23", 3, 16)]
#[test_case(name: "route_03_roots_24_31", 3, 24)]
#[test_case(name: "route_04_roots_00_07", 4, 0)]
#[test_case(name: "route_04_roots_08_15", 4, 8)]
#[test_case(name: "route_04_roots_16_23", 4, 16)]
#[test_case(name: "route_04_roots_24_31", 4, 24)]
#[test_case(name: "route_05_roots_00_07", 5, 0)]
#[test_case(name: "route_05_roots_08_15", 5, 8)]
#[test_case(name: "route_05_roots_16_23", 5, 16)]
#[test_case(name: "route_05_roots_24_31", 5, 24)]
#[test_case(name: "route_06_roots_00_07", 6, 0)]
#[test_case(name: "route_06_roots_08_15", 6, 8)]
#[test_case(name: "route_06_roots_16_23", 6, 16)]
#[test_case(name: "route_06_roots_24_31", 6, 24)]
#[test_case(name: "route_07_roots_00_07", 7, 0)]
#[test_case(name: "route_07_roots_08_15", 7, 8)]
#[test_case(name: "route_07_roots_16_23", 7, 16)]
#[test_case(name: "route_07_roots_24_31", 7, 24)]
#[test_case(name: "route_08_roots_00_07", 8, 0)]
#[test_case(name: "route_08_roots_08_15", 8, 8)]
#[test_case(name: "route_08_roots_16_23", 8, 16)]
#[test_case(name: "route_08_roots_24_31", 8, 24)]
#[test_case(name: "route_09_roots_00_07", 9, 0)]
#[test_case(name: "route_09_roots_08_15", 9, 8)]
#[test_case(name: "route_09_roots_16_23", 9, 16)]
#[test_case(name: "route_09_roots_24_31", 9, 24)]
#[test_case(name: "route_10_roots_00_07", 10, 0)]
#[test_case(name: "route_10_roots_08_15", 10, 8)]
#[test_case(name: "route_10_roots_16_23", 10, 16)]
#[test_case(name: "route_10_roots_24_31", 10, 24)]
#[test_case(name: "route_11_roots_00_07", 11, 0)]
#[test_case(name: "route_11_roots_08_15", 11, 8)]
#[test_case(name: "route_11_roots_16_23", 11, 16)]
#[test_case(name: "route_11_roots_24_31", 11, 24)]
#[test_case(name: "route_12_roots_00_07", 12, 0)]
#[test_case(name: "route_12_roots_08_15", 12, 8)]
#[test_case(name: "route_12_roots_16_23", 12, 16)]
#[test_case(name: "route_12_roots_24_31", 12, 24)]
#[test_case(name: "route_13_roots_00_07", 13, 0)]
#[test_case(name: "route_13_roots_08_15", 13, 8)]
#[test_case(name: "route_13_roots_16_23", 13, 16)]
#[test_case(name: "route_13_roots_24_31", 13, 24)]
#[test_case(name: "route_14_roots_00_07", 14, 0)]
#[test_case(name: "route_14_roots_08_15", 14, 8)]
#[test_case(name: "route_14_roots_16_23", 14, 16)]
#[test_case(name: "route_14_roots_24_31", 14, 24)]
#[test_case(name: "route_15_roots_00_07", 15, 0)]
#[test_case(name: "route_15_roots_08_15", 15, 8)]
#[test_case(name: "route_15_roots_16_23", 15, 16)]
#[test_case(name: "route_15_roots_24_31", 15, 24)]
#[test_case(name: "route_16_roots_00_07", 16, 0)]
#[test_case(name: "route_16_roots_08_15", 16, 8)]
#[test_case(name: "route_16_roots_16_23", 16, 16)]
#[test_case(name: "route_16_roots_24_31", 16, 24)]
#[test_case(name: "route_17_roots_00_07", 17, 0)]
#[test_case(name: "route_17_roots_08_15", 17, 8)]
#[test_case(name: "route_17_roots_16_23", 17, 16)]
#[test_case(name: "route_17_roots_24_31", 17, 24)]
#[test_case(name: "route_18_roots_00_07", 18, 0)]
#[test_case(name: "route_18_roots_08_15", 18, 8)]
#[test_case(name: "route_18_roots_16_23", 18, 16)]
#[test_case(name: "route_18_roots_24_31", 18, 24)]
#[test_case(name: "route_19_roots_00_07", 19, 0)]
#[test_case(name: "route_19_roots_08_15", 19, 8)]
#[test_case(name: "route_19_roots_16_23", 19, 16)]
#[test_case(name: "route_19_roots_24_31", 19, 24)]
#[test_case(name: "route_20_roots_00_07", 20, 0)]
#[test_case(name: "route_20_roots_08_15", 20, 8)]
#[test_case(name: "route_20_roots_16_23", 20, 16)]
#[test_case(name: "route_20_roots_24_31", 20, 24)]
#[test_case(name: "route_21_roots_00_07", 21, 0)]
#[test_case(name: "route_21_roots_08_15", 21, 8)]
#[test_case(name: "route_21_roots_16_23", 21, 16)]
#[test_case(name: "route_21_roots_24_31", 21, 24)]
#[test_case(name: "route_22_roots_00_07", 22, 0)]
#[test_case(name: "route_22_roots_08_15", 22, 8)]
#[test_case(name: "route_22_roots_16_23", 22, 16)]
#[test_case(name: "route_22_roots_24_31", 22, 24)]
#[test_case(name: "route_23_roots_00_07", 23, 0)]
#[test_case(name: "route_23_roots_08_15", 23, 8)]
#[test_case(name: "route_23_roots_16_23", 23, 16)]
#[test_case(name: "route_23_roots_24_31", 23, 24)]
#[test_case(name: "route_24_roots_00_07", 24, 0)]
#[test_case(name: "route_24_roots_08_15", 24, 8)]
#[test_case(name: "route_24_roots_16_23", 24, 16)]
#[test_case(name: "route_24_roots_24_31", 24, 24)]
#[test_case(name: "route_25_roots_00_07", 25, 0)]
#[test_case(name: "route_25_roots_08_15", 25, 8)]
#[test_case(name: "route_25_roots_16_23", 25, 16)]
#[test_case(name: "route_25_roots_24_31", 25, 24)]
#[test_case(name: "route_26_roots_00_07", 26, 0)]
#[test_case(name: "route_26_roots_08_15", 26, 8)]
#[test_case(name: "route_26_roots_16_23", 26, 16)]
#[test_case(name: "route_26_roots_24_31", 26, 24)]
#[test_case(name: "route_27_roots_00_07", 27, 0)]
#[test_case(name: "route_27_roots_08_15", 27, 8)]
#[test_case(name: "route_27_roots_16_23", 27, 16)]
#[test_case(name: "route_27_roots_24_31", 27, 24)]
#[test_case(name: "route_28_roots_00_07", 28, 0)]
#[test_case(name: "route_28_roots_08_15", 28, 8)]
#[test_case(name: "route_28_roots_16_23", 28, 16)]
#[test_case(name: "route_28_roots_24_31", 28, 24)]
#[test_case(name: "route_29_roots_00_07", 29, 0)]
#[test_case(name: "route_29_roots_08_15", 29, 8)]
#[test_case(name: "route_29_roots_16_23", 29, 16)]
#[test_case(name: "route_29_roots_24_31", 29, 24)]
#[test_case(name: "route_30_roots_00_07", 30, 0)]
#[test_case(name: "route_30_roots_08_15", 30, 8)]
#[test_case(name: "route_30_roots_16_23", 30, 16)]
#[test_case(name: "route_30_roots_24_31", 30, 24)]
#[test_case(name: "route_31_roots_00_07", 31, 0)]
#[test_case(name: "route_31_roots_08_15", 31, 8)]
#[test_case(name: "route_31_roots_16_23", 31, 16)]
#[test_case(name: "route_31_roots_24_31", 31, 24)]
#[test_case(name: "route_32_roots_00_07", 32, 0)]
#[test_case(name: "route_32_roots_08_15", 32, 8)]
#[test_case(name: "route_32_roots_16_23", 32, 16)]
#[test_case(name: "route_32_roots_24_31", 32, 24)]
#[test_case(name: "route_33_roots_00_07", 33, 0)]
#[test_case(name: "route_33_roots_08_15", 33, 8)]
#[test_case(name: "route_33_roots_16_23", 33, 16)]
#[test_case(name: "route_33_roots_24_31", 33, 24)]
#[test_case(name: "route_34_roots_00_07", 34, 0)]
#[test_case(name: "route_34_roots_08_15", 34, 8)]
#[test_case(name: "route_34_roots_16_23", 34, 16)]
#[test_case(name: "route_34_roots_24_31", 34, 24)]
#[test_case(name: "route_35_roots_00_07", 35, 0)]
#[test_case(name: "route_35_roots_08_15", 35, 8)]
#[test_case(name: "route_35_roots_16_23", 35, 16)]
#[test_case(name: "route_35_roots_24_31", 35, 24)]
#[test_case(name: "route_36_roots_00_07", 36, 0)]
#[test_case(name: "route_36_roots_08_15", 36, 8)]
#[test_case(name: "route_36_roots_16_23", 36, 16)]
#[test_case(name: "route_36_roots_24_31", 36, 24)]
#[test_case(name: "route_37_roots_00_07", 37, 0)]
#[test_case(name: "route_37_roots_08_15", 37, 8)]
#[test_case(name: "route_37_roots_16_23", 37, 16)]
#[test_case(name: "route_37_roots_24_31", 37, 24)]
#[test_case(name: "route_38_roots_00_07", 38, 0)]
#[test_case(name: "route_38_roots_08_15", 38, 8)]
#[test_case(name: "route_38_roots_16_23", 38, 16)]
#[test_case(name: "route_38_roots_24_31", 38, 24)]
#[test_case(name: "route_39_roots_00_07", 39, 0)]
#[test_case(name: "route_39_roots_08_15", 39, 8)]
#[test_case(name: "route_39_roots_16_23", 39, 16)]
#[test_case(name: "route_39_roots_24_31", 39, 24)]
#[test_case(name: "route_40_roots_00_07", 40, 0)]
#[test_case(name: "route_40_roots_08_15", 40, 8)]
#[test_case(name: "route_40_roots_16_23", 40, 16)]
#[test_case(name: "route_40_roots_24_31", 40, 24)]
#[test_case(name: "route_41_roots_00_07", 41, 0)]
#[test_case(name: "route_41_roots_08_15", 41, 8)]
#[test_case(name: "route_41_roots_16_23", 41, 16)]
#[test_case(name: "route_41_roots_24_31", 41, 24)]
#[test_case(name: "route_42_roots_00_07", 42, 0)]
#[test_case(name: "route_42_roots_08_15", 42, 8)]
#[test_case(name: "route_42_roots_16_23", 42, 16)]
#[test_case(name: "route_42_roots_24_31", 42, 24)]
#[test_case(name: "route_43_roots_00_07", 43, 0)]
#[test_case(name: "route_43_roots_08_15", 43, 8)]
#[test_case(name: "route_43_roots_16_23", 43, 16)]
#[test_case(name: "route_43_roots_24_31", 43, 24)]
#[test_case(name: "route_44_roots_00_07", 44, 0)]
#[test_case(name: "route_44_roots_08_15", 44, 8)]
#[test_case(name: "route_44_roots_16_23", 44, 16)]
#[test_case(name: "route_44_roots_24_31", 44, 24)]
#[test_case(name: "route_45_roots_00_07", 45, 0)]
#[test_case(name: "route_45_roots_08_15", 45, 8)]
#[test_case(name: "route_45_roots_16_23", 45, 16)]
#[test_case(name: "route_45_roots_24_31", 45, 24)]
#[test_case(name: "route_46_roots_00_07", 46, 0)]
#[test_case(name: "route_46_roots_08_15", 46, 8)]
#[test_case(name: "route_46_roots_16_23", 46, 16)]
#[test_case(name: "route_46_roots_24_31", 46, 24)]
#[test_case(name: "route_47_roots_00_07", 47, 0)]
#[test_case(name: "route_47_roots_08_15", 47, 8)]
#[test_case(name: "route_47_roots_16_23", 47, 16)]
#[test_case(name: "route_47_roots_24_31", 47, 24)]
#[test_case(name: "route_48_roots_00_07", 48, 0)]
#[test_case(name: "route_48_roots_08_15", 48, 8)]
#[test_case(name: "route_48_roots_16_23", 48, 16)]
#[test_case(name: "route_48_roots_24_31", 48, 24)]
#[test_case(name: "route_49_roots_00_07", 49, 0)]
#[test_case(name: "route_49_roots_08_15", 49, 8)]
#[test_case(name: "route_49_roots_16_23", 49, 16)]
#[test_case(name: "route_49_roots_24_31", 49, 24)]
#[test_case(name: "route_50_roots_00_07", 50, 0)]
#[test_case(name: "route_50_roots_08_15", 50, 8)]
#[test_case(name: "route_50_roots_16_23", 50, 16)]
#[test_case(name: "route_50_roots_24_31", 50, 24)]
#[test_case(name: "route_51_roots_00_07", 51, 0)]
#[test_case(name: "route_51_roots_08_15", 51, 8)]
#[test_case(name: "route_51_roots_16_23", 51, 16)]
#[test_case(name: "route_51_roots_24_31", 51, 24)]
#[test_case(name: "route_52_roots_00_07", 52, 0)]
#[test_case(name: "route_52_roots_08_15", 52, 8)]
#[test_case(name: "route_52_roots_16_23", 52, 16)]
#[test_case(name: "route_52_roots_24_31", 52, 24)]
#[test_case(name: "route_53_roots_00_07", 53, 0)]
#[test_case(name: "route_53_roots_08_15", 53, 8)]
#[test_case(name: "route_53_roots_16_23", 53, 16)]
#[test_case(name: "route_53_roots_24_31", 53, 24)]
#[test_case(name: "route_54_roots_00_07", 54, 0)]
#[test_case(name: "route_54_roots_08_15", 54, 8)]
#[test_case(name: "route_54_roots_16_23", 54, 16)]
#[test_case(name: "route_54_roots_24_31", 54, 24)]
#[test_case(name: "route_55_roots_00_07", 55, 0)]
#[test_case(name: "route_55_roots_08_15", 55, 8)]
#[test_case(name: "route_55_roots_16_23", 55, 16)]
#[test_case(name: "route_55_roots_24_31", 55, 24)]
#[test_case(name: "route_56_roots_00_07", 56, 0)]
#[test_case(name: "route_56_roots_08_15", 56, 8)]
#[test_case(name: "route_56_roots_16_23", 56, 16)]
#[test_case(name: "route_56_roots_24_31", 56, 24)]
#[test_case(name: "route_57_roots_00_07", 57, 0)]
#[test_case(name: "route_57_roots_08_15", 57, 8)]
#[test_case(name: "route_57_roots_16_23", 57, 16)]
#[test_case(name: "route_57_roots_24_31", 57, 24)]
#[test_case(name: "route_58_roots_00_07", 58, 0)]
#[test_case(name: "route_58_roots_08_15", 58, 8)]
#[test_case(name: "route_58_roots_16_23", 58, 16)]
#[test_case(name: "route_58_roots_24_31", 58, 24)]
#[test_case(name: "route_59_roots_00_07", 59, 0)]
#[test_case(name: "route_59_roots_08_15", 59, 8)]
#[test_case(name: "route_59_roots_16_23", 59, 16)]
#[test_case(name: "route_59_roots_24_31", 59, 24)]
#[test_case(name: "route_60_roots_00_07", 60, 0)]
#[test_case(name: "route_60_roots_08_15", 60, 8)]
#[test_case(name: "route_60_roots_16_23", 60, 16)]
#[test_case(name: "route_60_roots_24_31", 60, 24)]
#[test_case(name: "route_61_roots_00_07", 61, 0)]
#[test_case(name: "route_61_roots_08_15", 61, 8)]
#[test_case(name: "route_61_roots_16_23", 61, 16)]
#[test_case(name: "route_61_roots_24_31", 61, 24)]
#[test_case(name: "route_62_roots_00_07", 62, 0)]
#[test_case(name: "route_62_roots_08_15", 62, 8)]
#[test_case(name: "route_62_roots_16_23", 62, 16)]
#[test_case(name: "route_62_roots_24_31", 62, 24)]
#[test_case(name: "route_63_roots_00_07", 63, 0)]
#[test_case(name: "route_63_roots_08_15", 63, 8)]
#[test_case(name: "route_63_roots_16_23", 63, 16)]
#[test_case(name: "route_63_roots_24_31", 63, 24)]
#[test_case(name: "route_64_roots_00_07", 64, 0)]
#[test_case(name: "route_64_roots_08_15", 64, 8)]
#[test_case(name: "route_64_roots_16_23", 64, 16)]
#[test_case(name: "route_64_roots_24_31", 64, 24)]
#[test_case(name: "route_65_roots_00_07", 65, 0)]
#[test_case(name: "route_65_roots_08_15", 65, 8)]
#[test_case(name: "route_65_roots_16_23", 65, 16)]
#[test_case(name: "route_65_roots_24_31", 65, 24)]
#[test_case(name: "route_66_roots_00_07", 66, 0)]
#[test_case(name: "route_66_roots_08_15", 66, 8)]
#[test_case(name: "route_66_roots_16_23", 66, 16)]
#[test_case(name: "route_66_roots_24_31", 66, 24)]
#[test_case(name: "route_67_roots_00_07", 67, 0)]
#[test_case(name: "route_67_roots_08_15", 67, 8)]
#[test_case(name: "route_67_roots_16_23", 67, 16)]
#[test_case(name: "route_67_roots_24_31", 67, 24)]
#[test_case(name: "route_68_roots_00_07", 68, 0)]
#[test_case(name: "route_68_roots_08_15", 68, 8)]
#[test_case(name: "route_68_roots_16_23", 68, 16)]
#[test_case(name: "route_68_roots_24_31", 68, 24)]
#[test_case(name: "route_69_roots_00_07", 69, 0)]
#[test_case(name: "route_69_roots_08_15", 69, 8)]
#[test_case(name: "route_69_roots_16_23", 69, 16)]
#[test_case(name: "route_69_roots_24_31", 69, 24)]
#[test_case(name: "route_70_roots_00_07", 70, 0)]
#[test_case(name: "route_70_roots_08_15", 70, 8)]
#[test_case(name: "route_70_roots_16_23", 70, 16)]
#[test_case(name: "route_70_roots_24_31", 70, 24)]
#[test_case(name: "route_71_roots_00_07", 71, 0)]
#[test_case(name: "route_71_roots_08_15", 71, 8)]
#[test_case(name: "route_71_roots_16_23", 71, 16)]
#[test_case(name: "route_71_roots_24_31", 71, 24)]
fn all_72_real_domain_verdicts_are_root_independent(index: u32, start: u64) {
    let commands = typed_commands();
    assert_eq!(commands.len(), ROUTES);
    let command = *commands.at(index);
    assert_route(command, index);
    let mut expected = None;
    assert!(start + 8 <= ROOTS);
    for sample in 0_u64..9 {
        let root = if sample == 0 {
            0
        } else {
            start + sample - 1
        };
        let d = fresh_world(true);
        if let Command::WithdrawLords(_) = command {
            snforge_std::start_cheat_transaction_hash(d.games, (200000_u64 + root).into());
        }
        let mut spy = snforge_std::spy_events();
        let applied = play_fixture::play(d.games, TestAction { game_id: 1, actor: d.actor, command }, root.into(), 100);
        if let Some(previous) = expected {
            assert_eq!(applied, previous, "route {} root {}", index, root);
        }
        expected = Some(applied);
        if !applied {
            let rejected = play_fixture::rejection(ref spy, d.games);
            assert_eq!(rejected.status_class, 'GAMEPLAY_REJECTED');
            assert_eq!(rejected.actor, d.actor);
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
            let command = Command::SettleVillage(
                crate::village::SettleVillage { pass_id: 7, connected_realm_entity_id: home },
            );
            (d, TestAction { game_id: 3, actor: d.actor, command }, 100)
        },
        _ => panic!("unknown draw case"),
    }
}

fn explorer_case(explore: bool) -> (Deployment, TestAction, u64) {
    let (d, home) = super::camps::setup(false);
    for resource in array![26_u8, 35, 36] {
        super::resource_commands::grant(d, home, resource, 100 * crate::rules::RESOURCE_PRECISION);
    }
    let create = Command::CreateExplorer(
        crate::commands::CreateExplorer {
            structure_id: home.entity_id, category: 0, tier: 0, amount: crate::rules::RESOURCE_PRECISION, direction: 0,
        },
    );
    let command = if explore {
        assert!(super::resource_commands::execute(d, create, 80));
        let army = crate::tests::state::StructureObservationTrait::home_armies(
            crate::structures::IStructureOperationsDispatcher { contract_address: d.games }, home,
        );
        Command::Explore(crate::commands::Explore { explorer_id: *army.at(0), direction: 0 })
    } else {
        create
    };
    (d, TestAction { game_id: 3, actor: d.actor, command }, 140)
}

fn battle_case() -> (Deployment, TestAction, u64) {
    let (d, _, _, attacker, defender) = super::combat_actions::setup_with_cooldown(
        false, 0, super::play_fixture::ETERNUM_RULES | crate::rules::COMBAT_DICE, 0, (1000, 1000),
    );
    let command = Command::Battle(
        crate::combat_actions::AttackExplorer {
            attacker_id: attacker, defender_id: defender, steal_resources: array![].span(),
        },
    );
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
    let game_id = crate::registrar::IRegistrarDispatcherTrait::create_game(
        registrar, crate::registrar::CreateGameParams { dev_mode_on: true, ..super::registrar::params(false) },
    );
    play_fixture::prepare_homes(d.games, game_id, d.actor);
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("catalogue_count"), array![].span(), 8000_u32,
    );
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("traits"), array![1].span(), 0x4000001_u32,
    );
    let command = Command::SettleSeason(
        crate::realms::SettleSeason { name: 'root-independent', selected_realm: Some(1) },
    );
    (d, TestAction { game_id, actor: d.actor, command }, 350)
}

#[test_case(name: "route_00_roots_00_07", 0, 0)]
#[test_case(name: "route_00_roots_08_15", 0, 8)]
#[test_case(name: "route_00_roots_16_23", 0, 16)]
#[test_case(name: "route_00_roots_24_31", 0, 24)]
#[test_case(name: "route_01_roots_00_07", 1, 0)]
#[test_case(name: "route_01_roots_08_15", 1, 8)]
#[test_case(name: "route_01_roots_16_23", 1, 16)]
#[test_case(name: "route_01_roots_24_31", 1, 24)]
#[test_case(name: "route_02_roots_00_07", 2, 0)]
#[test_case(name: "route_02_roots_08_15", 2, 8)]
#[test_case(name: "route_02_roots_16_23", 2, 16)]
#[test_case(name: "route_02_roots_24_31", 2, 24)]
#[test_case(name: "route_03_roots_00_07", 3, 0)]
#[test_case(name: "route_03_roots_08_15", 3, 8)]
#[test_case(name: "route_03_roots_16_23", 3, 16)]
#[test_case(name: "route_03_roots_24_31", 3, 24)]
#[test_case(name: "route_04_roots_00_07", 4, 0)]
#[test_case(name: "route_04_roots_08_15", 4, 8)]
#[test_case(name: "route_04_roots_16_23", 4, 16)]
#[test_case(name: "route_04_roots_24_31", 4, 24)]
#[test_case(name: "route_05_roots_00_07", 5, 0)]
#[test_case(name: "route_05_roots_08_15", 5, 8)]
#[test_case(name: "route_05_roots_16_23", 5, 16)]
#[test_case(name: "route_05_roots_24_31", 5, 24)]
#[test_case(name: "route_06_roots_00_07", 6, 0)]
#[test_case(name: "route_06_roots_08_15", 6, 8)]
#[test_case(name: "route_06_roots_16_23", 6, 16)]
#[test_case(name: "route_06_roots_24_31", 6, 24)]
fn successful_real_draw_paths_stay_applied_across_32_roots(case: u8, start: u64) {
    assert!(start + 8 <= ROOTS);
    for root in start..start + 8 {
        let (d, action, timestamp) = draw_case(case);
        let mut spy = snforge_std::spy_events();
        assert!(play_fixture::play(d.games, action, root.into(), timestamp), "case {} root {}", case, root);
        for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
            assert_ne!(*event.keys.at(0), selector!("GameplayRejected"));
        }
    }
}

fn live_loot_case(raid: bool, insufficient: bool, full: bool) -> (Deployment, TestAction) {
    let (d, _, target, attacker, defender) = super::combat_actions::setup_with_cooldown(
        false, 0, super::play_fixture::ETERNUM_RULES | crate::rules::COMBAT_DICE, 0, (1000, 1000),
    );
    let from = if raid {
        target.entity_id
    } else {
        defender
    };
    super::resource_commands::grant(d, crate::resources::ResourceKey { game_id: 3, entity_id: from }, 2, 90);
    if raid {
        super::combat_actions::set_guard(d, target, 0, 1000);
    }
    if full {
        let key = crate::resources::ResourceKey { game_id: 3, entity_id: attacker };
        let free = snforge_std::interact_with_state(
            d.games,
            || {
                let weight = crate::state::read().resources.weights.read((3, attacker));
                weight.capacity - weight.weight
            },
        );
        // Fill the real army's carrying capacity; a zero capacity cannot survive casualty deductions.
        super::resource_commands::grant(d, key, 1, free);
    }
    let loot = array![crate::resources::ResourceAmount { resource_type: 2, amount: if insufficient {
        91
    } else {
        70
    } }]
        .span();
    let command = if raid {
        Command::Raid(
            crate::combat_actions::Raid {
                explorer_id: attacker, structure_id: target.entity_id, steal_resources: loot,
            },
        )
    } else {
        Command::Battle(
            crate::combat_actions::AttackExplorer {
                attacker_id: attacker, defender_id: defender, steal_resources: loot,
            },
        )
    };
    (d, TestAction { game_id: 3, actor: d.actor, command })
}

#[test_case(name: "raid_0_missing_0_full_0_roots_0", false, false, false, 0)]
#[test_case(name: "raid_0_missing_0_full_0_roots_8", false, false, false, 8)]
#[test_case(name: "raid_0_missing_0_full_0_roots_16", false, false, false, 16)]
#[test_case(name: "raid_0_missing_0_full_0_roots_24", false, false, false, 24)]
#[test_case(name: "raid_0_missing_0_full_1_roots_0", false, false, true, 0)]
#[test_case(name: "raid_0_missing_0_full_1_roots_8", false, false, true, 8)]
#[test_case(name: "raid_0_missing_0_full_1_roots_16", false, false, true, 16)]
#[test_case(name: "raid_0_missing_0_full_1_roots_24", false, false, true, 24)]
#[test_case(name: "raid_0_missing_1_full_0_roots_0", false, true, false, 0)]
#[test_case(name: "raid_0_missing_1_full_0_roots_8", false, true, false, 8)]
#[test_case(name: "raid_0_missing_1_full_0_roots_16", false, true, false, 16)]
#[test_case(name: "raid_0_missing_1_full_0_roots_24", false, true, false, 24)]
#[test_case(name: "raid_0_missing_1_full_1_roots_0", false, true, true, 0)]
#[test_case(name: "raid_0_missing_1_full_1_roots_8", false, true, true, 8)]
#[test_case(name: "raid_0_missing_1_full_1_roots_16", false, true, true, 16)]
#[test_case(name: "raid_0_missing_1_full_1_roots_24", false, true, true, 24)]
#[test_case(name: "raid_1_missing_0_full_0_roots_0", true, false, false, 0)]
#[test_case(name: "raid_1_missing_0_full_0_roots_8", true, false, false, 8)]
#[test_case(name: "raid_1_missing_0_full_0_roots_16", true, false, false, 16)]
#[test_case(name: "raid_1_missing_0_full_0_roots_24", true, false, false, 24)]
#[test_case(name: "raid_1_missing_0_full_1_roots_0", true, false, true, 0)]
#[test_case(name: "raid_1_missing_0_full_1_roots_8", true, false, true, 8)]
#[test_case(name: "raid_1_missing_0_full_1_roots_16", true, false, true, 16)]
#[test_case(name: "raid_1_missing_0_full_1_roots_24", true, false, true, 24)]
#[test_case(name: "raid_1_missing_1_full_0_roots_0", true, true, false, 0)]
#[test_case(name: "raid_1_missing_1_full_0_roots_8", true, true, false, 8)]
#[test_case(name: "raid_1_missing_1_full_0_roots_16", true, true, false, 16)]
#[test_case(name: "raid_1_missing_1_full_0_roots_24", true, true, false, 24)]
#[test_case(name: "raid_1_missing_1_full_1_roots_0", true, true, true, 0)]
#[test_case(name: "raid_1_missing_1_full_1_roots_8", true, true, true, 8)]
#[test_case(name: "raid_1_missing_1_full_1_roots_16", true, true, true, 16)]
#[test_case(name: "raid_1_missing_1_full_1_roots_24", true, true, true, 24)]
fn real_battle_and_guarded_raid_loot_verdicts_do_not_select_a_roll(
    raid: bool, insufficient: bool, full: bool, start: u64,
) {
    assert!(start + 8 <= ROOTS);
    for root in start..start + 8 {
        let (d, action) = live_loot_case(raid, insufficient, full);
        let before = play_fixture::gameplay_snapshot(d.games);
        let applied = play_fixture::play(d.games, action, root.into(), 80);
        assert_eq!(applied, !insufficient, "raid {} missing {} full {} root {}", raid, insufficient, full, root);
        if !applied {
            assert_eq!(play_fixture::gameplay_snapshot(d.games), before);
        }
    }
}

#[test_case(name: "capacity_full_roots_0", 0, 0)]
#[test_case(name: "capacity_full_roots_8", 0, 8)]
#[test_case(name: "capacity_full_roots_16", 0, 16)]
#[test_case(name: "capacity_full_roots_24", 0, 24)]
#[test_case(name: "capacity_fractional_roots_0", crate::rules::RESOURCE_PRECISION - 1, 0)]
#[test_case(name: "capacity_fractional_roots_8", crate::rules::RESOURCE_PRECISION - 1, 8)]
#[test_case(name: "capacity_fractional_roots_16", crate::rules::RESOURCE_PRECISION - 1, 16)]
#[test_case(name: "capacity_fractional_roots_24", crate::rules::RESOURCE_PRECISION - 1, 24)]
fn real_movement_reward_stays_applied_at_full_and_fractional_stores(capacity: u128, start: u64) {
    assert!(start + 8 <= ROOTS);
    for root in start..start + 8 {
        let (d, action, timestamp) = explorer_case(true);
        snforge_std::interact_with_state(
            d.games,
            || {
                let explorer = crate::logic::troops::explorer(
                    crate::troops::ExplorerKey {
                        game_id: action.game_id,
                        explorer_id: match action.command {
                            Command::Explore(value) => value.explorer_id,
                            _ => panic!("explore fixture required"),
                        },
                    },
                )
                    .unwrap();
                let key = crate::resources::ResourceKey { game_id: action.game_id, entity_id: explorer.owner };
                let mut weight = 0;
                for resource_type in 1_u8..59 {
                    weight += crate::logic::resources::balance(key, resource_type)
                        * crate::logic::resources::rule(action.game_id, resource_type).unit_weight;
                }
                // The fixture normally has unlimited capacity and does not track weight. Reconstruct it before
                // switching to finite stores so spending real wheat and fish cannot underflow the held weight.
                crate::state::write()
                    .resources
                    .weights
                    .write(
                        (action.game_id, explorer.owner),
                        crate::resources::Weight { capacity: weight + capacity, weight },
                    );
            },
        );
        assert!(play_fixture::play(d.games, action, root.into(), timestamp), "capacity {} root {}", capacity, root);
    }
}
