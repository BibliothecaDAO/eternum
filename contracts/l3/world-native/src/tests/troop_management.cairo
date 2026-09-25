use eternum_cubit::f128::types::fixed::FixedTrait;
use snforge_std::{EventSpyTrait, EventsFilterTrait, spy_events, start_cheat_caller_address, stop_cheat_caller_address};
use crate::combat::TroopsTrait;
use crate::commands::{Command, CreateExplorer, Move};
use crate::guards::{GuardKey, IGuardsDispatcher, IGuardsDispatcherTrait};
use crate::map::IMapLogicDispatcher;
use crate::names::{INamesDispatcher, INamesDispatcherTrait, SetEntityName};
use crate::ownership::{GuardAddStory, Story};
use crate::resources::{IResourceOperationsDispatcher, ResourceKey, ResourceSlot};
use crate::rules::RESOURCE_PRECISION;
use crate::structures::IStructureOperationsDispatcher;
use crate::tests::state::{
    GameState, MapObservationTrait, ResourceObservationTrait, StructureObservationTrait, TroopObservationTrait,
};
use crate::troop_management::{Army, GuardSlot, ManageTroops, RecruitExplorer, RecruitGuard, TransferTroops};
use crate::troops::{ExplorerKey, ExplorerTroops, TroopTier, TroopType};
use super::resource_commands::{assert_terminal_rejection, execute, execute_recorded_at, grant, set_fixture};

fn setup_homes() -> (super::Deployment, ResourceKey, ResourceKey, u32, u32) {
    let mut rules = super::recorded::rules();
    rules.troop_limit_config.guard_resurrection_delay = 60;
    let (d, home, other_home) = super::resource_commands::setup_with_rules(rules);
    grant(d, home, 26, 1000 * RESOURCE_PRECISION);
    grant(d, home, 32, 1000 * RESOURCE_PRECISION);
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let original = structures.structure(home).unwrap();
    set_fixture(
        d.games,
        selector!("structures"),
        selector!("structures"),
        array![3, home.entity_id.into()].span(),
        crate::structures::StructureRecord {
            owner: original.owner,
            base: crate::structures::StructureBase {
                troop_max_explorer_count: 4, troop_max_guard_count: 1, ..original.base,
            },
            resources_packed: original.resources_packed,
            metadata: original.metadata,
        },
    );
    for (amount, direction) in array![(10_u128, 0_u8), (5, 1)] {
        assert!(
            execute(
                d,
                Command::CreateExplorer(
                    CreateExplorer {
                        structure_id: home.entity_id,
                        category: 0,
                        tier: 0,
                        amount: amount * RESOURCE_PRECISION,
                        direction,
                    },
                ),
                80,
            ),
        );
    }
    let ids = structures.home_armies(home);
    (d, home, other_home, *ids.at(0), *ids.at(1))
}
fn setup() -> (super::Deployment, ResourceKey, u32, u32) {
    let (d, home, _, first, second) = setup_homes();
    (d, home, first, second)
}

#[test]
fn recorded_spatial_commands_match_replay_views() {
    let (d, home, other, first, second) = setup_homes();
    grant(d, home, 35, 1000 * RESOURCE_PRECISION);
    grant(d, home, 36, 1000 * RESOURCE_PRECISION);
    let origin = troop(d, first).unwrap().coord;
    let destination = crate::geometry::neighbor(origin, 0);
    let map = IMapLogicDispatcher { contract_address: d.games };
    map.reveal(crate::geometry::tile_key(3, destination), 11);
    let views = IStructureOperationsDispatcher { contract_address: d.games };
    let entities = array![home.entity_id, other.entity_id, first, second].span();
    let tiles = array![
        views.position(home).unwrap(), views.position(other).unwrap(), origin, troop(d, second).unwrap().coord,
        destination,
    ]
        .span();
    let mut frames = array![super::spatial_replay::initial(d.games, 3, entities, tiles)];
    let mut spy = spy_events();
    for (command, timestamp) in array![
        (Command::Move(Move { explorer_id: first, directions: array![0_u8].span() }), 120_u64),
        (Command::Move(Move { explorer_id: first, directions: array![3_u8].span() }), 120),
        (transfer(Army::Explorer(first), Army::Explorer(second), 10), 140),
        (manage(ManageTroops::RemoveExplorer(second)), 150),
    ] {
        assert!(execute(d, command, timestamp));
        super::state::assert_spatial_indexes(d.games, 3, entities, tiles);
        frames.append(super::spatial_replay::capture(d.games, 3, entities, tiles, ref spy));
    }
    super::spatial_replay::compare("armies", frames);
}
fn troop(d: super::Deployment, id: u32) -> Option<ExplorerTroops> {
    GameState { contract_address: d.games }.explorer(ExplorerKey { game_id: 3, explorer_id: id })
}
fn guard(d: super::Deployment, home: ResourceKey, slot: u8) -> crate::guards::Guard {
    IGuardsDispatcher { contract_address: d.games }.guard(GuardKey { game_id: 3, structure_id: home.entity_id, slot })
}
fn manage(action: ManageTroops) -> Command {
    Command::ManageTroops(action)
}
fn transfer(source: Army, target: Army, amount: u128) -> Command {
    manage(ManageTroops::Transfer(TransferTroops { source, target, amount: amount * RESOURCE_PRECISION }))
}
fn recruit(home: ResourceKey, slot: u8, amount: u128) -> Command {
    manage(
        ManageTroops::RecruitGuard(
            RecruitGuard {
                guard: GuardSlot { structure_id: home.entity_id, slot },
                category: TroopType::Knight,
                tier: TroopTier::T1,
                amount: amount * RESOURCE_PRECISION,
            },
        ),
    )
}
fn resource(d: super::Deployment) -> IResourceOperationsDispatcher {
    IResourceOperationsDispatcher { contract_address: d.games }
}
fn count(d: super::Deployment, home: ResourceKey) -> u128 {
    resource(d).resource_balance(ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 26 })
}

#[test]
fn recruitment_spends_troop_resources_and_updates_capacity_with_recorded_stamina() {
    let (d, home, first, _) = setup();
    let before = count(d, home);
    let capacity = resource(d).resource_weight(ResourceKey { game_id: 3, entity_id: first }).capacity;
    assert!(
        execute_recorded_at(
            d,
            manage(
                ManageTroops::RecruitExplorer(RecruitExplorer { explorer_id: first, amount: 2 * RESOURCE_PRECISION }),
            ),
            140,
            10000,
        ),
    );
    assert_eq!(troop(d, first).unwrap().troops.count, 12 * RESOURCE_PRECISION);
    assert_eq!(resource(d).resource_weight(ResourceKey { game_id: 3, entity_id: first }).capacity, capacity * 12 / 10);
    assert_eq!(count(d, home), before - 2 * RESOURCE_PRECISION);
    assert!(execute_recorded_at(d, recruit(home, 0, 3), 140, 10000));
    assert_eq!(guard(d, home, 0).troops.count, 3 * RESOURCE_PRECISION);
    assert_eq!(guard(d, home, 0).troops.stamina.amount, 0);
    assert_eq!(count(d, home), before - 5 * RESOURCE_PRECISION);
    assert_terminal_rejection(d, recruit(home, 1, 1), 140);
    assert_eq!(guard(d, home, 1).troops.count, 0);
}

#[test]
fn explorer_transfer_preserves_the_worse_stamina_and_cooldown_and_deletes_an_empty_source() {
    let (d, home, first, second) = setup();
    for (id, stamina, cooldown) in array![(first, 2_u64, 190_u32), (second, 9, 150)] {
        let mut row = troop(d, id).unwrap();
        row.troops.stamina.amount = stamina;
        row.troops.stamina.updated_tick = 2;
        row.troops.battle_cooldown_end = cooldown;
        crate::tests::resource_commands::set_explorer_fixture(
            d.games, crate::troops::ExplorerKey { game_id: 3, explorer_id: id }, row,
        );
    }
    let old_position = troop(d, first).unwrap().coord;
    assert!(execute(d, transfer(Army::Explorer(first), Army::Explorer(second), 10), 140));
    assert!(troop(d, first).is_none());
    assert!(!resource(d).has_resource(ResourceKey { game_id: 3, entity_id: first }));
    let target = troop(d, second).unwrap().troops;
    assert_eq!(target.count, 15 * RESOURCE_PRECISION);
    assert_eq!(target.stamina.amount, 2);
    assert_eq!(target.battle_cooldown_end, 190);
    assert_eq!(IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home), array![second].span());
    let tile = crate::tests::state::MapObservationTrait::tile(
        crate::map::IMapLogicDispatcher { contract_address: d.games }, crate::geometry::tile_key(3, old_position),
    )
        .unwrap();
    assert_eq!(tile.data % 0x20000000000, 0);
    super::state::assert_spatial_indexes(
        d.games,
        3,
        array![home.entity_id, first, second].span(),
        array![old_position, troop(d, second).unwrap().coord].span(),
    );
}

#[test]
fn transfers_to_guards_and_back_preserve_counts_and_reject_foreign_homes() {
    let (d, home, other_home, first, second) = setup_homes();
    let slot = GuardSlot { structure_id: home.entity_id, slot: 0 };
    assert!(execute(d, transfer(Army::Explorer(first), Army::Guard(slot), 3), 140));
    assert_eq!(guard(d, home, 0).troops.count, 3 * RESOURCE_PRECISION);
    assert_eq!(troop(d, first).unwrap().troops.count, 7 * RESOURCE_PRECISION);
    assert!(execute(d, transfer(Army::Guard(slot), Army::Explorer(second), 3), 140));
    assert_eq!(guard(d, home, 0).troops.count, 0);
    assert_eq!(guard(d, home, 0).troops.stamina.amount, 0);
    assert_eq!(troop(d, second).unwrap().troops.count, 8 * RESOURCE_PRECISION);
    let mut row = troop(d, second).unwrap();
    assert_eq!(
        IStructureOperationsDispatcher { contract_address: d.games }.structure(other_home).unwrap().owner, d.actor,
    );
    row.owner = other_home.entity_id;
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: 3, explorer_id: second }, row,
    );
    assert_terminal_rejection(d, transfer(Army::Explorer(first), Army::Explorer(second), 1), 140);
    assert_eq!(troop(d, first).unwrap().troops.count, 7 * RESOURCE_PRECISION);
    assert_eq!(troop(d, second).unwrap().troops.count, 8 * RESOURCE_PRECISION);
}

#[test]
fn malformed_amounts_overweight_transfers_and_wrong_categories_reject_without_spending() {
    let (d, home, first, second) = setup();
    let before = count(d, home);
    for amount in array![0, RESOURCE_PRECISION - 1, 100000000 * RESOURCE_PRECISION] {
        assert_terminal_rejection(
            d, manage(ManageTroops::RecruitExplorer(RecruitExplorer { explorer_id: first, amount })), 140,
        );
    }
    assert_eq!(count(d, home), before);
    assert_eq!(troop(d, first).unwrap().troops.count, 10 * RESOURCE_PRECISION);
    grant(d, ResourceKey { game_id: 3, entity_id: first }, 1, 1);
    assert_terminal_rejection(d, transfer(Army::Explorer(first), Army::Explorer(second), 10), 140);
    let mut target = troop(d, second).unwrap();
    target.troops.category = TroopType::Paladin;
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: 3, explorer_id: second }, target,
    );
    assert_terminal_rejection(d, transfer(Army::Explorer(first), Army::Explorer(second), 1), 140);
    assert_terminal_rejection(d, recruit(home, 4, 1), 140);
}

#[test]
fn guard_deletion_does_not_erase_defeat_delay_and_explorer_deletion_clears_owned_facts() {
    let (d, home, first, _) = setup();
    set_fixture(
        d.games,
        selector!("guards"),
        selector!("guards"),
        array![3, home.entity_id.into(), 0].span(),
        crate::guards::Guard { destroyed_tick: 2, ..Default::default() },
    );
    assert_terminal_rejection(
        d, manage(ManageTroops::RemoveGuard(GuardSlot { structure_id: home.entity_id, slot: 0 })), 140,
    );
    assert_eq!(guard(d, home, 0).destroyed_tick, 2);
    assert_terminal_rejection(d, recruit(home, 0, 1), 140);
    assert!(execute(d, recruit(home, 0, 1), 180));
    assert_eq!(guard(d, home, 0).troops.count, RESOURCE_PRECISION);
    assert_eq!(guard(d, home, 0).troops.stamina.amount, 0);
    let remove = manage(ManageTroops::RemoveGuard(GuardSlot { structure_id: home.entity_id, slot: 0 }));
    assert!(execute(d, remove, 180));
    assert_eq!(guard(d, home, 0).troops.count, 0);
    assert_eq!(guard(d, home, 0).destroyed_tick, 2);
    assert_terminal_rejection(d, remove, 180);
    assert!(execute(d, manage(ManageTroops::RemoveExplorer(first)), 180));
    assert!(troop(d, first).is_none());
    assert!(!resource(d).has_resource(ResourceKey { game_id: 3, entity_id: first }));
    assert_terminal_rejection(d, manage(ManageTroops::RemoveExplorer(first)), 180);
}

#[test]
fn biome_damage_and_travel_modifiers_retain_every_category_and_biome() {
    let damage = array![
        array![0_u8, 0, 0, 2, 0, 0, 2, 2, 2, 0, 1, 0, 1, 1, 2, 1, 1, 0].span(),
        array![0_u8, 2, 2, 0, 2, 1, 1, 0, 1, 1, 2, 1, 2, 2, 1, 2, 2, 0].span(),
        array![0_u8, 1, 1, 1, 1, 2, 0, 1, 0, 2, 0, 2, 0, 0, 0, 0, 0, 0].span(),
    ];
    let travel = array![
        array![0_u8, 2, 2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].span(),
        array![0_u8, 2, 2, 0, 1, 2, 2, 0, 2, 2, 1, 2, 1, 1, 2, 1, 1, 0].span(),
        array![0_u8, 2, 2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].span(),
    ];
    let rules = super::recorded::rules();
    let categories = array![TroopType::Knight, TroopType::Paladin, TroopType::Crossbowman];
    for category in 0_u32..3 {
        for biome in 0_u8..18 {
            let mut troops = crate::troops::Troops { category: *categories.at(category), ..Default::default() };
            let expected = match *damage.at(category).at(biome.into()) {
                0 => FixedTrait::ONE(),
                1 => FixedTrait::new(10000 + rules.troop_damage_config.damage_biome_bonus_num.into(), false)
                    / FixedTrait::new(10000, false),
                2 => FixedTrait::new(10000 - rules.troop_damage_config.damage_biome_bonus_num.into(), false)
                    / FixedTrait::new(10000, false),
                _ => panic!("invalid damage vector"),
            };
            assert!(troops._biome_damage_bonus(biome.into(), rules.troop_damage_config) == expected);
            let (positive, amount) = troops.stamina_travel_bonus(biome.into(), rules.troop_stamina_config);
            let modifier = *travel.at(category).at(biome.into());
            assert_eq!(positive, modifier == 1);
            assert_eq!(amount, if modifier == 0 {
                0
            } else {
                rules.troop_stamina_config.stamina_bonus_value
            });
        }
    }
}

#[test]
fn reinforcement_requires_target_ownership_for_realms_and_villages_without_home_lineage() {
    let (d, home, other) = super::resource_commands::setup();
    grant(d, home, 26, 100 * RESOURCE_PRECISION);
    assert!(
        execute(
            d,
            Command::CreateExplorer(
                CreateExplorer {
                    structure_id: home.entity_id, category: 0, tier: 0, amount: 10 * RESOURCE_PRECISION, direction: 0,
                },
            ),
            80,
        ),
    );
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let id = *structures.home_armies(home).at(0);
    let original = structures.structure(other).unwrap();
    let mut explorer = troop(d, id).unwrap();
    explorer.coord = crate::geometry::neighbor(structures.position(other).unwrap(), 0);
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: 3, explorer_id: id }, explorer,
    );
    for category in array![1_u8, 5] {
        for owner in array![d.actor, 777.try_into().unwrap(), 888.try_into().unwrap()] {
            set_fixture(
                d.games,
                selector!("structures"),
                selector!("structures"),
                array![3, other.entity_id.into()].span(),
                crate::structures::StructureRecord {
                    owner,
                    base: crate::structures::StructureBase { category, ..original.base },
                    metadata: original.metadata,
                    resources_packed: original.resources_packed,
                },
            );
            let command = transfer(
                Army::Explorer(id), Army::Guard(GuardSlot { structure_id: other.entity_id, slot: 0 }), 1,
            );
            if owner == d.actor {
                assert!(execute(d, command, 140));
            } else {
                assert_terminal_rejection(d, command, 140);
            }
        }
    }
    assert_eq!(guard(d, other, 0).troops.count, 2 * RESOURCE_PRECISION);
    assert_eq!(troop(d, id).unwrap().troops.count, 8 * RESOURCE_PRECISION);
}

#[test]
fn guard_slot_bounds_reject_recruitment_and_both_transfer_ends_without_spending() {
    let (d, home, first, _) = setup();
    let balance = count(d, home);
    let before = troop(d, first);
    for slot in 1_u8..5 {
        assert_terminal_rejection(d, recruit(home, slot, 1), 140);
        let guard = Army::Guard(GuardSlot { structure_id: home.entity_id, slot });
        assert_terminal_rejection(d, transfer(Army::Explorer(first), guard, 1), 140);
        assert_terminal_rejection(d, transfer(guard, Army::Explorer(first), 1), 140);
        assert_eq!(count(d, home), balance);
        assert_eq!(troop(d, first), before);
    }
    assert!(execute(d, recruit(home, 0, 1), 140));
    assert!(
        execute(
            d,
            transfer(Army::Explorer(first), Army::Guard(GuardSlot { structure_id: home.entity_id, slot: 0 }), 1),
            140,
        ),
    );
    assert_eq!(guard(d, home, 0).troops.count, 2 * RESOURCE_PRECISION);
}

#[test]
fn recruitment_and_transfers_enforce_army_size_before_any_balance_or_capacity_change() {
    let (d, home, first, second) = setup();
    let rules = super::recorded::rules();
    let maximum = crate::troops::max_army_size(rules.troop_limit_config, 0, TroopTier::T1);
    grant(d, home, 26, Into::<u32, u128>::into(maximum) * RESOURCE_PRECISION);
    let balance = count(d, home);
    let weight = resource(d).resource_weight(ResourceKey { game_id: 3, entity_id: first });
    assert_terminal_rejection(
        d,
        manage(
            ManageTroops::RecruitExplorer(
                RecruitExplorer { explorer_id: first, amount: Into::<u32, u128>::into(maximum) * RESOURCE_PRECISION },
            ),
        ),
        140,
    );
    assert_terminal_rejection(d, recruit(home, 0, maximum.into() + 1), 140);
    assert_eq!(count(d, home), balance);
    assert_eq!(resource(d).resource_weight(ResourceKey { game_id: 3, entity_id: first }), weight);
    let mut target = troop(d, second).unwrap();
    target.troops.count = Into::<u32, u128>::into(maximum) * RESOURCE_PRECISION;
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: 3, explorer_id: second }, target,
    );
    assert_terminal_rejection(d, transfer(Army::Explorer(first), Army::Explorer(second), 1), 140);
    assert_eq!(troop(d, second).unwrap(), target);
    assert_eq!(troop(d, first).unwrap().troops.count, 10 * RESOURCE_PRECISION);
    assert!(execute(d, recruit(home, 0, maximum.into()), 140));
    let before = guard(d, home, 0);
    assert_terminal_rejection(
        d, transfer(Army::Explorer(first), Army::Guard(GuardSlot { structure_id: home.entity_id, slot: 0 }), 1), 140,
    );
    assert_eq!(guard(d, home, 0), before);
    assert_eq!(troop(d, first).unwrap().troops.count, 10 * RESOURCE_PRECISION);
}

#[test]
fn troop_actions_emit_one_unique_story_each_and_rejections_emit_none() {
    let (d, home, first, second) = setup();
    let mut spy = spy_events();
    let created = CreateExplorer {
        structure_id: home.entity_id, category: 0, tier: 0, amount: RESOURCE_PRECISION, direction: 2,
    };
    assert!(execute(d, Command::CreateExplorer(created), 140));
    let third = *IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home).at(2);
    assert!(execute(d, recruit(home, 0, 3), 140));
    let recruitment = RecruitExplorer { explorer_id: first, amount: 2 * RESOURCE_PRECISION };
    assert!(execute(d, manage(ManageTroops::RecruitExplorer(recruitment)), 140));
    let slot = GuardSlot { structure_id: home.entity_id, slot: 0 };
    let mut expected = array![
        Story::ExplorerCreateStory(
            crate::troop_management::ExplorerCreated {
                explorer_id: third,
                structure_id: home.entity_id,
                category: TroopType::Knight,
                tier: TroopTier::T1,
                amount: RESOURCE_PRECISION,
                spawn_direction: crate::geometry::Direction::NorthWest,
            },
        ),
        Story::GuardAddStory(
            GuardAddStory {
                structure_id: home.entity_id,
                slot: 0,
                category: TroopType::Knight,
                tier: TroopTier::T1,
                amount: 3 * RESOURCE_PRECISION,
            },
        ),
        Story::ExplorerAddStory(recruitment),
    ];
    for (source, target) in array![
        (Army::Explorer(first), Army::Explorer(second)), (Army::Explorer(first), Army::Guard(slot)),
        (Army::Guard(slot), Army::Explorer(first)),
    ] {
        let transfer = TransferTroops { source, target, amount: RESOURCE_PRECISION };
        assert!(execute(d, manage(ManageTroops::Transfer(transfer)), 140));
        expected.append(Story::TroopsTransferred(transfer));
    }
    assert!(execute(d, manage(ManageTroops::RemoveGuard(slot)), 140));
    expected.append(Story::GuardDeleteStory(slot));
    assert!(execute(d, manage(ManageTroops::RemoveExplorer(third)), 140));
    expected.append(Story::ExplorerDeleteStory(crate::troop_management::ExplorerRemoved { explorer_id: third }));
    assert_terminal_rejection(d, manage(ManageTroops::RemoveGuard(slot)), 140);
    let mut ids: core::dict::Felt252Dict<u128> = Default::default();
    let mut index = 0;
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if *event.keys.at(0) != selector!("StoryEvent") {
            continue;
        }
        let mut keys = event.keys.span().slice(1, event.keys.len() - 1);
        let mut data = event.data.span();
        let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref data).unwrap();
        let id: felt252 = Into::<u64, felt252>::into(story.order) * 0x100000000 + story.index.into();
        assert!(story.order != 0 && ids.get(id) == 0, "duplicate story identity");
        ids.insert(id, 1);
        assert_eq!(story.story, *expected.at(index));
        assert_eq!(story.timestamp, 140);
        index += 1;
    }
    assert_eq!(index, expected.len());
}

#[test]
fn entity_names_follow_owned_armies_and_reject_missing_or_foreign_entities() {
    let (d, home, explorer, _) = setup();
    let names = INamesDispatcher { contract_address: d.games };
    let key = ResourceKey { game_id: 3, entity_id: explorer };
    assert!(execute(d, Command::SetEntityName(SetEntityName { entity_id: explorer, name: 'Vanguard' }), 80));
    assert_eq!(names.entity_name(key).name, 'Vanguard');
    assert!(execute(d, Command::SetEntityName(SetEntityName { entity_id: home.entity_id, name: 'Home' }), 80));
    assert_eq!(names.entity_name(home).name, 'Home');
    assert_terminal_rejection(d, Command::SetEntityName(SetEntityName { entity_id: 99999, name: 'Missing' }), 80);
    let mut record = IStructureOperationsDispatcher { contract_address: d.games }.structure(home).unwrap();
    record.owner = 0x123.try_into().unwrap();
    set_fixture(
        d.games,
        selector!("structures"),
        selector!("structures"),
        array![3, home.entity_id.into()].span(),
        crate::structures::StructureRecord {
            owner: record.owner,
            base: record.base,
            resources_packed: record.resources_packed,
            metadata: record.metadata,
        },
    );
    assert_terminal_rejection(d, Command::SetEntityName(SetEntityName { entity_id: explorer, name: 'Stolen' }), 80);
    assert_eq!(names.entity_name(key).name, 'Vanguard');
}

#[test]
fn five_step_move_charges_five_times_one_step_food() {
    let (d, home, first, _) = setup();
    grant(d, home, 35, 1000 * RESOURCE_PRECISION);
    grant(d, home, 36, 1000 * RESOURCE_PRECISION);
    let mut explorer = troop(d, first).unwrap();
    let start = explorer.coord;
    let map = IMapLogicDispatcher { contract_address: d.games };
    for offset in 1_u32..7 {
        map.reveal(crate::geometry::tile_key(3, crate::troops::Coord { x: start.x + offset, ..start }), 11);
    }
    explorer.troops.stamina.amount = 120;
    explorer.troops.stamina.updated_tick = 2;
    super::resource_commands::set_explorer_fixture(d.games, ExplorerKey { game_id: 3, explorer_id: first }, explorer);
    let wheat = ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 35 };
    let fish = ResourceSlot { resource_type: 36, ..wheat };
    let wheat_before = resource(d).resource_balance(wheat);
    let fish_before = resource(d).resource_balance(fish);
    assert!(execute(d, Command::Move(Move { explorer_id: first, directions: array![0].span() }), 120));
    let wheat_after_one = resource(d).resource_balance(wheat);
    let fish_after_one = resource(d).resource_balance(fish);
    let wheat_per_step = wheat_before - wheat_after_one;
    let fish_per_step = fish_before - fish_after_one;
    assert!(wheat_per_step > 0 && fish_per_step > 0, "fixture must charge both foods");
    assert!(execute(d, Command::Move(Move { explorer_id: first, directions: array![0, 0, 0, 0, 0].span() }), 120));
    assert_eq!(wheat_after_one - resource(d).resource_balance(wheat), 5 * wheat_per_step);
    assert_eq!(fish_after_one - resource(d).resource_balance(fish), 5 * fish_per_step);
    let after = troop(d, first).unwrap();
    assert_eq!(after.coord.x, start.x + 6);
    assert_eq!(after.troops.stamina.amount, 0);
}

#[test]
fn multi_tile_move_spends_each_steps_stamina_and_rejects_a_blocked_path_atomically() {
    let (d, home, first, _) = setup();
    grant(d, home, 35, 1000 * RESOURCE_PRECISION);
    grant(d, home, 36, 1000 * RESOURCE_PRECISION);
    let start = troop(d, first).unwrap().coord;
    let map = IMapLogicDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, d.games);
    for offset in 1_u32..3 {
        let coord = crate::troops::Coord { x: start.x + offset, ..start };
        map.reveal(crate::geometry::tile_key(3, coord), 11); // Grassland: knight's neutral travel biome.
    }
    stop_cheat_caller_address(d.games);
    let mut before = troop(d, first).unwrap();
    before.troops.stamina.amount = 120;
    before.troops.stamina.updated_tick = 2;
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: 3, explorer_id: first }, before,
    );
    assert!(execute(d, Command::Move(Move { explorer_id: first, directions: array![0, 0].span() }), 120));
    let after = troop(d, first).unwrap();
    assert_eq!(after.coord.x, start.x + 2);
    assert_eq!(after.coord.y, start.y);
    assert_eq!(after.troops.stamina.amount, 80); // Pinned travel cost: 20 per neutral tile.
    crate::tests::state::assert_spatial_indexes(
        d.games, 3, array![home.entity_id, first].span(), array![start, after.coord].span(),
    );
    assert_eq!(map.tile(crate::geometry::tile_key(3, start)).unwrap().data % 0x20000000000, 0);
    assert_eq!(
        map
            .tile(crate::geometry::tile_key(3, crate::troops::Coord { x: start.x + 1, ..start }))
            .unwrap()
            .data % 0x20000000000,
        0,
    );
    let occupied = map.tile(crate::geometry::tile_key(3, after.coord)).unwrap();
    let wheat = ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 35 };
    let fish = ResourceSlot { resource_type: 36, ..wheat };
    let wheat_before_rejection = resource(d).resource_balance(wheat);
    let fish_before_rejection = resource(d).resource_balance(fish);
    // Two steps can succeed, but the third enters the home realm. No partial movement survives.
    assert_terminal_rejection(d, Command::Move(Move { explorer_id: first, directions: array![3, 3, 3].span() }), 120);
    assert_eq!(troop(d, first).unwrap(), after);
    assert_eq!(map.tile(crate::geometry::tile_key(3, after.coord)).unwrap(), occupied);
    assert_eq!(resource(d).resource_balance(wheat), wheat_before_rejection);
    assert_eq!(resource(d).resource_balance(fish), fish_before_rejection);
}

#[test]
fn occupied_explorer_destination_rejects_without_rewriting_the_tile_or_spending() {
    let (d, home, first, _) = setup();
    let explorer = troop(d, first).unwrap();
    let map = IMapLogicDispatcher { contract_address: d.games };
    let location = crate::geometry::tile_key(3, explorer.coord);
    let tile = map.tile(location).unwrap();
    let balance = count(d, home);
    assert_terminal_rejection(
        d,
        Command::CreateExplorer(
            CreateExplorer {
                structure_id: home.entity_id, category: 0, tier: 0, amount: RESOURCE_PRECISION, direction: 0,
            },
        ),
        80,
    );
    assert_eq!(map.tile(location).unwrap(), tile);
    assert_eq!(troop(d, first).unwrap(), explorer);
    assert_eq!(count(d, home), balance);
}
