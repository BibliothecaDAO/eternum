use crate::army_relics::{ArmyRelic, RelicKind};
use super::registrar::*;

#[test]
fn ruins_fill_replace_and_activate_an_armys_relics_through_commands() {
    let (_, mut preset) = super::preset_projection::current_definition("frontier");
    let discovery = crate::expeditions::FrontierDiscoveryRules {
        beasts_bps: 1, camp_bps: 0, rift_bps: 0, ruin_bps: 5000, shrine_bps: 0, well_bps: 0, empty_reveal_limit: 7,
    };
    preset.economy.discovery = Some(discovery);
    preset.rules.tick_config.armies_tick_in_seconds = 1;
    preset.rules.troop_stamina_config.stamina_gain_per_tick = 120;
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
            Command::SettleSeason(
                crate::realms::SettleSeason { selected_realm: None, aspect: first_aspect_choice(d, game_id) },
            ),
            360,
        ),
    );
    let home_id = snforge_std::interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor));
    let home = ResourceKey { game_id, entity_id: home_id };
    let mut deployment_events = snforge_std::spy_events();
    if !execute_in_game(
        d,
        game_id,
        Command::CreateExplorer(
            CreateExplorer {
                structure_id: home_id, slot: 0, category: 0, tier: 0, amount: 1500 * RESOURCE_PRECISION, direction: 0,
            },
        ),
        360,
    ) {
        panic!("{}", super::play_fixture::rejection(ref deployment_events, d.games).reason);
    }
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
    assert_eq!(site.category, crate::taxonomy::RUIN_OCCUPIER);
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
                rules, 0, 0, 0, 0, Some(reward), seed,
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
