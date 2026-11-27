use snforge_std::fs::{FileTrait, read_txt};
pub use world_test_support::tests::troop_management::*;
use crate::names::{INamesSafeDispatcher, INamesSafeDispatcherTrait};
const NOW: u64 = super::play_fixture::FIXTURE_START + 20;


#[test]
fn spatial_commands_match_replay_views() {
    replay_armies(false);
}

#[test]
#[ignore]
fn record_spatial_replay_armies() {
    replay_armies(true);
}

#[test]
fn explorer_recruitment_spends_troop_resources_and_grows_capacity() {
    let (d, home, first, _) = setup();
    fund(d, home, first, 2);
    let before = count(d, home);
    let capacity = resource(d).resource_weight(ResourceKey { game_id: 3, entity_id: first }).capacity;
    assert!(
        execute(
            d,
            manage(
                ManageTroops::RecruitExplorer(
                    RecruitExplorer { explorer_id: first, amount: 2 * RESOURCE_PRECISION, supply_post: None },
                ),
            ),
            NOW,
        ),
    );
    assert_eq!(troop(d, first).unwrap().troops.count, 12 * RESOURCE_PRECISION);
    let troop_capacity: u128 = crate::balance::rules::CAPACITY_CONFIG.troop_capacity.into();
    assert_eq!(
        resource(d).resource_weight(ResourceKey { game_id: 3, entity_id: first }).capacity,
        capacity + troop_capacity * 2 * RESOURCE_PRECISION,
    );
    assert_eq!(count(d, home), before - 2 * RESOURCE_PRECISION);
}

#[test]
fn explorer_transfer_preserves_the_worse_stamina_and_cooldown_and_deletes_an_empty_source() {
    let (d, home, first, second) = setup();
    for (id, stamina, cooldown) in array![(first, 2_u64, 190_u32), (second, 9, 150)] {
        let mut row = troop(d, id).unwrap();
        row.troops.stamina.set_amount(stamina);
        row.troops.stamina.set_settled_at(NOW);
        row.troops.battle_cooldown_end = cooldown;
        crate::tests::resource_commands::set_explorer_fixture(
            d.games, crate::troops::ExplorerKey { game_id: 3, explorer_id: id }, row,
        );
    }
    let old_position = troop(d, first).unwrap().coord;
    assert!(execute(d, transfer(Army::Explorer(first), Army::Explorer(second), 10), NOW));
    assert!(troop(d, first).is_none());
    assert!(!resource(d).has_resource(ResourceKey { game_id: 3, entity_id: first }));
    let target = troop(d, second).unwrap().troops;
    assert_eq!(target.count, 15 * RESOURCE_PRECISION);
    assert_eq!(target.stamina.inline().amount, 2);
    assert_eq!(target.battle_cooldown_end, 190);
    assert_eq!(IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home), array![second].span());
    let _tile = crate::tests::state::MapObservationTrait::tile(
        crate::map::IMapLogicDispatcher { contract_address: d.games }, crate::geometry::tile_key(3, old_position),
    )
        .unwrap();
    assert!(
        crate::map::IMapLogicDispatcher { contract_address: d.games }
            .occupancy(crate::geometry::tile_key(3, old_position))
            .is_none(),
    );
    super::state::assert_spatial_indexes(
        d.games,
        3,
        array![home.entity_id, first, second].span(),
        array![old_position, troop(d, second).unwrap().coord].span(),
    );
}

#[test]
fn malformed_amounts_overweight_transfers_and_wrong_categories_reject_without_spending() {
    let (d, home, first, second) = setup();
    let before = count(d, home);
    for amount in array![0, RESOURCE_PRECISION - 1, 100000000 * RESOURCE_PRECISION] {
        assert_terminal_rejection(
            d,
            manage(ManageTroops::RecruitExplorer(RecruitExplorer { explorer_id: first, amount, supply_post: None })),
            NOW,
        );
    }
    assert_eq!(count(d, home), before);
    assert_eq!(troop(d, first).unwrap().troops.count, 10 * RESOURCE_PRECISION);
    let cargo = ResourceKey { game_id: 3, entity_id: first };
    grant(d, cargo, crate::resources::LABOR, resource(d).resource_weight(cargo).capacity);
    let load = resource(d).resource_weight(cargo);
    assert_eq!(load.weight, load.capacity);
    assert_terminal_rejection(d, transfer(Army::Explorer(first), Army::Explorer(second), 1), NOW);
    assert_eq!(resource(d).resource_weight(cargo), load);
    let mut target = troop(d, second).unwrap();
    target.troops.category = TroopType::Paladin;
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: 3, explorer_id: second }, target,
    );
    assert_terminal_rejection(d, transfer(Army::Explorer(first), Army::Explorer(second), 1), NOW);
}

#[test]
fn explorer_deletion_clears_its_owned_facts_and_cannot_repeat() {
    let (d, _, first, _) = setup();
    assert!(execute(d, manage(ManageTroops::RemoveExplorer(first)), NOW + 40));
    assert!(troop(d, first).is_none());
    assert!(!resource(d).has_resource(ResourceKey { game_id: 3, entity_id: first }));
    assert_terminal_rejection(d, manage(ManageTroops::RemoveExplorer(first)), NOW + 40);
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
    let damage_config = crate::balance::rules::TROOP_DAMAGE_CONFIG;
    let stamina_config = crate::balance::rules::TROOP_STAMINA_CONFIG;
    let categories = array![TroopType::Knight, TroopType::Paladin, TroopType::Crossbowman];
    for category in 0_u32..3 {
        for biome in 0_u8..18 {
            let mut troops = crate::troops::Troops { category: *categories.at(category), ..Default::default() };
            let expected = match *damage.at(category).at(biome.into()) {
                0 => FixedTrait::ONE(),
                1 => FixedTrait::new(10000 + damage_config.damage_biome_bonus_num.into(), false)
                    / FixedTrait::new(10000, false),
                2 => FixedTrait::new(10000 - damage_config.damage_biome_bonus_num.into(), false)
                    / FixedTrait::new(10000, false),
                _ => panic!("invalid damage vector"),
            };
            assert!(troops._biome_damage_bonus(biome.into(), damage_config) == expected);
            let (positive, amount) = troops.stamina_travel_bonus(biome.into(), stamina_config);
            let modifier = *travel.at(category).at(biome.into());
            assert_eq!(positive, modifier == 1);
            assert_eq!(amount, if modifier == 0 {
                0
            } else {
                stamina_config.stamina_bonus_value
            });
        }
    }
}

#[test]
fn season_one_homes_hold_no_guards_and_refuse_every_guard_slot_without_spending() {
    let config = crate::balance::rules::TROOP_LIMIT_CONFIG;
    for level in 0_u8..4 {
        let (_, guards) = crate::upgrades::troop_limits(config, level);
        assert_eq!(guards, 0);
    }
    let (d, home, first, _) = setup();
    fund(d, home, first, 1);
    let balance = count(d, home);
    let before = troop(d, first);
    for slot in 0_u8..5 {
        assert_terminal_rejection(d, recruit(home, slot, 1), NOW);
        let guard = Army::Guard(GuardSlot { structure_id: home.entity_id, slot });
        assert_terminal_rejection(d, transfer(Army::Explorer(first), guard, 1), NOW);
        assert_terminal_rejection(d, transfer(guard, Army::Explorer(first), 1), NOW);
        assert_eq!(count(d, home), balance);
        assert_eq!(troop(d, first), before);
    }
}

#[test]
fn recruitment_and_transfers_enforce_army_size_before_any_balance_or_capacity_change() {
    let (d, home, first, second) = setup();
    let rules = crate::tests::context(d.games, 3).rules.unbox();
    let maximum = crate::troops::max_army_size(rules.troop_limit_config, 0, TroopTier::T1);
    grant(d, home, 26, Into::<u32, u128>::into(maximum) * RESOURCE_PRECISION);
    let balance = count(d, home);
    let weight = resource(d).resource_weight(ResourceKey { game_id: 3, entity_id: first });
    assert_terminal_rejection(
        d,
        manage(
            ManageTroops::RecruitExplorer(
                RecruitExplorer {
                    explorer_id: first,
                    amount: Into::<u32, u128>::into(maximum) * RESOURCE_PRECISION,
                    supply_post: None,
                },
            ),
        ),
        NOW,
    );
    assert_eq!(count(d, home), balance);
    assert_eq!(resource(d).resource_weight(ResourceKey { game_id: 3, entity_id: first }), weight);
    let mut target = troop(d, second).unwrap();
    target.troops.count = Into::<u32, u128>::into(maximum) * RESOURCE_PRECISION;
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: 3, explorer_id: second }, target,
    );
    assert_terminal_rejection(d, transfer(Army::Explorer(first), Army::Explorer(second), 1), NOW);
    assert_eq!(troop(d, second).unwrap(), target);
    assert_eq!(troop(d, first).unwrap().troops.count, 10 * RESOURCE_PRECISION);
}

#[test]
fn troop_actions_emit_one_unique_story_each_and_rejections_emit_none() {
    let (d, home, first, second) = setup();
    fund(d, home, first, 3);
    let mut spy = spy_events();
    let created = CreateExplorer {
        slot: 2, structure_id: home.entity_id, category: 0, tier: 0, amount: RESOURCE_PRECISION, direction: 2,
    };
    assert!(execute(d, Command::CreateExplorer(created), NOW));
    let third = *IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home).at(2);
    let recruitment = RecruitExplorer { explorer_id: first, amount: 2 * RESOURCE_PRECISION, supply_post: None };
    assert!(execute(d, manage(ManageTroops::RecruitExplorer(recruitment)), NOW));
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
        Story::ExplorerAddStory(
            crate::troop_management::ExplorerAdded { explorer_id: recruitment.explorer_id, amount: recruitment.amount },
        ),
    ];
    let transfer = TransferTroops {
        source: Army::Explorer(first), target: Army::Explorer(second), amount: RESOURCE_PRECISION,
    };
    assert!(execute(d, manage(ManageTroops::Transfer(transfer)), NOW));
    expected.append(Story::TroopsTransferred(transfer));
    assert!(execute(d, manage(ManageTroops::RemoveExplorer(third)), NOW));
    expected.append(Story::ExplorerDeleteStory(crate::troop_management::ExplorerRemoved { explorer_id: third }));
    assert_terminal_rejection(d, manage(ManageTroops::RemoveExplorer(third)), NOW);
    let mut index = 0;
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if *event.keys.at(0) != selector!("StoryEvent") {
            continue;
        }
        let mut keys = event.keys.span().slice(1, event.keys.len() - 1);
        let mut data = event.data.span();
        let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref data).unwrap();
        assert_eq!(story.story, *expected.at(index));
        assert_eq!(story.timestamp, NOW);
        index += 1;
    }
    assert_eq!(index, expected.len());
}

#[test]
fn entity_names_follow_owned_armies_and_reject_missing_or_foreign_entities() {
    let (d, home, explorer, _) = setup();
    let names = INamesDispatcher { contract_address: d.games };
    let key = ResourceKey { game_id: 3, entity_id: explorer };
    assert!(execute(d, Command::SetEntityName(SetEntityName { entity_id: explorer, name: 'Vanguard' }), NOW));
    assert_eq!(names.entity_name(key).name, 'Vanguard');
    assert!(execute(d, Command::SetEntityName(SetEntityName { entity_id: home.entity_id, name: 'Home' }), NOW));
    assert_eq!(names.entity_name(home).name, 'Home');
    assert_terminal_rejection(d, Command::SetEntityName(SetEntityName { entity_id: 99999, name: 'Missing' }), NOW);
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
    assert_terminal_rejection(d, Command::SetEntityName(SetEntityName { entity_id: explorer, name: 'Stolen' }), NOW);
    assert_eq!(names.entity_name(key).name, 'Vanguard');
}

#[test]
fn realm_skins_take_only_a_family_the_realm_holds() {
    let (d, home, _, _) = setup();
    let names = INamesDispatcher { contract_address: d.games };
    let realm = home.entity_id;
    let mut record = IStructureOperationsDispatcher { contract_address: d.games }.structure(home).unwrap();
    let keys = array![3, realm.into()].span();
    let no_seal: Option<u64> = None;
    set_fixture(d.games, selector!("entry"), selector!("seals"), array![3, record.owner.into()].span(), no_seal);
    set_fixture(d.games, selector!("settlements"), selector!("home_aspects"), keys, 0_u8);
    assert!(execute(d, Command::SetRealmSkin(SetRealmSkin { entity_id: realm, family: BASE_REALM_SKIN }), NOW));
    assert_eq!(names.realm_skin(home).family, BASE_REALM_SKIN);
    assert_terminal_rejection(
        d, Command::SetRealmSkin(SetRealmSkin { entity_id: realm, family: SEASON_ONE_REALM_SKIN }), NOW,
    );
    assert_terminal_rejection(
        d, Command::SetRealmSkin(SetRealmSkin { entity_id: realm, family: DEVCON_REALM_SKIN }), NOW,
    );
    assert_terminal_rejection(
        d, Command::SetRealmSkin(SetRealmSkin { entity_id: realm, family: GOLDEN_DEVCON_REALM_SKIN }), NOW,
    );
    assert_terminal_rejection(d, Command::SetRealmSkin(SetRealmSkin { entity_id: realm, family: 6 }), NOW);
    record.metadata.has_wonder = false;
    set_realm_fixture(d, keys, record);
    assert_terminal_rejection(
        d, Command::SetRealmSkin(SetRealmSkin { entity_id: realm, family: WONDER_REALM_SKIN }), NOW,
    );
    record.metadata.has_wonder = true;
    set_realm_fixture(d, keys, record);
    assert!(execute(d, Command::SetRealmSkin(SetRealmSkin { entity_id: realm, family: WONDER_REALM_SKIN }), NOW));
    assert_eq!(names.realm_skin(home).family, WONDER_REALM_SKIN);
    set_fixture(d.games, selector!("entry"), selector!("seals"), array![3, record.owner.into()].span(), Some(NOW));
    assert_terminal_rejection(
        d, Command::SetRealmSkin(SetRealmSkin { entity_id: realm, family: SEASON_ONE_REALM_SKIN }), NOW,
    );
    set_fixture(d.games, selector!("settlements"), selector!("home_aspects"), keys, 2_u8);
    assert!(execute(d, Command::SetRealmSkin(SetRealmSkin { entity_id: realm, family: SEASON_ONE_REALM_SKIN }), NOW));
    assert_eq!(names.realm_skin(home).family, SEASON_ONE_REALM_SKIN);
    assert!(execute(d, Command::SetRealmSkin(SetRealmSkin { entity_id: realm, family: DEFAULT_REALM_SKIN }), NOW));
    assert_eq!(names.realm_skin(home).family, DEFAULT_REALM_SKIN);
    record.owner = 0x123.try_into().unwrap();
    set_realm_fixture(d, keys, record);
    assert_terminal_rejection(
        d, Command::SetRealmSkin(SetRealmSkin { entity_id: realm, family: BASE_REALM_SKIN }), NOW,
    );
    assert_eq!(names.realm_skin(home).family, DEFAULT_REALM_SKIN);
}

#[test]
#[feature("safe_dispatcher")]
fn devcon_holders_can_equip_only_the_devcon_skins_they_hold_on_prod() {
    let (d, home, _, _) = setup();
    let names = INamesDispatcher { contract_address: d.games };
    let safe_names = INamesSafeDispatcher { contract_address: d.games };
    let realm = home.entity_id;
    let keys = array![3, realm.into()].span();
    let action = crate::commands::ActionContext {
        timestamp: NOW, ..crate::commands::action_context(super::context(d.games, 3)),
    };
    let mut record = IStructureOperationsDispatcher { contract_address: d.games }.structure(home).unwrap();
    let regular: starknet::ContractAddress = (*crate::devcon_holders::REGULAR_DEVCON_HOLDERS.span().at(0))
        .try_into()
        .unwrap();
    let golden: starknet::ContractAddress = (*crate::devcon_holders::GOLDEN_DEVCON_HOLDERS.span().at(0))
        .try_into()
        .unwrap();

    record.owner = regular;
    set_realm_fixture(d, keys, record);
    names.set_realm_skin(3, regular, SetRealmSkin { entity_id: realm, family: DEVCON_REALM_SKIN }, action);
    assert_eq!(names.realm_skin(home).family, DEVCON_REALM_SKIN);
    assert!(
        safe_names
            .set_realm_skin(3, regular, SetRealmSkin { entity_id: realm, family: GOLDEN_DEVCON_REALM_SKIN }, action)
            .is_err(),
    );
    assert_eq!(names.realm_skin(home).family, DEVCON_REALM_SKIN);

    record.owner = golden;
    set_realm_fixture(d, keys, record);
    names.set_realm_skin(3, golden, SetRealmSkin { entity_id: realm, family: GOLDEN_DEVCON_REALM_SKIN }, action);
    assert_eq!(names.realm_skin(home).family, GOLDEN_DEVCON_REALM_SKIN);
    names.set_realm_skin(3, golden, SetRealmSkin { entity_id: realm, family: DEVCON_REALM_SKIN }, action);
    assert_eq!(names.realm_skin(home).family, DEVCON_REALM_SKIN);
}

#[test]
fn dev_mode_game_unlocks_every_known_realm_skin_and_rejects_unknown_families() {
    let (d, _, _, _) = setup();
    let mut params = super::play_fixture::fixture_params('dev-skins');
    params.dev_mode_on = true;
    let game_id = super::play_fixture::create_game(d.games, params);
    let home = super::play_fixture::settled_home(d, game_id, d.actor, 1, super::play_fixture::FIXTURE_START);
    let realm = home.entity_id;
    let keys = array![game_id.into(), realm.into()].span();
    let names = INamesDispatcher { contract_address: d.games };
    let mut record = IStructureOperationsDispatcher { contract_address: d.games }.structure(home).unwrap();
    record.metadata.has_wonder = false;
    set_realm_fixture(d, keys, record);
    let no_seal: Option<u64> = None;
    set_fixture(
        d.games, selector!("entry"), selector!("seals"), array![game_id.into(), record.owner.into()].span(), no_seal,
    );
    set_fixture(d.games, selector!("settlements"), selector!("home_aspects"), keys, 2_u8);
    for family in array![
        BASE_REALM_SKIN, SEASON_ONE_REALM_SKIN, WONDER_REALM_SKIN, DEVCON_REALM_SKIN, GOLDEN_DEVCON_REALM_SKIN,
        DEFAULT_REALM_SKIN,
    ] {
        assert!(
            super::resource_commands::execute_in_game(
                d, game_id, Command::SetRealmSkin(SetRealmSkin { entity_id: realm, family }), NOW,
            ),
        );
        assert_eq!(names.realm_skin(home).family, family);
    }
    assert!(
        !super::resource_commands::execute_in_game(
            d, game_id, Command::SetRealmSkin(SetRealmSkin { entity_id: realm, family: 6 }), NOW,
        ),
    );
    assert_eq!(names.realm_skin(home).family, DEFAULT_REALM_SKIN);
}

#[test]
fn realm_skin_holds_match_the_client_vectors() {
    let data = read_txt(@FileTrait::new("../fixtures/realm-skin-holds.txt"));
    assert_eq!(data.len(), 3584);
    let mut fields = data.span();
    while !fields.is_empty() {
        let (
            seal, aspect, wonder, devcon, golden_devcon, dev_unlocked, family, held,
        ): (u8, u8, u8, u8, u8, u8, u8, u8) =
            Serde::deserialize(
            ref fields,
        )
            .unwrap();
        assert_eq!(
            crate::names::holds_realm_skin(
                seal == 1, aspect, wonder == 1, devcon == 1, golden_devcon == 1, dev_unlocked == 1, family,
            ),
            held == 1,
        );
    }
}

fn set_realm_fixture(d: super::Deployment, keys: Span<felt252>, record: crate::structures::Structure) {
    set_fixture(
        d.games,
        selector!("structures"),
        selector!("structures"),
        keys,
        crate::structures::StructureRecord {
            owner: record.owner,
            base: record.base,
            resources_packed: record.resources_packed,
            metadata: record.metadata,
        },
    );
}

#[test]
fn five_step_move_charges_five_times_one_steps_wheat_and_stamina_and_no_fish() {
    let (d, home, first, _) = setup();
    grant(d, home, 35, 1000 * RESOURCE_PRECISION);
    grant(d, home, 36, 1000 * RESOURCE_PRECISION);
    let mut explorer = troop(d, first).unwrap();
    let start = explorer.coord;
    let map = IMapLogicDispatcher { contract_address: d.games };
    for offset in 1_u32..7 {
        map.reveal(crate::geometry::tile_key(3, crate::troops::Coord { x: start.x + offset, ..start }), 11);
    }
    explorer.troops.stamina.set_amount(120);
    explorer.troops.stamina.set_settled_at(NOW);
    super::resource_commands::set_explorer_fixture(d.games, ExplorerKey { game_id: 3, explorer_id: first }, explorer);
    let wheat = ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 35 };
    let fish = ResourceSlot { resource_type: 36, ..wheat };
    let wheat_before = resource(d).resource_balance(wheat);
    let fish_before = resource(d).resource_balance(fish);
    assert!(execute(d, Command::Move(Move { explorer_id: first, directions: array![0].span() }), NOW));
    let wheat_after_one = resource(d).resource_balance(wheat);
    let wheat_per_step = wheat_before - wheat_after_one;
    let stamina_per_step = 120 - troop(d, first).unwrap().troops.stamina.inline().amount;
    assert!(wheat_per_step > 0 && stamina_per_step > 0);
    assert!(execute(d, Command::Move(Move { explorer_id: first, directions: array![0, 0, 0, 0, 0].span() }), NOW));
    assert_eq!(wheat_after_one - resource(d).resource_balance(wheat), 5 * wheat_per_step);
    assert_eq!(resource(d).resource_balance(fish), fish_before);
    let after = troop(d, first).unwrap();
    assert_eq!(after.coord.x, start.x + 6);
    assert_eq!(after.troops.stamina.inline().amount, 120 - 6 * stamina_per_step);
}

#[test]
fn multi_tile_move_spends_each_steps_stamina_and_rejects_a_blocked_path_atomically() {
    let (d, home, first, second) = setup();
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
    before.troops.stamina.set_amount(120);
    before.troops.stamina.set_settled_at(NOW);
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: 3, explorer_id: first }, before,
    );
    assert!(execute(d, Command::Move(Move { explorer_id: first, directions: array![0, 0].span() }), NOW));
    let after = troop(d, first).unwrap();
    assert_eq!(after.coord.x, start.x + 2);
    assert_eq!(after.coord.y, start.y);
    let travel: u64 = crate::tests::context(d.games, 3)
        .rules
        .unbox()
        .troop_stamina_config
        .stamina_travel_stamina_cost
        .into();
    assert_eq!(after.troops.stamina.inline().amount, 120 - 2 * travel);
    crate::tests::state::assert_spatial_indexes(
        d.games, 3, array![home.entity_id, first].span(), array![start, after.coord].span(),
    );
    assert!(map.occupancy(crate::geometry::tile_key(3, start)).is_none());
    assert!(map.occupancy(crate::geometry::tile_key(3, crate::troops::Coord { x: start.x + 1, ..start })).is_none());
    super::combat_actions::move_to(d, second, start);
    let occupied = map.tile(crate::geometry::tile_key(3, after.coord)).unwrap();
    let wheat = ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 35 };
    let fish = ResourceSlot { resource_type: 36, ..wheat };
    let wheat_before_rejection = resource(d).resource_balance(wheat);
    let fish_before_rejection = resource(d).resource_balance(fish);
    assert_terminal_rejection(d, Command::Move(Move { explorer_id: first, directions: array![3, 3].span() }), NOW);
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
                slot: 0, structure_id: home.entity_id, category: 0, tier: 0, amount: RESOURCE_PRECISION, direction: 0,
            },
        ),
        NOW,
    );
    assert_eq!(map.tile(location).unwrap(), tile);
    assert_eq!(troop(d, first).unwrap(), explorer);
    assert_eq!(count(d, home), balance);
}

#[test]
fn reinforcement_sources_preserve_the_recorded_recruitment_payload() {
    for supply_post in array![None, Some(711_u64)] {
        let (id, story) = crate::troop_management::management_story(
            ManageTroops::RecruitExplorer(RecruitExplorer { explorer_id: 7, amount: 10, supply_post }),
        );
        assert_eq!(id, 7);
        match story {
            crate::ownership::Story::ExplorerAddStory(value) => {
                let mut fields = array![];
                value.serialize(ref fields);
                assert_eq!(fields.span(), array![7, 10].span());
            },
            _ => panic!("wrong reinforcement story"),
        }
    }
}

fn fund(d: super::Deployment, home: ResourceKey, army: u64, troops: u128) {
    let category = troop(d, army).unwrap().troops.category;
    super::resource_commands::fund_troops(
        d, home, crate::troops::troop_resource(category, 0), troops * RESOURCE_PRECISION,
    );
}
