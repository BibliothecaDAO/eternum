use crate::army_relics::{ArmyRelic, RelicKind};
use super::registrar::*;

fn relic_game() -> (
    super::Deployment, u32, u64, u64, ExplorerKey, crate::expeditions::FrontierDiscoveryRules, ChestTiers,
) {
    let (_, preset) = super::preset_projection::current_definition("frontier-check");
    let (d, game_id) = create_open_frontier(1, preset, BAG_SECONDS);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(
                crate::realms::SettleSeason { selected_realm: None, order: first_order_choice(d, game_id) },
            ),
            360,
        ),
    );
    let home_id = snforge_std::interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor));
    let home = ResourceKey { game_id, entity_id: home_id };
    let explorer_id = *IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home).at(0);
    let key = ExplorerKey { game_id, explorer_id };
    let mut army = strong_frontier_army(d, game_id, key);
    army.troops.count = 5000 * RESOURCE_PRECISION;
    super::resource_commands::set_explorer_fixture(d.games, key, army);
    let discovery = snforge_std::interact_with_state(
        d.games, || crate::logic::discovery::lore_rules(crate::logic::research::require(home).learned),
    );
    (d, game_id, home_id, explorer_id, key, discovery, crate::logic::expeditions::depth_rules(0).chest)
}

#[test]
fn ruins_fill_replace_and_activate_an_armys_relics_through_commands() {
    let (d, game_id, home_id, explorer_id, key, discovery, chest) = relic_game();
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let lords = ResourceSlot { game_id, entity_id: home_id, resource_type: crate::resources::LORDS };
    for index in 0_u8..4 {
        let timestamp = 400 + Into::<u8, u64>::into(index) * 30;
        let kind = match index {
            0 => RelicKind::Blade,
            1 => RelicKind::FarEye,
            2 => RelicKind::Ward,
            _ => RelicKind::Plunder,
        };
        let reward = ArmyRelic { kind, rank: 1 };
        let site = discover_relic(d, key, discovery, chest, reward, false, timestamp);
        assert_eq!(read_ruin(d, site), Some(reward));
        let count = snforge_std::interact_with_state(
            d.games,
            || crate::logic::guards::guard(crate::guards::GuardKey { game_id, structure_id: site.entity_id, slot: 0 })
                .troops
                .count,
        );
        assert!(count >= 900 * RESOURCE_PRECISION && count <= 1100 * RESOURCE_PRECISION);
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
    assert_eq!(inventory.first, Some(ArmyRelic { kind: RelicKind::Blade, rank: 1 }));
    assert_eq!(inventory.second, Some(ArmyRelic { kind: RelicKind::Plunder, rank: 1 }));
    assert_eq!(inventory.third, Some(ArmyRelic { kind: RelicKind::Ward, rank: 1 }));
    let essence = ResourceSlot { game_id, entity_id: home_id, resource_type: crate::resources::ESSENCE };
    let essence_before = resources.resource_balance(essence);
    let activate = Command::ApplyRelic(
        crate::relics::ApplyRelic {
            entity_id: explorer_id, relic_id: 1, recipient: crate::relics::Recipient::ArmySlot(0),
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
                crate::army_relics::ArmyRelicEffectKey { game_id, explorer_id, kind: RelicKind::Blade },
            ),
        ),
        Some(crate::army_relics::ArmyRelicEffect { rank: 1, expires_at: 2320 }),
    );
    let site = discover_relic(d, key, discovery, chest, ArmyRelic { kind: RelicKind::FarEye, rank: 1 }, false, 550);
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
    let receipt = snforge_std::interact_with_state(
        d.games, || crate::logic::expeditions::expedition_site(site).unwrap().clear.unwrap(),
    );
    assert_eq!(receipt.explorer_id, explorer_id);
    assert_eq!(receipt.home_id, home_id);
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
    let mut revealed = array![];
    for (_, event) in spy.get_events().emitted_by(d.games).events {
        if event.keys.span() == array![selector!("MapEvent"), selector!("RowSet"), 1, 'TileOpt'].span() {
            let mut data = event.data.span();
            let tile: Span<felt252> = Serde::deserialize(ref data).unwrap();
            let mut fresh = true;
            for existing in revealed.span() {
                if *existing == tile {
                    fresh = false;
                }
            }
            if fresh {
                revealed.append(tile);
            }
        }
    }
    assert_eq!(revealed.len(), 6);
    assert_eq!(read_loadout(d, key).first, None);
}

#[test]
fn a_ruin_cache_pays_its_fragments_to_the_army_owner_and_leaves_the_relics() {
    let (d, game_id, _, explorer_id, key, discovery, chest) = relic_game();
    let cache = ArmyRelic { kind: RelicKind::Blade, rank: 1 };
    let site = discover_relic(d, key, discovery, chest, cache, true, 560);
    assert_eq!(read_cache(d, site), 10);
    let loadout = read_loadout(d, key);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::BattleGuard(
                crate::commands::Battle { attacker_id: explorer_id, defender_id: site.entity_id, relic_slot: None },
            ),
            561,
        ),
    );
    assert_eq!(read_loadout(d, key), loadout);
    assert_eq!(read_ruin(d, site), None);
    assert_eq!(read_cache(d, site), 0);
    assert_eq!(snforge_std::interact_with_state(d.games, || crate::logic::fragments::balance(game_id, d.actor)), 10);
}

fn discover_relic(
    d: super::Deployment,
    key: ExplorerKey,
    rules: crate::expeditions::FrontierDiscoveryRules,
    odds: ChestTiers,
    expected: ArmyRelic,
    cache: bool,
    timestamp: u64,
) -> ResourceKey {
    super::progression::set_bar(
        d, key, crate::balance::rules::TROOP_STAMINA_CONFIG.stamina_knight_max.into(), timestamp,
    );
    let army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    let destination = crate::geometry::neighbor(army.coord, 0);
    let root = relic_root(key.game_id, rules, odds, expected, cache);
    assert!(explore_with_root(d, key.game_id, key.explorer_id, root, timestamp));
    let site = IMapLogicDispatcher { contract_address: d.games }
        .occupancy(crate::geometry::tile_key(key.game_id, destination))
        .unwrap();
    assert_eq!(site.category, crate::taxonomy::RUIN_OCCUPIER);
    ResourceKey { game_id: key.game_id, entity_id: site.entity_id }
}

fn relic_root(
    game_id: u32, rules: crate::expeditions::FrontierDiscoveryRules, odds: ChestTiers, expected: ArmyRelic, cache: bool,
) -> u256 {
    for candidate in 0_u32..10_000 {
        let mut root: u256 = candidate.into();
        let seed = crate::random::game_root(ref root, game_id);
        let reward = crate::army_relics::draw(odds, seed);
        if reward == expected
            && crate::fragments::holds_cache(seed, 0) == cache
            && crate::discovery::frontier(
                rules, 100, 0, Some(reward), seed,
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
fn read_cache(d: super::Deployment, key: ResourceKey) -> u128 {
    snforge_std::interact_with_state(
        d.games,
        || starknet::storage::StorageMapReadAccess::read(
            crate::state::read().relics.ruin_caches, (key.game_id, key.entity_id),
        ),
    )
}
