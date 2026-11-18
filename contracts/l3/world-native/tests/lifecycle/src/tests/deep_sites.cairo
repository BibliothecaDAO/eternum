use snforge_std::{interact_with_state, spy_events};
use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
use world_test_support::tests::Deployment;
use world_test_support::tests::resource_commands::{execute_in_game, grant, set_explorer_fixture};
use crate::commands::Command;
use crate::resources::ResourceKey;
use crate::troops::{ArmySlotKey, ExplorerKey, ExplorerTroops};
use super::army_activity::{army, found, muster, player, slot_army};

fn setup(seed: felt252) -> (Deployment, u32) {
    super::aspects::setup_aspect_preset(seed, preset())
}

pub fn preset() -> crate::presets::PresetDefinition {
    let (_, mut preset) = world_test_support::tests::preset_projection::current_definition("frontier-check");
    preset.rules.command_mask = preset.rules.command_mask | 4;
    preset.rules.battle_config.regular_immunity_ticks = 0;
    preset
        .economy
        .deep =
            Some(
                crate::deep::DeepRules {
                    beasts: beasts(crate::rules::RESOURCE_PRECISION),
                    loss_per_tick: crate::rules::RESOURCE_PRECISION,
                    core_per_tick: crate::rules::RESOURCE_PRECISION,
                    mine_per_tick: crate::rules::RESOURCE_PRECISION,
                    altar_per_tick: 1,
                    altar_threshold: 10,
                    ..preset.economy.deep.unwrap(),
                },
            );
    preset
}

pub fn beasts(count: u128) -> Span<crate::deep::DeepBeast> {
    let mut beasts = array![];
    for kind in 0..crate::rules::DEEP_KIND_COUNT {
        beasts
            .append(
                crate::deep::DeepBeast {
                    count, bow: kind == crate::rules::DEEP_CORE || kind == crate::rules::DEEP_ALTAR,
                },
            );
    }
    beasts.span()
}

pub fn deployed(d: Deployment, game_id: u32, aspect: u8, count: u128) -> ExplorerKey {
    let home = found(d, game_id, aspect);
    assert!(count > 0 && count <= 1500, "invalid starting-army test count");
    let first = slot_army(d, ArmySlotKey { game_id, structure_id: home, epoch: 0, slot: 0 });
    let second = slot_army(d, ArmySlotKey { game_id, structure_id: home, epoch: 0, slot: 1 });
    if count < 1500 {
        applied(
            d,
            game_id,
            Command::ManageTroops(
                crate::troop_management::ManageTroops::Transfer(
                    crate::troop_management::TransferTroops {
                        source: crate::troop_management::Army::Explorer(first),
                        target: crate::troop_management::Army::Explorer(second),
                        amount: (1500 - count) * crate::rules::RESOURCE_PRECISION,
                    },
                ),
            ),
            360,
        );
    }
    let key = ExplorerKey {
        game_id, explorer_id: slot_army(d, ArmySlotKey { game_id, structure_id: home, epoch: 0, slot: 0 }),
    };
    descend(d, key);
    key
}

pub fn descend(d: Deployment, key: ExplorerKey) {
    let game_id = key.game_id;
    let home = army(d, key).owner;
    let learned = interact_with_state(
        d.games,
        || crate::research::tier(
            crate::logic::research::learned(ResourceKey { game_id, entity_id: home }), crate::research::ROW_DEPTH,
        ),
    );
    let depth_budget = interact_with_state(
        d.games,
        || {
            let mut budget = 0;
            for tier in learned + 1..4 {
                budget += crate::logic::research::price(game_id, crate::research::ROW_DEPTH, tier).essence;
            }
            budget
        },
    );
    grant(d, ResourceKey { game_id, entity_id: home }, crate::resources::ESSENCE, depth_budget);
    for _ in learned..3 {
        applied(
            d,
            game_id,
            Command::Research(
                crate::research::Research { structure_id: home, row: crate::research::ROW_DEPTH, choice: 0 },
            ),
            360,
        );
    }
    applied(
        d, game_id, Command::EnterDepth(crate::commands::EnterDepth { explorer_id: key.explorer_id, depth: 3 }), 360,
    );
}

pub fn applied(d: Deployment, game_id: u32, command: Command, now: u64) {
    let mut events = spy_events();
    if !execute_in_game(d, game_id, command, now) {
        panic!("{}", world_test_support::tests::play_fixture::rejection(ref events, d.games).reason);
    }
}

fn refused(d: Deployment, game_id: u32, command: Command, now: u64, reason: ByteArray) {
    let mut events = spy_events();
    assert!(!execute_in_game(d, game_id, command, now));
    assert_eq!(world_test_support::tests::play_fixture::rejection(ref events, d.games).reason, reason);
}

pub fn site(d: Deployment, game_id: u32, kind: u8) -> ResourceKey {
    interact_with_state(
        d.games,
        || {
            let mut found = None;
            for index in 0..crate::rules::DEEP_KIND_COUNT {
                let key = ResourceKey { game_id, entity_id: crate::logic::deep_sites::site_id(game_id, index) };
                if crate::logic::deep_sites::site(key).unwrap().kind == kind {
                    found = Some(key);
                }
            }
            found.expect('no Deep site of that kind')
        },
    )
}

fn ring_site(d: Deployment, game_id: u32, ring: u8, kind: u8) -> ResourceKey {
    interact_with_state(
        d.games,
        || {
            let mut found = None;
            for place in 0..crate::rules::DEEP_KIND_COUNT {
                let index = ring * crate::rules::DEEP_KIND_COUNT + place;
                let key = ResourceKey { game_id, entity_id: crate::logic::deep_sites::site_id(game_id, index) };
                if crate::logic::deep_sites::site(key).unwrap().kind == kind {
                    found = Some(key);
                }
            }
            found.expect('no Deep site of that kind')
        },
    )
}

pub fn gate(d: Deployment, game_id: u32, aspect: u8) -> crate::troops::Coord {
    interact_with_state(
        d.games,
        || {
            let distance = crate::logic::deep_sites::rules_entry(game_id).unwrap().gate_distance.read();
            crate::deep::gate(distance, aspect, crate::logic::settlement::rules(game_id).spacing)
        },
    )
}

pub fn beside(d: Deployment, key: ExplorerKey, target: ResourceKey, direction: u8) {
    let coord = interact_with_state(d.games, || crate::logic::map::entity_coord(target).unwrap());
    set_explorer_fixture(
        d.games, key, ExplorerTroops { coord: crate::geometry::neighbor(coord, direction), ..army(d, key) },
    );
}

pub fn fight(key: ExplorerKey, target: ResourceKey) -> Command {
    Command::BattleGuard(
        crate::commands::Battle { attacker_id: key.explorer_id, defender_id: target.entity_id, relic_slot: None },
    )
}

pub fn join(d: Deployment, key: ExplorerKey, target: ResourceKey) -> Command {
    Command::InteractSite(
        crate::relics::InteractSite {
            explorer_id: key.explorer_id,
            coord: interact_with_state(d.games, || crate::logic::map::entity_coord(target).unwrap()),
        },
    )
}

pub fn held(d: Deployment, key: ExplorerKey) -> Option<crate::deep::DeepGuard> {
    interact_with_state(d.games, || crate::state::read().deep.guards.read((key.game_id, key.explorer_id)))
}

#[test]
fn distinct_homes_enter_one_deep_and_move_on_its_fixed_terrain() {
    let (d, game_id) = setup(81);
    let first = deployed(d, game_id, 1, 10);
    let second = deployed(player(d, 8101), game_id, 2, 10);
    let third = deployed(player(d, 8102), game_id, 1, 10);
    let a = army(d, first).coord;
    let b = army(d, second).coord;
    assert_eq!(a, gate(d, game_id, 1));
    assert_eq!(b, gate(d, game_id, 2));
    assert!(crate::geometry::adjacent(army(d, third).coord, a));
    interact_with_state(d.games, || assert_eq!(crate::state::read().deep.realms_entered.read((game_id, 0)), 3));
    for kind in 0..crate::rules::DEEP_KIND_COUNT {
        let target = site(d, game_id, kind);
        assert!(target.entity_id != 0);
        assert_eq!(interact_with_state(d.games, || crate::logic::deep_sites::site(target).unwrap().day), 0);
        let guard = interact_with_state(
            d.games,
            || crate::logic::guards::guard(
                crate::guards::GuardKey { game_id, structure_id: target.entity_id, slot: 0 },
            ),
        );
        assert_eq!(
            guard.troops.category,
            if kind == crate::rules::DEEP_ALTAR || kind == crate::rules::DEEP_CORE {
                crate::troops::TroopType::Crossbowman
            } else {
                crate::troops::TroopType::Knight
            },
        );
    }
    let mut direction = 0_u8;
    while crate::geometry::neighbor(a, direction) == army(d, third).coord {
        direction += 1;
    }
    applied(
        d,
        game_id,
        Command::Move(crate::commands::Move { explorer_id: first.explorer_id, directions: array![direction].span() }),
        360,
    );
    assert_eq!(army(d, first).coord, crate::geometry::neighbor(a, direction));
    assert_eq!(army(d, first).troops.count, 10 * crate::rules::RESOURCE_PRECISION);
}

#[test]
fn a_later_ring_refuses_joins_and_attacks_until_enough_realms_entered_today() {
    let mut definition = preset();
    let mut deep = definition.economy.deep.unwrap();
    deep
        .rings = array![crate::deep::DeepRing { radius: 5, realms: 0 }, crate::deep::DeepRing { radius: 8, realms: 2 }]
        .span();
    definition.economy.deep = Some(deep);
    let (d, game_id) = super::aspects::setup_aspect_preset(880, definition);
    let first = deployed(d, game_id, 1, 10);
    let target = ring_site(d, game_id, 1, crate::rules::DEEP_FOUNDATION);
    beside(d, first, target, 0);
    refused(d, game_id, join(d, first, target), 360, "Deep ring closed");
    refused(d, game_id, fight(first, target), 360, "Deep ring closed");
    deployed(player(d, 8801), game_id, 2, 10);
    applied(d, game_id, fight(first, target), 360);
    assert_eq!(held(d, first), Some(crate::deep::DeepGuard { site_id: target.entity_id, slot: 0 }));
}

#[test]
fn four_allies_guard_one_site_and_a_rival_fights_exactly_one_slot_per_attack() {
    let (d, game_id) = setup(82);
    let target = site(d, game_id, crate::rules::DEEP_FOUNDATION);
    let mut guards = array![];
    for slot in 0_u8..crate::rules::DEEP_GUARD_SLOTS {
        let member = player(d, 8200 + slot.into());
        let key = deployed(member, game_id, 1, 10);
        beside(d, key, target, slot);
        if slot == 0 {
            refused(member, game_id, join(d, key, target), 360, "Deep beast still guards site");
            applied(member, game_id, fight(key, target), 360);
        } else {
            applied(member, game_id, join(d, key, target), 360);
        }
        assert_eq!(held(d, key), Some(crate::deep::DeepGuard { site_id: target.entity_id, slot }));
        let field = crate::geometry::tile_key(
            game_id,
            crate::geometry::neighbor(
                interact_with_state(d.games, || crate::logic::map::entity_coord(target).unwrap()), slot,
            ),
        );
        assert!(interact_with_state(d.games, || crate::logic::map::occupancy(field)).is_none());
        refused(
            member,
            game_id,
            Command::Move(crate::commands::Move { explorer_id: key.explorer_id, directions: array![0].span() }),
            360,
            "army is guarding a Deep site",
        );
        guards.append(key);
    }
    let fifth = player(d, 8204);
    let waiting = deployed(fifth, game_id, 1, 10);
    beside(d, waiting, target, 4);
    refused(fifth, game_id, join(d, waiting, target), 360, "Deep site has four guards");
    refused(fifth, game_id, fight(waiting, target), 360, "cannot attack an allied army");
    let rival = player(d, 8205);
    let attacker = deployed(rival, game_id, 2, 1000);
    beside(d, attacker, target, 5);
    refused(rival, game_id, join(d, attacker, target), 360, "Deep site belongs to another Aspect");
    for remaining in 0_u8..crate::rules::DEEP_GUARD_SLOTS {
        let slot = crate::rules::DEEP_GUARD_SLOTS - 1 - remaining;
        let before = army(d, *guards.at(0));
        applied(rival, game_id, fight(attacker, target), 360);
        assert!(held(d, *guards.at(slot.into())).is_none());
        for lower in 0..slot {
            assert_eq!(held(d, *guards.at(lower.into())).unwrap().slot, lower);
        }
        if slot != 0 {
            assert_eq!(army(d, *guards.at(0)), before);
            assert!(held(d, attacker).is_none());
        }
    }
    assert_eq!(held(d, attacker), Some(crate::deep::DeepGuard { site_id: target.entity_id, slot: 0 }));
    assert!(army(d, attacker).troops.count > 0);
}

#[test]
fn exhausted_guards_release_slots_before_a_new_holder_joins() {
    let (d, game_id) = setup(83);
    let target = site(d, game_id, crate::rules::DEEP_MINE);
    let first = deployed(d, game_id, 1, 10);
    beside(d, first, target, 0);
    applied(d, game_id, fight(first, target), 360);
    let rival = player(d, 8301);
    let next = deployed(rival, game_id, 2, 1000);
    beside(d, next, target, 1);
    let interval = crate::tests::context(d.games, game_id).rules.unbox().tick_config.armies_tick_in_seconds;
    let now = 360 + 10 * interval;
    applied(rival, game_id, join(d, next, target), now);
    assert!(held(d, first).is_none());
    assert!(interact_with_state(d.games, || crate::logic::troops::explorer(first)).is_none());
    assert_eq!(held(d, next), Some(crate::deep::DeepGuard { site_id: target.entity_id, slot: 0 }));
    let expected = crate::deep::troops_after_ticks(
        1000 * crate::rules::RESOURCE_PRECISION, 360 / interval, now / interval, crate::rules::RESOURCE_PRECISION,
    );
    assert_eq!(army(d, next).troops.count, expected);
}

#[test]
fn one_player_cannot_fill_two_slots_and_day_rollover_restores_every_beast() {
    let (d, game_id) = setup(84);
    let target = site(d, game_id, crate::rules::DEEP_FOUNDATION);
    let first = deployed(d, game_id, 1, 10);
    let home = army(d, first).owner;
    beside(d, first, target, 0);
    applied(d, game_id, fight(first, target), 360);
    applied(
        d,
        game_id,
        world_test_support::tests::building_commands::create(
            ResourceKey { game_id, entity_id: home }, crate::research::BARRACKS,
        ),
        360,
    );
    let second = ExplorerKey {
        game_id, explorer_id: slot_army(d, ArmySlotKey { game_id, structure_id: home, epoch: 0, slot: 1 }),
    };
    applied(
        d, game_id, Command::EnterDepth(crate::commands::EnterDepth { explorer_id: second.explorer_id, depth: 3 }), 360,
    );
    beside(d, second, target, 1);
    refused(d, game_id, join(d, second, target), 360, "player already guards site");
    assert!(held(d, second).is_none());

    let context = crate::tests::context(d.games, game_id);
    let tomorrow = crate::days::day_at_index(context.game.unbox(), context.rules.unbox().day_unit_seconds, 0).end;
    applied(d, game_id, muster(home, 0, 0, 100), tomorrow);
    let fresh = ExplorerKey {
        game_id, explorer_id: slot_army(d, ArmySlotKey { game_id, structure_id: home, epoch: 1, slot: 0 }),
    };
    applied(
        d,
        game_id,
        Command::EnterDepth(crate::commands::EnterDepth { explorer_id: fresh.explorer_id, depth: 3 }),
        tomorrow,
    );
    for kind in 0..crate::rules::DEEP_KIND_COUNT {
        let current = site(d, game_id, kind);
        assert_eq!(interact_with_state(d.games, || crate::logic::deep_sites::site(current).unwrap().day), 1);
        let count = interact_with_state(
            d.games,
            || crate::logic::guards::guard(
                crate::guards::GuardKey { game_id, structure_id: current.entity_id, slot: 0 },
            )
                .troops
                .count,
        );
        assert_eq!(count, crate::rules::RESOURCE_PRECISION);
    }
    beside(d, fresh, target, 0);
    applied(d, game_id, fight(fresh, target), tomorrow);
    assert!(held(d, first).is_none());
    assert!(held(d, second).is_none());
    assert!(interact_with_state(d.games, || crate::logic::troops::explorer(first)).is_none());
    assert!(interact_with_state(d.games, || crate::logic::troops::explorer(second)).is_none());
    assert_eq!(held(d, fresh), Some(crate::deep::DeepGuard { site_id: target.entity_id, slot: 0 }));
    for kind in 0..crate::rules::DEEP_KIND_COUNT {
        let current = site(d, game_id, kind);
        assert_eq!(interact_with_state(d.games, || crate::logic::deep_sites::site(current).unwrap().day), 1);
        let count = interact_with_state(
            d.games,
            || crate::logic::guards::guard(
                crate::guards::GuardKey { game_id, structure_id: current.entity_id, slot: 0 },
            )
                .troops
                .count,
        );
        assert_eq!(count, if current == target {
            0
        } else {
            crate::rules::RESOURCE_PRECISION
        });
    }
}

#[test]
fn deep_beast_marks_control_public_attacks_without_knight_slot_protection() {
    for kind in 0..crate::rules::DEEP_KIND_COUNT {
        let mut definition = preset();
        let mut deep = definition.economy.deep.unwrap();
        deep.beasts = beasts(1000 * crate::rules::RESOURCE_PRECISION);
        definition.economy.deep = Some(deep);
        definition.rules.troop_damage_config.damage_scaling_factor = 36893488147419103232;
        definition.rules.troop_damage_config.damage_biome_bonus_num = 0;
        let (d, game_id) = super::aspects::setup_aspect_preset(860 + kind.into(), definition);
        let attacker = deployed(d, game_id, 1, 1500);
        let target = site(d, game_id, kind);
        beside(d, attacker, target, 0);
        applied(d, game_id, fight(attacker, target), 360);
        let guard = interact_with_state(
            d.games,
            || crate::logic::guards::guard(
                crate::guards::GuardKey { game_id, structure_id: target.entity_id, slot: 0 },
            ),
        );
        let (left, enemy) = if kind == crate::rules::DEEP_ALTAR || kind == crate::rules::DEEP_CORE {
            (1186_u128, 504_u128)
        } else {
            (1082, 373)
        };
        assert_eq!(army(d, attacker).troops.count, left * crate::rules::RESOURCE_PRECISION);
        assert_eq!(guard.troops.count, enemy * crate::rules::RESOURCE_PRECISION);
        assert_eq!(held(d, attacker), None);
    }
}

#[test]
fn public_attacks_apply_held_oaths_to_the_army_and_the_rival_guard() {
    let values = snforge_std::fs::read_txt(@snforge_std::fs::FileTrait::new("../fixtures/oath-damage.txt"));
    let mut fields = values.span();
    for guarding in array![false, true] {
        let mut definition = oath_vector_preset();
        let mut deep = definition.economy.deep.unwrap();
        deep.beasts = beasts((if guarding {
            1
        } else {
            1000
        }) * crate::rules::RESOURCE_PRECISION);
        definition.economy.deep = Some(deep);
        let (d, game_id) = super::aspects::setup_aspect_preset(if guarding {
            870
        } else {
            871
        }, definition);
        let target = site(d, game_id, crate::rules::DEEP_MINE);
        let defender = if guarding {
            let guard = deployed(d, game_id, 1, 1000);
            beside(d, guard, target, 0);
            applied(d, game_id, fight(guard, target), 360);
            Some(guard)
        } else {
            None
        };
        let rival = player(d, 8701);
        let attacker = deployed(rival, game_id, 2, 1000);
        beside(d, attacker, target, 1);
        for exchange in 0_u8..2 {
            let (a, b, ao, bo, ag, bg): (crate::troops::TroopType, crate::troops::TroopType, u16, u16, bool, bool) =
                Serde::deserialize(
                ref fields,
            )
                .unwrap();
            let (before_a, before_b, after_a, after_b): (u128, u128, u128, u128) = Serde::deserialize(ref fields)
                .unwrap();
            assert!(!ag && bg == guarding);
            if exchange == 0 {
                prepare_oath_combatant(d, attacker, a, ao, before_a);
                if let Some(key) = defender {
                    prepare_oath_combatant(d, key, b, bo, before_b);
                }
            }
            assert_eq!(army(d, attacker).troops.count, before_a * crate::rules::RESOURCE_PRECISION);
            applied(rival, game_id, fight(attacker, target), 360);
            assert_eq!(army(d, attacker).troops.count, after_a * crate::rules::RESOURCE_PRECISION);
            let defender_count = match defender {
                Some(key) => army(d, key).troops.count,
                None => interact_with_state(
                    d.games,
                    || crate::logic::guards::guard(
                        crate::guards::GuardKey { game_id, structure_id: target.entity_id, slot: 0 },
                    )
                        .troops
                        .count,
                ),
            };
            assert_eq!(defender_count, after_b * crate::rules::RESOURCE_PRECISION);
            assert_eq!(held(d, attacker), None);
        }
    }
}

#[test]
fn public_field_battles_apply_held_oaths_on_both_sides() {
    let values = snforge_std::fs::read_txt(@snforge_std::fs::FileTrait::new("../fixtures/oath-damage.txt"));
    let mut fields = values.span();
    let mut battles = 0;
    while !fields.is_empty() {
        let (a, b, ao, bo, ag, bg): (crate::troops::TroopType, crate::troops::TroopType, u16, u16, bool, bool) =
            Serde::deserialize(
            ref fields,
        )
            .unwrap();
        let (before_a, before_b, after_a, after_b): (u128, u128, u128, u128) = Serde::deserialize(ref fields).unwrap();
        let knights = a == crate::troops::TroopType::Knight && b == crate::troops::TroopType::Knight;
        if ag || bg || !knights {
            continue;
        }
        let (d, game_id) = super::aspects::setup_aspect_preset(872 + battles, oath_vector_preset());
        let defender = deployed(d, game_id, 1, 1000);
        let rival = player(d, 8721);
        let attacker = deployed(rival, game_id, 2, 1000);
        let coord = crate::geometry::neighbor(army(d, defender).coord, 0);
        set_explorer_fixture(d.games, attacker, ExplorerTroops { coord, ..army(d, attacker) });
        prepare_oath_combatant(d, attacker, a, ao, before_a);
        prepare_oath_combatant(d, defender, b, bo, before_b);
        applied(
            rival,
            game_id,
            Command::Battle(
                crate::combat_actions::AttackExplorer {
                    attacker_id: attacker.explorer_id,
                    defender_id: defender.explorer_id,
                    steal_resources: array![].span(),
                },
            ),
            360,
        );
        assert_eq!(army(d, attacker).troops.count, after_a * crate::rules::RESOURCE_PRECISION);
        assert_eq!(army(d, defender).troops.count, after_b * crate::rules::RESOURCE_PRECISION);
        battles += 1;
    }
    assert_eq!(battles, 4);
}

fn oath_vector_preset() -> crate::presets::PresetDefinition {
    let mut definition = preset();
    definition.rules.troop_damage_config.damage_scaling_factor = 36893488147419103232;
    definition.rules.troop_damage_config.damage_biome_bonus_num = 0;
    definition.rules.battle_config.cooldown_seconds = 0;
    definition.rules.troop_stamina_config.stamina_attack_req = 10;
    definition.rules.troop_stamina_config.stamina_defense_req = 0;
    definition.rules.troop_stamina_config.stamina_gain_per_tick = 0;
    definition.rules.troop_stamina_config.damage_stamina_refund = false;
    definition
}

fn prepare_oath_combatant(
    d: Deployment, key: ExplorerKey, category: crate::troops::TroopType, oaths: u16, count: u128,
) {
    let mut row = army(d, key);
    row.troops.count = count * crate::rules::RESOURCE_PRECISION;
    row.troops.category = category;
    row.troops.battle_cooldown_end = 0;
    let record = crate::troops::ExplorerRecordTrait::into_record(row);
    interact_with_state(
        d.games,
        || {
            let progress = crate::logic::progression::read(key).unwrap();
            crate::logic::progression::write(
                key, crate::progression::ArmyProgress { oaths, oath_slots: 4, ..progress },
            );
            crate::logic::troops::TroopState::save(key, record);
        },
    );
}
