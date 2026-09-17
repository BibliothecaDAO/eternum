use snforge_std::{EventSpyTrait, EventsFilterTrait, spy_events, start_cheat_caller_address, stop_cheat_caller_address};
use crate::combat_actions::{AttackExplorer, GuardAttack, ICombatActionsDispatcher, ICombatActionsDispatcherTrait, Raid};
use crate::commands::{Command, CreateExplorer};
use crate::guards::{Guard, GuardKey, IGuardsDispatcher, IGuardsDispatcherTrait};
use crate::map::{IMapDispatcher, IMapDispatcherTrait};
use crate::resources::{IResourcesDispatcher, IResourcesDispatcherTrait, ResourceAmount, ResourceKey, ResourceSlot};
use crate::rules::RESOURCE_PRECISION;
use crate::structures::{IStructuresDispatcher, IStructuresDispatcherTrait, StructureRecord};
use crate::troops::{Coord, ExplorerKey, ExplorerTroops, ITroopsDispatcher, ITroopsDispatcherTrait, Stamina, Troops};
use super::resource_commands::{assert_terminal_rejection, execute, execute_recorded_at, grant, set_fixture};

fn setup(blitz: bool) -> (super::Deployment, ResourceKey, ResourceKey, u32, u32) {
    let mut rules = super::recorded::rules();
    rules.blitz_mode_on = blitz;
    rules.battle_config.regular_immunity_ticks = 0;
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
        ids
            .append(
                *IStructuresDispatcher { contract_address: d.peers.structures }
                    .structure(key)
                    .unwrap()
                    .troop_explorers
                    .at(0),
            );
    }
    let attacker = *ids.at(0);
    let defender = *ids.at(1);
    move_fixture(d, attacker, 2000009);
    move_fixture(d, defender, 2000008);
    let original = IStructuresDispatcher { contract_address: d.peers.structures }.structure(target).unwrap();
    set_fixture(
        d.peers.structures,
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
    ITroopsDispatcher { contract_address: d.peers.troops }.explorer(ExplorerKey { game_id: 3, explorer_id: id })
}
fn move_fixture(d: super::Deployment, id: u32, x: u32) {
    let mut explorer = troop(d, id).unwrap();
    let map = IMapDispatcher { contract_address: d.peers.map };
    start_cheat_caller_address(d.peers.map, d.peers.troops);
    map.vacate(crate::geometry::tile_key(3, explorer.coord), id);
    explorer.coord = Coord { alt: false, x, y: 2000000 };
    map.occupy(crate::geometry::tile_key(3, explorer.coord), id, 2, false);
    stop_cheat_caller_address(d.peers.map);
    set_fixture(d.peers.troops, selector!("explorers"), array![3, id.into()].span(), explorer);
}
fn balance(d: super::Deployment, id: u32, resource_type: u8) -> u128 {
    IResourcesDispatcher { contract_address: d.peers.resources }
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
        d.peers.troops,
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
    IGuardsDispatcher { contract_address: d.peers.troops }
        .guard(GuardKey { game_id: 3, structure_id: key.entity_id, slot })
}

#[test]
fn a_surviving_explorer_loots_the_defeated_army_before_its_resources_are_deleted() {
    let (d, home, _, attacker, defender) = setup(false);
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
    for (_, event) in spy.get_events().emitted_by(d.peers.troops).events.span() {
        if *event.keys.at(0) == selector!("BattleEvent") {
            assert_eq!(event.data.span(), expected.span());
            found = true;
        }
    }
    assert!(found, "missing immutable battle outcome");
    assert!(
        !IResourcesDispatcher { contract_address: d.peers.resources }
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
        d.peers.resources,
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
        IStructuresDispatcher { contract_address: d.peers.structures }.structure(target).unwrap().owner,
        999.try_into().unwrap(),
    );
}

#[test]
fn village_immunity_is_recorded_per_village_and_allows_only_troop_loot_until_its_end() {
    let (d, _, target, attacker, _) = setup(false);
    let original = IStructuresDispatcher { contract_address: d.peers.structures }.structure(target).unwrap();
    set_fixture(
        d.peers.structures,
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
    let view = ICombatActionsDispatcher { contract_address: d.peers.troops };
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
    set_fixture(d.peers.troops, selector!("explorers"), array![3, defender.into()].span(), explorer);
    set_fixture(
        d.peers.resources,
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
        IStructuresDispatcher { contract_address: d.peers.structures }.structure(home).unwrap().owner,
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
    assert!(wins > 0 && wins < 30);
}

#[test]
#[feature("safe_dispatcher")]
fn combat_actions_and_raid_calculation_reject_foreign_callers() {
    let (d, home, target, attacker, defender) = setup(false);
    let context = crate::commands::ExecutionContext { raw_root: 7, timestamp: 80 };
    let actions = crate::combat_actions::ICombatActionsSafeDispatcher { contract_address: d.peers.troops };
    assert!(
        crate::combat_actions::ICombatActionsSafeDispatcherTrait::raid(
            actions,
            3,
            d.actor,
            Raid { explorer_id: attacker, structure_id: target.entity_id, steal_resources: array![].span() },
            context,
        )
            .is_err(),
    );
    assert!(
        crate::combat_actions::ICombatActionsSafeDispatcherTrait::guard_attack(
            actions,
            3,
            d.actor,
            GuardAttack {
                guard: crate::troop_management::GuardSlot { structure_id: home.entity_id, slot: 0 },
                explorer_id: defender,
            },
            context,
        )
            .is_err(),
    );
    let combat = crate::combat_domain::ICombatSafeDispatcher { contract_address: d.peers.combat };
    assert!(
        crate::combat_domain::ICombatSafeDispatcherTrait::resolve_raid(
            combat,
            3,
            troop(d, attacker).unwrap().troops,
            array![Default::default(), Default::default(), Default::default(), Default::default()].span(),
            crate::biome::Biome::Grassland,
            80,
        )
            .is_err(),
    );
}

#[test]
fn raiding_requires_at_least_one_whole_troop_per_occupied_guard() {
    let (d, _, target, attacker, _) = setup(false);
    let mut explorer = troop(d, attacker).unwrap();
    explorer.troops.count = RESOURCE_PRECISION;
    set_fixture(d.peers.troops, selector!("explorers"), array![3, attacker.into()].span(), explorer);
    set_guard(d, target, 0, 1);
    set_guard(d, target, 3, 1);
    assert_terminal_rejection(d, raid(attacker, target, array![].span()), 80);
    assert_eq!(troop(d, attacker).unwrap(), explorer);
    assert_eq!(guard(d, target, 0).troops.count, RESOURCE_PRECISION);
    assert_eq!(guard(d, target, 3).troops.count, RESOURCE_PRECISION);
}
