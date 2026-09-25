use eternum_randomness_protocol::entrypoint::IRecordedExecutionViewsDispatcher;
use snforge_std::{EventSpyTrait, EventsFilterTrait, spy_events, start_cheat_caller_address, stop_cheat_caller_address};
use crate::combat::TroopsTrait;
use crate::combat_actions::{AttackExplorer, GuardAttack, Raid};
use crate::commands::{Command, CreateExplorer};
use crate::games::IGamesAuthenticationDispatcher;
use crate::guards::{Guard, GuardKey, IGuardsDispatcher, IGuardsDispatcherTrait};
use crate::map::{IMapLogicDispatcher, IMapLogicDispatcherTrait};
use crate::resources::{IResourceOperationsDispatcher, ResourceAmount, ResourceKey, ResourceSlot};
use crate::rules::RESOURCE_PRECISION;
use crate::structures::{IStructureOperationsDispatcher, StructureRecord};
use crate::tests::state::{
    CombatObservationTrait, GameState, MapObservationTrait, ResourceObservationTrait, StructureObservationTrait,
    TroopObservationTrait,
};
use crate::troops::{Coord, ExplorerKey, ExplorerTroops, Stamina, Troops};
use super::recorded_receipts::RecordedReceiptsTrait;
use super::resource_commands::{assert_terminal_rejection, execute, execute_recorded_at, grant, set_fixture};

fn setup(blitz: bool) -> (super::Deployment, ResourceKey, ResourceKey, u32, u32) {
    setup_with_immunity(blitz, 0)
}
fn setup_with_immunity(blitz: bool, immunity: u8) -> (super::Deployment, ResourceKey, ResourceKey, u32, u32) {
    setup_with_mode(blitz, immunity, 0)
}
fn setup_with_mode(
    blitz: bool, immunity: u8, extra_mode_rules: u32,
) -> (super::Deployment, ResourceKey, ResourceKey, u32, u32) {
    let mut rules = super::recorded::rules();
    rules.mode_rules = extra_mode_rules
        + if blitz {
            super::recorded::BLITZ_RULES
        } else {
            super::recorded::ETERNUM_RULES
        };
    rules
        .command_mask = if blitz {
            super::recorded::BLITZ_COMMAND_MASK
        } else {
            super::recorded::ETERNUM_COMMAND_MASK
        };
    rules.entry_rule = if blitz {
        crate::rules::ENTRY_ROSTER
    } else {
        crate::rules::ENTRY_ENTITLEMENT
    };
    rules.battle_config.regular_immunity_ticks = immunity;
    rules.battle_config.village_immunity_ticks = 0;
    rules.battle_config.village_raid_immunity_ticks = 3;
    rules.tick_config.armies_tick_in_seconds = 5;
    rules.troop_stamina_config.stamina_initial = 120;
    let (d, home, target) = super::resource_commands::setup_with_rules(rules);
    let mut ids = array![];
    for (key, amount) in array![(home, 100_u128), (target, 1)] {
        grant(d, key, 26, amount * RESOURCE_PRECISION);
        assert!(
            execute(
                d,
                Command::CreateExplorer(
                    CreateExplorer {
                        structure_id: key.entity_id,
                        category: 0,
                        tier: 0,
                        amount: amount * RESOURCE_PRECISION,
                        direction: 0,
                    },
                ),
                80,
            ),
        );
        ids.append(*IStructureOperationsDispatcher { contract_address: d.games }.home_armies(key).at(0));
    }
    let attacker = *ids.at(0);
    let defender = *ids.at(1);
    move_fixture(d, attacker, 2000009);
    move_fixture(d, defender, 2000008);
    let original = IStructureOperationsDispatcher { contract_address: d.games }.structure(target).unwrap();
    set_fixture(
        d.games,
        selector!("structures"),
        selector!("structures"),
        array![3, target.entity_id.into()].span(),
        StructureRecord {
            owner: 999.try_into().unwrap(),
            base: original.base,
            resources_packed: original.resources_packed,
            metadata: original.metadata,
        },
    );
    (d, home, target, attacker, defender)
}
fn troop(d: super::Deployment, id: u32) -> Option<ExplorerTroops> {
    GameState { contract_address: d.games }.explorer(ExplorerKey { game_id: 3, explorer_id: id })
}
fn move_fixture(d: super::Deployment, id: u32, x: u32) {
    move_to(d, id, Coord { alt: false, x, y: 2000000 });
}
fn move_to(d: super::Deployment, id: u32, coord: Coord) {
    let mut explorer = troop(d, id).unwrap();
    let map = IMapLogicDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, d.games);
    map.vacate(crate::geometry::tile_key(3, explorer.coord), id);
    explorer.coord = coord;
    map.occupy(crate::geometry::tile_key(3, explorer.coord), id, 2, false);
    stop_cheat_caller_address(d.games);
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: 3, explorer_id: id }, explorer,
    );
}
fn balance(d: super::Deployment, id: u32, resource_type: u8) -> u128 {
    IResourceOperationsDispatcher { contract_address: d.games }
        .resource_balance(ResourceSlot { game_id: 3, entity_id: id, resource_type })
}
fn resources(amount: u128) -> Span<ResourceAmount> {
    array![ResourceAmount { resource_type: 2, amount }].span()
}
fn raid(attacker: u32, target: ResourceKey, amounts: Span<ResourceAmount>) -> Command {
    Command::Raid(Raid { explorer_id: attacker, structure_id: target.entity_id, steal_resources: amounts })
}
fn set_guard(d: super::Deployment, key: ResourceKey, slot: u8, count: u128) {
    set_fixture(
        d.games,
        selector!("guards"),
        selector!("guards"),
        array![3, key.entity_id.into(), slot.into()].span(),
        Guard {
            troops: Troops {
                count: count * RESOURCE_PRECISION,
                stamina: Stamina { amount: 120, updated_tick: 16 },
                ..Default::default(),
            },
            destroyed_tick: 0,
        },
    );
}
fn guard(d: super::Deployment, key: ResourceKey, slot: u8) -> Guard {
    IGuardsDispatcher { contract_address: d.games }.guard(GuardKey { game_id: 3, structure_id: key.entity_id, slot })
}

#[test]
fn a_surviving_explorer_loots_the_defeated_army_before_its_resources_are_deleted() {
    let (d, home, target, attacker, defender) = setup(false);
    grant(d, ResourceKey { game_id: 3, entity_id: defender }, 2, 90);
    let attacker_before = troop(d, attacker).unwrap();
    let defender_before = troop(d, defender).unwrap();
    let mut spy = spy_events();
    assert!(
        execute(
            d,
            Command::Battle(
                AttackExplorer { attacker_id: attacker, defender_id: defender, steal_resources: resources(70) },
            ),
            80,
        ),
    );
    assert!(troop(d, defender).is_none());
    super::state::assert_spatial_indexes(
        d.games,
        3,
        array![home.entity_id, target.entity_id, attacker, defender].span(),
        array![attacker_before.coord, defender_before.coord].span(),
    );
    assert!(troop(d, attacker).unwrap().troops.count != 0);
    assert_eq!(balance(d, attacker, 2), 70);
    let mut expected = array![];
    home.entity_id.serialize(ref expected);
    defender_before.coord.serialize(ref expected);
    resources(70).serialize(ref expected);
    crate::combat_actions::battle_side(d.actor, attacker_before.troops.count, troop(d, attacker).unwrap().troops, 0)
        .serialize(ref expected);
    crate::combat_actions::battle_side(
        999.try_into().unwrap(), defender_before.troops.count, Troops { count: 0, ..defender_before.troops }, 0,
    )
        .serialize(ref expected);
    80_u64.serialize(ref expected);
    let mut found = false;
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if *event.keys.at(0) == selector!("BattleEvent") {
            assert_eq!(event.data.span(), expected.span());
            found = true;
        }
    }
    assert!(found, "missing immutable battle outcome");
    assert!(
        !IResourceOperationsDispatcher { contract_address: d.games }
            .has_resource(ResourceKey { game_id: 3, entity_id: defender }),
    );
}

#[test]
fn failed_loot_and_duplicate_resources_roll_back_combat_but_consume_the_ticket() {
    let (d, _, _, attacker, defender) = setup(false);
    grant(d, ResourceKey { game_id: 3, entity_id: defender }, 2, 90);
    let before_attacker = troop(d, attacker);
    let before_defender = troop(d, defender);
    for amounts in array![
        resources(91),
        array![ResourceAmount { resource_type: 2, amount: 10 }, ResourceAmount { resource_type: 2, amount: 20 }].span(),
    ] {
        assert_terminal_rejection(
            d,
            Command::Battle(AttackExplorer { attacker_id: attacker, defender_id: defender, steal_resources: amounts }),
            80,
        );
        assert_eq!(troop(d, attacker), before_attacker);
        assert_eq!(troop(d, defender), before_defender);
        assert_eq!(balance(d, defender, 2), 90);
    }
}

#[test]
fn unguarded_raids_clip_the_amount_spent_to_capacity_without_spending_stamina_or_capturing() {
    let (d, _, target, attacker, _) = setup(false);
    grant(d, target, 2, 90);
    set_fixture(
        d.games,
        selector!("resources"),
        selector!("weights"),
        array![3, attacker.into()].span(),
        crate::resources::Weight { capacity: 7, weight: 0 },
    );
    let before = troop(d, attacker).unwrap();
    assert!(execute(d, raid(attacker, target, resources(90)), 80));
    assert_eq!(balance(d, attacker, 2), 7);
    assert_eq!(balance(d, target.entity_id, 2), 83);
    assert_eq!(troop(d, attacker).unwrap(), before);
    assert_eq!(
        IStructureOperationsDispatcher { contract_address: d.games }.structure(target).unwrap().owner,
        999.try_into().unwrap(),
    );
}

#[test]
fn village_immunity_is_recorded_per_village_and_allows_only_troop_loot_until_its_end() {
    let (d, _, target, attacker, _) = setup(false);
    let original = IStructureOperationsDispatcher { contract_address: d.games }.structure(target).unwrap();
    set_fixture(
        d.games,
        selector!("structures"),
        selector!("structures"),
        array![3, target.entity_id.into()].span(),
        StructureRecord {
            owner: original.owner,
            base: crate::structures::StructureBase { category: 5, ..original.base },
            resources_packed: original.resources_packed,
            metadata: original.metadata,
        },
    );
    grant(d, target, 2, 90);
    grant(d, target, 26, RESOURCE_PRECISION);
    let view = GameState { contract_address: d.games };
    assert!(execute(d, raid(attacker, target, resources(10)), 80));
    assert_eq!(view.village_last_raided(target), 16);
    assert_terminal_rejection(d, raid(attacker, target, resources(10)), 90);
    assert_eq!(view.village_last_raided(target), 16);
    assert!(
        execute(
            d,
            raid(attacker, target, array![ResourceAmount { resource_type: 26, amount: RESOURCE_PRECISION }].span()),
            90,
        ),
    );
    assert_eq!(view.village_last_raided(target), 18);
    assert!(execute(d, raid(attacker, target, resources(10)), 105));
    assert_eq!(view.village_last_raided(target), 21);
    assert_eq!(view.village_last_raided(ResourceKey { game_id: 2, ..target }), 0);
}

#[test]
fn raid_mode_owner_range_and_resource_failures_preserve_the_armies() {
    let (d, home, target, attacker, _) = setup(false);
    let before = troop(d, attacker);
    assert_terminal_rejection(d, raid(attacker, home, resources(1)), 80);
    assert_terminal_rejection(d, raid(attacker, ResourceKey { entity_id: 999999, ..target }, resources(1)), 80);
    assert_terminal_rejection(d, raid(attacker, target, resources(1)), 80);
    move_fixture(d, attacker, 2000006);
    assert_terminal_rejection(d, raid(attacker, target, array![].span()), 80);
    assert_eq!(troop(d, attacker).unwrap().troops, before.unwrap().troops);
    let (blitz, _, target, attacker, _) = setup(true);
    assert_terminal_rejection(blitz, raid(attacker, target, array![].span()), 80);
    let _ = IGamesAuthenticationDispatcher { contract_address: blitz.games };
    let result = IRecordedExecutionViewsDispatcher { contract_address: blitz.games }
        .recorded_outcome(3, super::recorded::head(blitz.games, 3).order)
        .unwrap();
    assert_eq!(result.status_class, 'COMMAND_DISABLED');
}

#[test]
fn guarded_raids_keep_the_same_armies_and_outcome_after_an_outage() {
    let (first, _, target, attacker, _) = setup(false);
    set_guard(first, target, 3, 20);
    set_guard(first, target, 0, 10);
    assert!(execute(first, raid(attacker, target, array![].span()), 80));
    let after = troop(first, attacker).unwrap();
    let guards = (guard(first, target, 3), guard(first, target, 0));
    assert!(after.troops.count < 100 * RESOURCE_PRECISION);
    let (late, _, target, attacker, _) = setup(false);
    set_guard(late, target, 3, 20);
    set_guard(late, target, 0, 10);
    assert!(execute_recorded_at(late, raid(attacker, target, array![].span()), 80, 1000));
    assert_eq!(troop(late, attacker).unwrap().troops, after.troops);
    assert_eq!((guard(late, target, 3), guard(late, target, 0)), guards);
}

#[test]
fn guard_attacks_use_the_guard_owner_range_and_recorded_cooldown() {
    let (d, home, _, _, defender) = setup(false);
    set_guard(d, home, 0, 100);
    let command = Command::GuardAttack(
        GuardAttack {
            guard: crate::troop_management::GuardSlot { structure_id: home.entity_id, slot: 0 }, explorer_id: defender,
        },
    );
    assert_terminal_rejection(d, command, 80);
    move_fixture(d, defender, 2000001);
    assert!(execute_recorded_at(d, command, 80, 1000));
    assert!(troop(d, defender).is_none());
    assert!(guard(d, home, 0).troops.count != 0);
}

#[test]
fn losing_the_final_attacking_guard_transfers_the_structure_to_the_adjacent_survivor() {
    let (d, home, _, _, defender) = setup(false);
    set_guard(d, home, 0, 1);
    move_fixture(d, defender, 2000001);
    let mut explorer = troop(d, defender).unwrap();
    explorer.troops.count = 100 * RESOURCE_PRECISION;
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: 3, explorer_id: defender }, explorer,
    );
    set_fixture(
        d.games,
        selector!("resources"),
        selector!("weights"),
        array![3, defender.into()].span(),
        crate::resources::Weight { capacity: 10000000000000000000, weight: 0 },
    );
    assert!(
        execute(
            d,
            Command::GuardAttack(
                GuardAttack {
                    guard: crate::troop_management::GuardSlot { structure_id: home.entity_id, slot: 0 },
                    explorer_id: defender,
                },
            ),
            80,
        ),
    );
    assert_eq!(
        IStructureOperationsDispatcher { contract_address: d.games }.structure(home).unwrap().owner,
        999.try_into().unwrap(),
    );
    assert_eq!(guard(d, home, 0), Default::default());
    assert!(troop(d, defender).unwrap().troops.count > 0);
}

#[test]
fn raid_rounding_and_weighted_outcomes_keep_the_declared_thresholds() {
    assert_eq!(crate::raid::raid_damage(0, 1000), RESOURCE_PRECISION);
    assert_eq!(crate::raid::raid_damage(10 * RESOURCE_PRECISION, 1000), 2 * RESOURCE_PRECISION);
    let result = crate::raid::RaidResolution {
        explorer: Default::default(),
        guards: array![].span(),
        damage_to_explorer: 10,
        damage_to_guards: 10,
        guarded: true,
    };
    assert!(crate::raid::success(crate::raid::RaidResolution { damage_to_guards: 21, ..result }, 0, 80));
    assert!(!crate::raid::success(crate::raid::RaidResolution { damage_to_explorer: 21, ..result }, 0, 80));
    let mut wins = 0_u32;
    for root in 0_u128..30 {
        if crate::raid::success(result, root.into(), 80) {
            wins += 1;
        }
    }
    // Pinned RNG: Poseidon(root.low, root.high, timestamp + 18) modulo 20, draw < 10.
    assert_eq!(wins, 15);
}

#[test]
fn raiding_requires_at_least_one_whole_troop_per_occupied_guard() {
    let (d, _, target, attacker, _) = setup(false);
    limit_guards(d, target, 4);
    let mut explorer = troop(d, attacker).unwrap();
    explorer.troops.count = RESOURCE_PRECISION;
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: 3, explorer_id: attacker }, explorer,
    );
    set_guard(d, target, 0, 1);
    set_guard(d, target, 3, 1);
    assert_terminal_rejection(d, raid(attacker, target, array![].span()), 80);
    assert_eq!(troop(d, attacker).unwrap(), explorer);
    assert_eq!(guard(d, target, 0).troops.count, RESOURCE_PRECISION);
    assert_eq!(guard(d, target, 3).troops.count, RESOURCE_PRECISION);
}

#[test]
fn ethereal_battle_uses_both_recorded_d20_rolls_in_damage_and_history() {
    let (d, _, _, attacker, defender) = setup(false);
    move_to(d, attacker, Coord { alt: true, x: 2000000, y: 2000000 });
    move_to(d, defender, Coord { alt: true, x: 2000015, y: 2000000 });
    let before_attacker = troop(d, attacker).unwrap();
    let before_defender = troop(d, defender).unwrap();
    let game = crate::game::IGameDispatcher { contract_address: d.games };
    let rules = crate::game::IGameDispatcherTrait::rules(game, 3);
    let mut root = super::context(d.games, 3).raw_root;
    let seed = crate::random::game_root(ref root, 3, crate::game::IGameDispatcherTrait::game(game, 3).seed);
    let attacker_roll: u8 = 1 + crate::random::range(seed, 1, 20).try_into().unwrap();
    let defender_roll: u8 = 1 + crate::random::range(seed, 2, 20).try_into().unwrap();
    assert!(attacker_roll >= 1 && attacker_roll <= 20 && defender_roll >= 1 && defender_roll <= 20);
    let mut expected_attacker = before_attacker.troops;
    let mut expected_defender = before_defender.troops;
    expected_attacker
        .attack_with_context(
            ref expected_defender,
            crate::combat::CombatContext {
                timestamp: 80,
                attacker_roll,
                defender_roll,
                attacker_biome: crate::biome::Biome::Underground,
                defender_biome: crate::biome::Biome::Underground,
                attack_distance: 1,
                attacker_is_structure_guard: false,
                defender_is_structure_guard: false,
            },
            rules.troop_stamina_config,
            rules.troop_damage_config,
            16,
            5,
        );
    let mut spy = spy_events();
    assert!(
        execute_recorded_at(
            d,
            Command::Battle(
                AttackExplorer { attacker_id: attacker, defender_id: defender, steal_resources: array![].span() },
            ),
            80,
            1000,
        ),
    );
    assert_eq!(troop(d, attacker).unwrap().troops, expected_attacker);
    assert_eq!(expected_defender.count, 0);
    assert!(troop(d, defender).is_none());
    let mut expected = array![];
    before_attacker.owner.serialize(ref expected);
    before_defender.coord.serialize(ref expected);
    let empty: Span<ResourceAmount> = array![].span();
    empty.serialize(ref expected);
    crate::combat_actions::battle_side(d.actor, before_attacker.troops.count, expected_attacker, attacker_roll)
        .serialize(ref expected);
    crate::combat_actions::battle_side(
        999.try_into().unwrap(), before_defender.troops.count, expected_defender, defender_roll,
    )
        .serialize(ref expected);
    80_u64.serialize(ref expected);
    let mut found = false;
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if *event.keys.at(0) == selector!("BattleEvent") {
            assert_eq!(event.data.span(), expected.span());
            found = true;
        }
    }
    assert!(found);
}

#[test]
fn a_dice_game_rolls_both_recorded_d20s_on_the_surface_too() {
    let (d, _, _, attacker, defender) = setup_with_mode(false, 0, crate::rules::COMBAT_DICE);
    // Away from the realms the fixture settles around (2000000, 2000000), so both armies stand on open surface.
    let origin = Coord { alt: false, x: 2000500, y: 2000500 };
    move_to(d, attacker, origin);
    move_to(d, defender, crate::geometry::neighbor(origin, 0));
    let surface: crate::biome::Biome = IMapLogicDispatcher { contract_address: d.games }
        .biome(
            crate::geometry::tile_key(3, crate::geometry::neighbor(origin, 0)),
            crate::commands::biome_context(
                crate::commands::ExecutionContext {
                    timestamp: 100,
                    ..crate::tests::context(
                        d.games, (crate::geometry::tile_key(3, crate::geometry::neighbor(origin, 0))).game_id,
                    ),
                },
            ),
        )
        .into();
    let before_attacker = troop(d, attacker).unwrap();
    let before_defender = troop(d, defender).unwrap();
    let game = crate::game::IGameDispatcher { contract_address: d.games };
    let rules = crate::game::IGameDispatcherTrait::rules(game, 3);
    let mut root = super::context(d.games, 3).raw_root;
    let seed = crate::random::game_root(ref root, 3, crate::game::IGameDispatcherTrait::game(game, 3).seed);
    let attacker_roll: u8 = 1 + crate::random::range(seed, 1, 20).try_into().unwrap();
    let defender_roll: u8 = 1 + crate::random::range(seed, 2, 20).try_into().unwrap();
    assert!(attacker_roll >= 1 && attacker_roll <= 20 && defender_roll >= 1 && defender_roll <= 20);
    let mut expected_attacker = before_attacker.troops;
    let mut expected_defender = before_defender.troops;
    expected_attacker
        .attack_with_context(
            ref expected_defender,
            crate::combat::CombatContext {
                timestamp: 80,
                attacker_roll,
                defender_roll,
                attacker_biome: surface,
                defender_biome: surface,
                attack_distance: 1,
                attacker_is_structure_guard: false,
                defender_is_structure_guard: false,
            },
            rules.troop_stamina_config,
            rules.troop_damage_config,
            16,
            5,
        );
    let mut spy = spy_events();
    assert!(
        execute_recorded_at(
            d,
            Command::Battle(
                AttackExplorer { attacker_id: attacker, defender_id: defender, steal_resources: array![].span() },
            ),
            80,
            1000,
        ),
    );
    assert_eq!(troop(d, attacker).unwrap().troops, expected_attacker);
    assert_eq!(expected_defender.count, 0);
    assert!(troop(d, defender).is_none());
    let mut expected = array![];
    before_attacker.owner.serialize(ref expected);
    before_defender.coord.serialize(ref expected);
    let empty: Span<ResourceAmount> = array![].span();
    empty.serialize(ref expected);
    crate::combat_actions::battle_side(d.actor, before_attacker.troops.count, expected_attacker, attacker_roll)
        .serialize(ref expected);
    crate::combat_actions::battle_side(
        999.try_into().unwrap(), before_defender.troops.count, expected_defender, defender_roll,
    )
        .serialize(ref expected);
    80_u64.serialize(ref expected);
    let mut found = false;
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if *event.keys.at(0) == selector!("BattleEvent") {
            assert_eq!(event.data.span(), expected.span());
            found = true;
        }
    }
    assert!(found);
}

#[test]
fn cross_layer_battles_require_matching_coordinates_and_an_adjacent_spire() {
    let (d, _, _, attacker, defender) = setup(false);
    let origin = troop(d, attacker).unwrap().coord;
    let command = Command::Battle(
        AttackExplorer { attacker_id: attacker, defender_id: defender, steal_resources: array![].span() },
    );
    move_to(d, defender, Coord { alt: true, ..origin });
    assert_terminal_rejection(d, command, 80);
    let map = IMapLogicDispatcher { contract_address: d.games };
    let spire = crate::geometry::spire_neighbor(origin, 1);
    start_cheat_caller_address(d.games, d.games);
    map.occupy(crate::geometry::tile_key(3, spire), 888, 35, true);
    stop_cheat_caller_address(d.games);
    move_to(d, defender, Coord { alt: true, x: origin.x + 1, ..origin });
    assert_terminal_rejection(d, command, 80);
    move_to(d, defender, Coord { alt: true, ..origin });
    assert!(execute(d, command, 80));
    assert!(troop(d, attacker).is_some());
    assert!(troop(d, defender).is_none());
}

#[test]
fn season_immunity_rejects_combat_until_the_recorded_boundary() {
    let (d, _, _, attacker, defender) = setup_with_immunity(false, 20);
    let before_attacker = troop(d, attacker);
    let before_defender = troop(d, defender);
    let command = Command::Battle(
        AttackExplorer { attacker_id: attacker, defender_id: defender, steal_resources: array![].span() },
    );
    assert_terminal_rejection(d, command, 119);
    assert_eq!(troop(d, attacker), before_attacker);
    assert_eq!(troop(d, defender), before_defender);
    assert!(execute_recorded_at(d, command, 120, 1000));
    assert!(troop(d, defender).is_none());
}

#[test]
fn guard_attacks_reject_slots_outside_the_structures_limit() {
    let (d, home, _, _, defender) = setup(false);
    let original = IStructureOperationsDispatcher { contract_address: d.games }.structure(home).unwrap();
    set_fixture(
        d.games,
        selector!("structures"),
        selector!("structures"),
        array![3, home.entity_id.into()].span(),
        StructureRecord {
            owner: original.owner,
            base: crate::structures::StructureBase { troop_max_guard_count: 1, ..original.base },
            resources_packed: original.resources_packed,
            metadata: original.metadata,
        },
    );
    move_fixture(d, defender, 2000001);
    set_guard(d, home, 1, 100);
    let before = troop(d, defender);
    assert_terminal_rejection(
        d,
        Command::GuardAttack(
            GuardAttack {
                guard: crate::troop_management::GuardSlot { structure_id: home.entity_id, slot: 1 },
                explorer_id: defender,
            },
        ),
        80,
    );
    assert_eq!(troop(d, defender), before);
    assert_eq!(guard(d, home, 1).troops.count, 100 * RESOURCE_PRECISION);
}

#[test]
fn mutual_destruction_does_not_recreate_resource_rows_for_loot() {
    let (d, _, _, attacker, defender) = setup(false);
    let mut explorer = troop(d, attacker).unwrap();
    explorer.troops.count = RESOURCE_PRECISION;
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: 3, explorer_id: attacker }, explorer,
    );
    grant(d, ResourceKey { game_id: 3, entity_id: defender }, 2, 90);
    let mut spy = spy_events();
    assert!(
        execute(
            d,
            Command::Battle(
                AttackExplorer { attacker_id: attacker, defender_id: defender, steal_resources: resources(90) },
            ),
            80,
        ),
    );
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    for id in array![attacker, defender] {
        assert!(troop(d, id).is_none());
        assert!(!resources.has_resource(ResourceKey { game_id: 3, entity_id: id }));
    }
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if *event.keys.at(0) == selector!("RowSet") && *event.keys.at(2) == 'ResourceBalance' {
            assert_eq!(*event.data.at(event.data.len() - 1), 0, "loot revived a resource balance");
        }
    }
}

fn limit_guards(d: super::Deployment, key: ResourceKey, maximum: u8) {
    let original = IStructureOperationsDispatcher { contract_address: d.games }.structure(key).unwrap();
    set_fixture(
        d.games,
        selector!("structures"),
        selector!("structures"),
        array![3, key.entity_id.into()].span(),
        StructureRecord {
            owner: original.owner,
            base: crate::structures::StructureBase { troop_max_guard_count: maximum, ..original.base },
            resources_packed: original.resources_packed,
            metadata: original.metadata,
        },
    );
}

#[test]
fn raid_ignores_guards_outside_the_structures_slot_limit() {
    let (d, _, target, attacker, _) = setup(false);
    limit_guards(d, target, 1);
    set_guard(d, target, 3, 100000);
    grant(d, target, 2, 90);
    let before = troop(d, attacker).unwrap();
    assert!(execute(d, raid(attacker, target, resources(90)), 80));
    assert_eq!(troop(d, attacker).unwrap(), before);
    assert_eq!(balance(d, attacker, 2), 90);
    assert_eq!(guard(d, target, 3).troops.count, 100000 * RESOURCE_PRECISION);
}

#[test]
fn structure_capture_ignores_guards_outside_the_slot_limit() {
    let (d, home, target, attacker, defender) = setup(false);
    limit_guards(d, target, 1);
    set_guard(d, target, 3, 100000);
    let before = troop(d, attacker).unwrap().troops.count;
    assert!(
        execute(
            d,
            Command::BattleGuard(crate::commands::Battle { attacker_id: attacker, defender_id: target.entity_id }),
            80,
        ),
    );
    assert_eq!(IStructureOperationsDispatcher { contract_address: d.games }.structure(target).unwrap().owner, d.actor);
    assert_eq!(troop(d, attacker).unwrap().troops.count, before);
    crate::tests::state::assert_spatial_indexes(
        d.games,
        3,
        array![home.entity_id, target.entity_id, attacker, defender].span(),
        array![troop(d, attacker).unwrap().coord, troop(d, defender).unwrap().coord].span(),
    );
}

#[test]
fn capturing_a_players_realm_records_both_owners_in_one_capture_story() {
    let (d, _, target, attacker, _) = setup(false);
    let before = IStructureOperationsDispatcher { contract_address: d.games }.structure(target).unwrap();
    assert_eq!(before.base.category, 1);
    assert_eq!(before.owner, 999.try_into().unwrap());
    let order = super::recorded::head(d.games, 3).order + 1;
    let mut spy = spy_events();
    assert!(
        execute(
            d,
            Command::BattleGuard(crate::commands::Battle { attacker_id: attacker, defender_id: target.entity_id }),
            80,
        ),
    );
    let mut captures = 0;
    let mut stories = 0_u32;
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if *event.keys.at(0) != selector!("StoryEvent") {
            continue;
        }
        let mut keys = event.keys.span().slice(1, event.keys.len() - 1);
        let mut data = event.data.span();
        let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref data).unwrap();
        assert_eq!(story.order, order);
        assert_eq!(story.index, stories);
        stories += 1;
        if let crate::ownership::Story::StructureCapturedStory(capture) = story.story {
            assert_eq!(capture.previous_owner, before.owner);
            assert_eq!(capture.new_owner, d.actor);
            assert_eq!(capture.points, 0);
            assert_eq!(story.entity_id, Some(target.entity_id));
            assert_eq!(story.owner, Some(d.actor));
            assert_eq!(story.timestamp, 80);
            captures += 1;
        }
    }
    assert_eq!(captures, 1);
    assert_eq!(IStructureOperationsDispatcher { contract_address: d.games }.structure(target).unwrap().owner, d.actor);
}

#[test]
fn a_destroyed_raider_never_collects_loot_even_when_the_roll_wins() {
    let (d, _, target, attacker, _) = setup(false);
    let mut explorer = troop(d, attacker).unwrap();
    explorer.troops.count = RESOURCE_PRECISION;
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: 3, explorer_id: attacker }, explorer,
    );
    set_guard(d, target, 0, 1);
    grant(d, target, 2, 90);
    let mut spy = spy_events();
    assert!(execute(d, raid(attacker, target, resources(90)), 84));
    assert!(troop(d, attacker).is_none());
    assert!(
        !IResourceOperationsDispatcher { contract_address: d.games }
            .has_resource(ResourceKey { game_id: 3, entity_id: attacker }),
    );
    assert_eq!(balance(d, target.entity_id, 2), 90);
    let mut saw_winning_roll = false;
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if *event.keys.at(0) == selector!("RaidEvent") {
            saw_winning_roll = *event.data.at(0) == 1;
        }
    }
    assert!(saw_winning_roll, "fixture must exercise a winning raid roll");
}

#[test]
fn guard_targeting_preserves_highest_occupied_functional_slot_first() {
    let (d, _, target, attacker, _) = setup(false);
    limit_guards(d, target, 4);
    set_guard(d, target, 0, 1000);
    set_guard(d, target, 2, 1);
    let delta = guard(d, target, 0);
    assert!(
        execute(
            d,
            Command::BattleGuard(crate::commands::Battle { attacker_id: attacker, defender_id: target.entity_id }),
            80,
        ),
    );
    assert_eq!(guard(d, target, 0), delta);
    assert_eq!(guard(d, target, 2).troops.count, 0);
    assert_eq!(
        IStructureOperationsDispatcher { contract_address: d.games }.structure(target).unwrap().owner,
        999.try_into().unwrap(),
    );
}

#[test]
fn unowned_target_rule_rejects_owned_sites_and_allows_capture_of_an_unowned_site() {
    let mut rules = super::recorded::rules();
    rules.mode_rules = crate::rules::UNOWNED_TARGETS;
    rules.battle_config.regular_immunity_ticks = 0;
    rules.troop_stamina_config.stamina_initial = 120;
    let (d, home, target) = super::resource_commands::setup_with_rules(rules);
    grant(d, home, 26, 100 * RESOURCE_PRECISION);
    assert!(
        execute(
            d,
            Command::CreateExplorer(
                CreateExplorer {
                    structure_id: home.entity_id, category: 0, tier: 0, amount: 100 * RESOURCE_PRECISION, direction: 0,
                },
            ),
            80,
        ),
    );
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let attacker = *structures.home_armies(home).at(0);
    move_fixture(d, attacker, 2000009);
    let mut record = structures.structure(target).unwrap();
    record.owner = 999.try_into().unwrap();
    set_fixture(
        d.games,
        selector!("structures"),
        selector!("structures"),
        array![3, target.entity_id.into()].span(),
        StructureRecord {
            owner: record.owner,
            base: record.base,
            resources_packed: record.resources_packed,
            metadata: record.metadata,
        },
    );
    let command = Command::BattleGuard(
        crate::commands::Battle { attacker_id: attacker, defender_id: target.entity_id },
    );
    let before = troop(d, attacker);
    assert_terminal_rejection(d, command, 80);
    assert_eq!(troop(d, attacker), before);
    assert_eq!(structures.structure(target).unwrap().owner, record.owner);
    record.owner = 0.try_into().unwrap();
    set_fixture(
        d.games,
        selector!("structures"),
        selector!("structures"),
        array![3, target.entity_id.into()].span(),
        StructureRecord {
            owner: record.owner,
            base: record.base,
            resources_packed: record.resources_packed,
            metadata: record.metadata,
        },
    );
    assert!(execute(d, command, 80));
    assert_eq!(structures.structure(target).unwrap().owner, d.actor);
}
