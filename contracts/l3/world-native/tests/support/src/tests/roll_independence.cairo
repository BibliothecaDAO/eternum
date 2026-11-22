pub use snforge_std::{EventSpyTrait, EventsFilterTrait};
pub use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerWriteAccess};
pub use crate::commands::Command;
pub use crate::tests::play_fixture::{IPlayFixtureSafeDispatcher, IPlayFixtureSafeDispatcherTrait, TestAction};
pub use crate::tests::{Deployment, play_fixture};
pub fn routes() -> u32 {
    crate::command_routes::COMMAND_IDS.span().len()
}
pub const ROOTS: u64 = 32;
// Every value is a fully typed command. Missing entities and unavailable lifecycle transitions exercise domain
// refusals.
pub fn typed_commands() -> Array<Command> {
    array![
        Command::BuySeal(()), Command::BuyStamina(crate::fragments::BuyStamina { explorer_id: 999999, fragments: 1 }),
        Command::ChooseOath(
            crate::oaths::ChooseOath { explorer_id: 999999, expected_pick: 571, oath: None, replace: None },
        ),
        Command::RerollOath(crate::oaths::RerollOath { explorer_id: 999999, expected_pick: 571, index: 0 }),
        Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home: 999999, day: 0 }),
        Command::CreateExplorer(
            crate::commands::CreateExplorer {
                slot: 0, structure_id: 999999, category: 0, tier: 0, amount: 1, direction: 0,
            },
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
        Command::LevelUp(999999), Command::ProvisionRealm(999999),
        Command::SettleSeason(crate::realms::SettleSeason { selected_realm: None, order: None }),
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
        Command::BattleGuard(crate::commands::Battle { attacker_id: 999999, defender_id: 999999, relic_slot: None }),
        Command::ApplyRelic(
            crate::relics::ApplyRelic {
                entity_id: 999999, relic_id: 39, recipient: crate::relics::Recipient::Explorer,
            },
        ),
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
        Command::ProvisionAndUpgradeRealm(999999),
        Command::SetEntityName(crate::names::SetEntityName { entity_id: 999999, name: 'route' }),
        Command::EnterDepth(crate::commands::EnterDepth { explorer_id: 999999, depth: 0 }),
        Command::Research(crate::research::Research { structure_id: 999999, row: 0 }),
        Command::InteractSite(
            crate::relics::InteractSite {
                explorer_id: 999999, coord: crate::troops::Coord { alt: false, x: 2000000, y: 2000000 },
            },
        ),
    ]
}
pub fn fresh_world() -> Deployment {
    super::setup_with_domains(true, "StructuresLogic", "TroopsLogic")
}
#[derive(Drop, PartialEq, Debug)]
pub enum Verdict {
    Applied,
    Rejected: ByteArray,
    Refused: Array<felt252>,
}
#[feature("safe_dispatcher")]
pub fn verdict(games: starknet::ContractAddress, action: TestAction, root: u256, timestamp: u64) -> Verdict {
    let release = play_fixture::pins(games, action.game_id);
    play_fixture::caller(games, action.actor, timestamp);
    let fixture = IPlayFixtureSafeDispatcher { contract_address: games };
    let mut spy = snforge_std::spy_events();
    let played = fixture.play_with_root(action.game_id, release, play_fixture::encode(action.command), root);
    match played {
        Ok(()) => if fixture.last_applied().unwrap() {
            Verdict::Applied
        } else {
            let rejected = play_fixture::rejection(ref spy, games);
            assert_eq!(rejected.status_class, 'GAMEPLAY_REJECTED');
            assert_eq!(rejected.actor, action.actor);
            Verdict::Rejected(rejected.reason)
        },
        Err(error) => Verdict::Refused(error),
    }
}
pub fn release_enables(index: u32) -> bool {
    let id = *crate::command_routes::COMMAND_IDS.span().at(index);
    crate::rules::command_enabled(crate::balance::rules::SWITCHES.command_mask, id.into())
}
pub fn assert_route(command: Command, index: u32) {
    let encoded = play_fixture::encode(command);
    let (actual, _, _) = crate::commands::validated_command(encoded).expect('INVALID_TYPED_VECTOR');
    assert_eq!(actual, *crate::command_routes::COMMAND_IDS.span().at(index));
}
pub fn draw_case(case: u8) -> (Deployment, TestAction, u64) {
    match case {
        0 => explorer_case(false),
        1 => explorer_case(true),
        2 => battle_case(),
        3 => season_case(),
        _ => panic!("unknown draw case"),
    }
}
pub fn explorer_case(explore: bool) -> (Deployment, TestAction, u64) {
    let (d, home) = super::camps::setup();
    for resource in array![26_u8, 35, 36] {
        super::resource_commands::grant(d, home, resource, 100 * crate::rules::RESOURCE_PRECISION);
    }
    let create = Command::CreateExplorer(
        crate::commands::CreateExplorer {
            slot: 2,
            structure_id: home.entity_id,
            category: 0,
            tier: 0,
            amount: crate::rules::RESOURCE_PRECISION,
            direction: 2,
        },
    );
    let command = if explore {
        let army = crate::tests::state::StructureObservationTrait::home_armies(
            crate::structures::IStructureOperationsDispatcher { contract_address: d.games }, home,
        );
        Command::Explore(crate::commands::Explore { explorer_id: *army.at(0), direction: 0 })
    } else {
        create
    };
    (d, TestAction { game_id: 3, actor: d.actor, command }, play_fixture::FIXTURE_START + 140)
}
pub fn battle_case() -> (Deployment, TestAction, u64) {
    let (d, attacker, defender) = deep_armies();
    let command = Command::Battle(
        crate::combat_actions::AttackExplorer {
            attacker_id: attacker, defender_id: defender, steal_resources: array![].span(),
        },
    );
    (d, TestAction { game_id: 3, actor: d.actor, command }, play_fixture::FIXTURE_START)
}
pub fn season_case() -> (Deployment, TestAction, u64) {
    let d = super::registrar::setup();
    let game_id = play_fixture::create_game(d.games, play_fixture::fixture_params('season'));
    (d, play_fixture::settle_action(d, game_id, d.actor, 1), play_fixture::FIXTURE_START + 50)
}
pub fn deep_armies() -> (Deployment, u64, u64) {
    let (d, home, target, attacker, defender) = super::combat_actions::setup_with_counts((1000, 1000));
    super::combat_actions::into_deep(d, home, target, attacker, defender);
    (d, attacker, defender)
}
pub fn live_loot_case(insufficient: bool, full: bool) -> (Deployment, TestAction) {
    let (d, attacker, defender) = deep_armies();
    super::resource_commands::grant(d, crate::resources::ResourceKey { game_id: 3, entity_id: defender }, 2, 90);
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
    let command = {
        Command::Battle(
            crate::combat_actions::AttackExplorer {
                attacker_id: attacker, defender_id: defender, steal_resources: loot,
            },
        )
    };
    (d, TestAction { game_id: 3, actor: d.actor, command })
}
