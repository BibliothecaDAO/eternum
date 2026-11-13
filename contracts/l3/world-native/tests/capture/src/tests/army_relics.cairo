use crate::army_relics::{ArmyRelic, RelicKind};
use super::registrar::*;

#[test]
fn ruins_fill_replace_and_activate_an_armys_relics_through_commands() {
    let (_, mut preset) = super::preset_projection::current_definition("frontier-s1");
    let discovery = crate::expeditions::FrontierDiscoveryRules {
        beasts_bps: 100, camp_bps: 0, rift_bps: 0, ruin_bps: 4500, shrine_bps: 0, well_bps: 0, empty_reveal_limit: 7,
    };
    preset.economy.discovery = Some(discovery);
    preset.rules.battle_config.cooldown_seconds = 0;
    preset.rules.battle_config.regular_immunity_ticks = 0;
    let mut depths = array![];
    for depth in preset.settlement.depths {
        depths
            .append(
                crate::expeditions::DepthRules {
                    beast_weak_lower: 1,
                    beast_weak_upper: 1,
                    beast_strong_lower: 2,
                    beast_strong_upper: 2,
                    ruin_guard_lower: 10,
                    ruin_guard_upper: 10,
                    guard_step: 1,
                    ..*depth,
                },
            );
    }
    preset.settlement.depths = depths.span();
    let (d, game_id) = create_open_frontier(preset, BAG_SECONDS);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(crate::realms::SettleSeason { selected_realm: None, aspect: Some(1) }),
            360,
        ),
    );
    let home_id = snforge_std::interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor));
    let home = ResourceKey { game_id, entity_id: home_id };
    let explorer_id = *IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home).at(0);
    let key = ExplorerKey { game_id, explorer_id };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let lords = ResourceSlot { game_id, entity_id: home_id, resource_type: crate::resources::LORDS };
    for index in 0_u8..4 {
        let timestamp = 400 + Into::<u8, u64>::into(index) * 30;
        let kind = match index {
            0 => RelicKind::Tome,
            1 => RelicKind::Blade,
            2 => RelicKind::Ward,
            _ => RelicKind::Plunder,
        };
        let reward = ArmyRelic { kind, rank: 1 };
        let site = discover_relic(d, key, discovery, *preset.settlement.depths.at(0).chest, reward, timestamp);
        assert_eq!(read_ruin(d, site), Some(reward));
        let clear = Command::BattleGuard(
            crate::commands::Battle { attacker_id: explorer_id, defender_id: site.entity_id, relic_slot: None },
        );
        if index == 3 {
            let army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
            let inventory = read_loadout(d, key);
            assert!(!execute_in_game(d, game_id, clear, timestamp + 1));
            assert_eq!(read_loadout(d, key), inventory);
            assert_eq!(GameState { contract_address: d.games }.resolved_explorer(key).unwrap(), army);
            assert_eq!(read_ruin(d, site), Some(reward));
            assert!(
                execute_in_game(
                    d,
                    game_id,
                    Command::BattleGuard(
                        crate::commands::Battle {
                            attacker_id: explorer_id, defender_id: site.entity_id, relic_slot: Some(1),
                        },
                    ),
                    timestamp + 1,
                ),
            );
        } else {
            assert!(execute_in_game(d, game_id, clear, timestamp + 1));
        }
        assert_eq!(read_ruin(d, site), None);
        assert_eq!(resources.resource_balance(lords), 0);
        assert!(
            execute_in_game(
                d,
                game_id,
                Command::Move(crate::commands::Move { explorer_id, directions: array![0].span() }),
                timestamp + 2,
            ),
        );
    }
    let inventory = read_loadout(d, key);
    assert_eq!(inventory.first, Some(ArmyRelic { kind: RelicKind::Tome, rank: 1 }));
    assert_eq!(inventory.second, Some(ArmyRelic { kind: RelicKind::Plunder, rank: 1 }));
    assert_eq!(inventory.third, Some(ArmyRelic { kind: RelicKind::Ward, rank: 1 }));
    let essence = ResourceSlot { game_id, entity_id: home_id, resource_type: crate::resources::ESSENCE };
    let essence_before = resources.resource_balance(essence);
    let activate = Command::ApplyRelic(
        crate::relics::ApplyRelic {
            entity_id: explorer_id, relic_id: 21, recipient: crate::relics::Recipient::ArmySlot(0),
        },
    );
    assert!(execute_in_game(d, game_id, activate, 520));
    assert!(!execute_in_game(d, game_id, activate, 520));
    assert_eq!(resources.resource_balance(essence), essence_before);
    assert_eq!(read_loadout(d, key).first, None);
    assert_eq!(
        snforge_std::interact_with_state(
            d.games,
            || crate::logic::army_relics::effect(
                crate::army_relics::ArmyRelicEffectKey { game_id, explorer_id, kind: RelicKind::Tome },
            ),
        ),
        Some(crate::army_relics::ArmyRelicEffect { rank: 1, expires_at: 2320 }),
    );
    let xp = super::progression::read_progress(d, key).xp;
    let site = discover_relic(
        d, key, discovery, *preset.settlement.depths.at(0).chest, ArmyRelic { kind: RelicKind::FarEye, rank: 1 }, 550,
    );
    let site_state = snforge_std::interact_with_state(
        d.games, || crate::logic::expeditions::expedition_site(site).unwrap(),
    );
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::BattleGuard(
                crate::commands::Battle { attacker_id: explorer_id, defender_id: site.entity_id, relic_slot: None },
            ),
            551,
        ),
    );
    assert_eq!(
        super::progression::read_progress(d, key).xp - xp,
        (preset.economy.progression.unwrap().reveal_xp * 140 / 100)
            + crate::progression::clear_xp(site_state.initial_guard_count, 0) * 140 / 100,
    );
    let mut spy = snforge_std::spy_events();
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::ApplyRelic(
                crate::relics::ApplyRelic {
                    entity_id: explorer_id, relic_id: 16, recipient: crate::relics::Recipient::ArmySlot(0),
                },
            ),
            552,
        ),
    );
    let mut revealed = 0;
    for (_, event) in spy.get_events().emitted_by(d.games).events {
        if event.keys.span() == array![selector!("MapEvent"), selector!("RowSet"), 1, 'TileOpt'].span() {
            revealed += 1;
        }
    }
    assert_eq!(revealed, 6);
    assert_eq!(read_loadout(d, key).first, None);
}

fn discover_relic(
    d: super::Deployment,
    key: ExplorerKey,
    rules: crate::expeditions::FrontierDiscoveryRules,
    odds: ChestTiers,
    expected: ArmyRelic,
    timestamp: u64,
) -> ResourceKey {
    let army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    let destination = crate::geometry::neighbor(army.coord, 0);
    let root = relic_root(key.game_id, rules, odds, expected);
    assert!(explore_with_root(d, key.game_id, key.explorer_id, root, timestamp));
    let site = IMapLogicDispatcher { contract_address: d.games }
        .occupancy(crate::geometry::tile_key(key.game_id, destination))
        .unwrap();
    assert_eq!(site.category, crate::taxonomy::RUIN_CATEGORY);
    ResourceKey { game_id: key.game_id, entity_id: site.entity_id }
}

fn relic_root(
    game_id: u32, rules: crate::expeditions::FrontierDiscoveryRules, odds: ChestTiers, expected: ArmyRelic,
) -> u256 {
    for candidate in 0_u32..10_000 {
        let mut root: u256 = candidate.into();
        let seed = crate::random::game_root(ref root, game_id);
        let reward = crate::army_relics::draw(odds, seed);
        if reward == expected
            && crate::discovery::frontier(
                rules, 0, 0, 0, 100, 0, Some(reward), seed,
            ) == crate::discovery::Discovery::Ruin(reward) {
            return candidate.into();
        }
    }
    panic!("no matching relic root")
}

fn read_loadout(d: super::Deployment, key: ExplorerKey) -> crate::army_relics::ArmyRelics {
    snforge_std::interact_with_state(d.games, || crate::logic::army_relics::read(key))
}
fn read_ruin(d: super::Deployment, key: ResourceKey) -> Option<ArmyRelic> {
    snforge_std::interact_with_state(d.games, || crate::logic::army_relics::ruin(key))
}

#[test]
fn beast_clears_pay_wheat_or_triple_xp_through_explore_and_battle() {
    for kind in array![crate::expeditions::BeastKind::Cyclops, crate::expeditions::BeastKind::Wraith] {
        let (_, mut preset) = super::preset_projection::current_definition("frontier-s1");
        let discovery = crate::expeditions::FrontierDiscoveryRules {
            beasts_bps: 3000,
            camp_bps: 0,
            rift_bps: 0,
            ruin_bps: 100,
            shrine_bps: 0,
            well_bps: 0,
            empty_reveal_limit: 7,
        };
        preset.economy.discovery = Some(discovery);
        let (d, game_id) = create_open_frontier(preset, BAG_SECONDS);
        assert!(
            execute_in_game(
                d,
                game_id,
                Command::SettleSeason(crate::realms::SettleSeason { selected_realm: None, aspect: Some(1) }),
                360,
            ),
        );
        let home_id = snforge_std::interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor));
        let home = ResourceKey { game_id, entity_id: home_id };
        let explorer_id = *IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home).at(0);
        let key = ExplorerKey { game_id, explorer_id };
        let army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
        let destination = crate::geometry::neighbor(army.coord, 0);
        let mut chosen = None;
        for candidate in 0_u32..1000 {
            let mut root: u256 = candidate.into();
            let seed = crate::random::game_root(ref root, game_id);
            if crate::expeditions::beast_kind(crate::taxonomy::BEASTS_CATEGORY, seed) == kind
                && crate::discovery::frontier(
                    discovery, 0, 0, 0, 100, 0, Some(any_relic()), seed,
                ) == crate::discovery::Discovery::Beasts {
                chosen = Some(Into::<u32, u256>::into(candidate));
                break;
            }
        }
        assert!(explore_with_root(d, game_id, explorer_id, chosen.expect('no beast root'), 400));
        let occupied = IMapLogicDispatcher { contract_address: d.games }
            .occupancy(crate::geometry::tile_key(game_id, destination))
            .unwrap();
        let site_key = ResourceKey { game_id, entity_id: occupied.entity_id };
        let site = snforge_std::interact_with_state(
            d.games, || crate::logic::expeditions::expedition_site(site_key).unwrap(),
        );
        assert_eq!(site.beast_kind, kind);
        let resources = IResourceOperationsDispatcher { contract_address: d.games };
        let wheat = ResourceSlot { game_id, entity_id: home_id, resource_type: crate::resources::WHEAT };
        let labor = ResourceSlot { resource_type: crate::resources::LABOR, ..wheat };
        let before_wheat = resources.resource_balance(wheat);
        let before_labor = resources.resource_balance(labor);
        let before_xp = snforge_std::interact_with_state(d.games, || crate::logic::progression::require(key).xp);
        assert!(
            execute_in_game(
                d,
                game_id,
                Command::BattleGuard(
                    crate::commands::Battle {
                        attacker_id: explorer_id, defender_id: site_key.entity_id, relic_slot: None,
                    },
                ),
                401,
            ),
        );
        let cleared = snforge_std::interact_with_state(
            d.games, || crate::logic::expeditions::expedition_site(site_key).unwrap(),
        );
        assert_eq!(cleared.beast_kind, kind);
        assert!(cleared.clear.is_some());
        let expected_wheat = if kind == crate::expeditions::BeastKind::Cyclops {
            site.initial_guard_count * 4
        } else {
            0
        };
        assert_eq!(resources.resource_balance(wheat) - before_wheat, expected_wheat);
        assert_eq!(resources.resource_balance(labor), before_labor);
        let xp = snforge_std::interact_with_state(d.games, || crate::logic::progression::require(key).xp);
        let base = crate::progression::clear_xp(site.initial_guard_count, 0);
        let expected_xp = if kind == crate::expeditions::BeastKind::Wraith {
            base * 3
        } else {
            base
        };
        assert_eq!(xp - before_xp, expected_xp);
    }
}

#[test]
fn a_cleared_troll_camp_reinforces_from_home_stock_away_from_home() {
    let (_, mut preset) = super::preset_projection::current_definition("frontier-s1");
    let discovery = crate::expeditions::FrontierDiscoveryRules {
        beasts_bps: 0, camp_bps: 100, rift_bps: 0, ruin_bps: 100, shrine_bps: 0, well_bps: 0, empty_reveal_limit: 7,
    };
    preset.economy.discovery = Some(discovery);
    preset.rules.battle_config.cooldown_seconds = 0;
    preset.rules.battle_config.regular_immunity_ticks = 0;
    preset.rules.troop_stamina_config.stamina_initial = 180;
    preset.rules.troop_stamina_config.stamina_knight_max = 180;
    let (d, game_id) = create_open_frontier(preset, BAG_SECONDS);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(crate::realms::SettleSeason { selected_realm: None, aspect: Some(1) }),
            360,
        ),
    );
    let home_id = snforge_std::interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor));
    let home = ResourceKey { game_id, entity_id: home_id };
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::CreateBuilding(
                crate::buildings::CreateBuilding {
                    structure_id: home_id,
                    directions: array![0].span(),
                    category: 28,
                    scouting_kind: 0,
                    use_simple: true,
                },
            ),
            361,
        ),
    );
    let explorer_id = *IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home).at(0);
    let key = ExplorerKey { game_id, explorer_id };
    let army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    let camp_coord = crate::geometry::neighbor(army.coord, 0);
    let root = discovery_root(game_id, discovery, 0, Some(any_relic()), crate::discovery::Discovery::Camp);
    assert!(explore_with_root(d, game_id, explorer_id, root, 400));
    let camp_id = IMapLogicDispatcher { contract_address: d.games }
        .occupancy(crate::geometry::tile_key(game_id, camp_coord))
        .unwrap()
        .entity_id;
    let camp = ResourceKey { game_id, entity_id: camp_id };
    for hit in 0_u64..4 {
        let receipt = snforge_std::interact_with_state(
            d.games, || crate::logic::expeditions::expedition_site(camp).unwrap(),
        );
        if receipt.clear.is_some() {
            break;
        }
        assert!(
            execute_in_game(
                d,
                game_id,
                Command::BattleGuard(
                    crate::commands::Battle { attacker_id: explorer_id, defender_id: camp_id, relic_slot: None },
                ),
                401 + hit,
            ),
        );
    }
    let receipt = snforge_std::interact_with_state(
        d.games, || crate::logic::expeditions::expedition_site(camp).unwrap(),
    );
    assert_eq!(receipt.clear.unwrap().home_id, home_id);
    assert!(
        execute_in_game(
            d, game_id, Command::Move(crate::commands::Move { explorer_id, directions: array![0, 0].span() }), 410,
        ),
    );
    let army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    let origin = crate::expeditions::site(preset.settlement.spacing, crate::entity_ids::namespace(home_id), 0, 0);
    assert!(!crate::geometry::adjacent(army.coord, origin));
    assert!(crate::geometry::adjacent(army.coord, camp_coord));
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let wheat = ResourceSlot { game_id, entity_id: home_id, resource_type: crate::resources::WHEAT };
    let before_wheat = resources.resource_balance(wheat);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::ManageTroops(
                crate::troop_management::ManageTroops::RecruitExplorer(
                    crate::troop_management::RecruitExplorer { explorer_id, amount: RESOURCE_PRECISION },
                ),
            ),
            411,
        ),
    );
    assert_eq!(
        GameState { contract_address: d.games }.resolved_explorer(key).unwrap().troops.count,
        army.troops.count + RESOURCE_PRECISION,
    );
    assert_eq!(resources.resource_balance(wheat), before_wheat - 2 * RESOURCE_PRECISION);
}

#[test]
fn supply_post_reader_checks_each_upper_layer_home_day_and_distance() {
    let (address, _) = super::deploy("MovementLogic", @array![]);
    let reader = crate::expeditions::ISupplyPostsDispatcher { contract_address: address };
    let home = ResourceKey { game_id: 7, entity_id: 11 };
    for depth in 0_u32..4 {
        let camp = crate::troops::Coord { alt: false, x: 20, y: 4 * 32 + depth * 32 + 16 };
        let army = crate::geometry::neighbor(camp, 0);
        snforge_std::interact_with_state(
            address,
            || {
                crate::state::write()
                    .structures
                    .supply_posts
                    .write((home.game_id, camp.alt, camp.x, camp.y), home.entity_id);
            },
        );
        assert_eq!(
            crate::expeditions::ISupplyPostsDispatcherTrait::adjacent_supply_post(reader, home, army, 1, 32), depth < 3,
        );
        assert!(
            !crate::expeditions::ISupplyPostsDispatcherTrait::adjacent_supply_post(
                reader, ResourceKey { entity_id: 12, ..home }, army, 1, 32,
            ),
        );
        assert!(!crate::expeditions::ISupplyPostsDispatcherTrait::adjacent_supply_post(reader, home, army, 2, 32));
        assert!(!crate::expeditions::ISupplyPostsDispatcherTrait::adjacent_supply_post(reader, home, camp, 1, 32));
        assert!(
            !crate::expeditions::ISupplyPostsDispatcherTrait::adjacent_supply_post(
                reader, home, crate::geometry::neighbor(army, 0), 1, 32,
            ),
        );
    }
    assert!(
        !crate::expeditions::ISupplyPostsDispatcherTrait::adjacent_supply_post(
            reader, home, crate::troops::Coord { alt: false, x: 0, y: 128 }, 1, 32,
        ),
    );
}
