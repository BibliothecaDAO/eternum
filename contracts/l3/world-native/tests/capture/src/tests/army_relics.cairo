use crate::army_relics::{ArmyRelic, RelicKind};
use super::registrar::*;

fn relic_game() -> (
    super::Deployment, u32, u64, u64, ExplorerKey, crate::expeditions::FrontierDiscoveryRules, ChestTiers,
) {
    relic_game_on(1, 120, BAG_SECONDS)
}

fn relic_game_on(
    tick_seconds: u64, gain_per_tick: u16, duration: u64,
) -> (super::Deployment, u32, u64, u64, ExplorerKey, crate::expeditions::FrontierDiscoveryRules, ChestTiers) {
    let (_, mut preset) = super::preset_projection::current_definition("frontier-check");
    preset.rules.troop_limit_config.settlement_deployment_cap = 6000;
    let mut stock = array![];
    for grant in preset.settlement.realms.resources {
        stock
            .append(
                crate::resources::ResourceAmount {
                    amount: if *grant
                        .resource_type == crate::troops::troop_resource(crate::troops::TroopType::Knight, 0) {
                        12000 * RESOURCE_PRECISION
                    } else {
                        *grant.amount
                    },
                    ..*grant,
                },
            );
    }
    preset.settlement.realms.resources = stock.span();
    let discovery = crate::expeditions::FrontierDiscoveryRules {
        beasts_bps: 1, camp_bps: 0, rift_bps: 0, ruin_bps: 5000, shrine_bps: 0, well_bps: 0, empty_reveal_limit: 7,
    };
    preset.economy.discovery = Some(discovery);
    preset.economy.race = None;
    preset.rules.tick_config.armies_tick_in_seconds = tick_seconds;
    preset.rules.troop_stamina_config.stamina_gain_per_tick = gain_per_tick;
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
                    guard_step: 1,
                    ..*depth,
                },
            );
    }
    preset.settlement.depths = depths.span();
    let (d, game_id) = create_open_frontier(1, preset, duration);
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
    (d, game_id, home_id, explorer_id, key, discovery, *preset.settlement.depths.at(0).chest)
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
            1 => RelicKind::StaminaRegen,
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

const REGEN_TICK: u64 = 120;
const REGEN_START: u64 = 420;

fn stamina_regen_army(oaths: u16) -> (super::Deployment, ExplorerKey) {
    let (d, game_id, _, explorer_id, key, _, _) = relic_game_on(REGEN_TICK, 1, FRONTIER_BAG_SECONDS);
    let relic = ArmyRelic { kind: RelicKind::StaminaRegen, rank: 3 };
    snforge_std::interact_with_state(
        d.games,
        || {
            let progress = crate::logic::progression::require(key);
            crate::state::write()
                .troops
                .progress
                .write(
                    (game_id, explorer_id),
                    Some(crate::progression::ArmyProgress { oaths: progress.oaths | oaths, ..progress }),
                );
            let ruin = ResourceKey { game_id, entity_id: 990001 };
            crate::logic::army_relics::store_ruin(ruin, relic);
            crate::logic::army_relics::award(key, ruin, None);
        },
    );
    let activate = Command::ApplyRelic(
        crate::relics::ApplyRelic {
            entity_id: explorer_id,
            relic_id: crate::army_relics::encode(relic),
            recipient: crate::relics::Recipient::ArmySlot(0),
        },
    );
    assert!(execute_in_game(d, game_id, activate, REGEN_START));
    snforge_std::interact_with_state(
        d.games,
        || {
            let army = crate::logic::army_slots::resolve(key, crate::logic::troops::explorer(key).unwrap(), None);
            let empty = crate::troops::Stamina { amount: 0, settled_at: REGEN_START.try_into().unwrap(), remainder: 0 };
            let drained = crate::troops::ExplorerTroops {
                troops: crate::troops::Troops { stamina: crate::troops::StaminaSource::Inline(empty), ..army.troops },
                ..army,
            };
            crate::logic::troops::TroopState::save(key, crate::troops::ExplorerRecordTrait::into_record(drained));
        },
    );
    (d, key)
}

fn stamina_at(d: super::Deployment, key: ExplorerKey, timestamp: u64) -> u64 {
    let army = GameState { contract_address: d.games }.authorized_explorer(key, d.actor, timestamp);
    let crate::troops::StaminaSource::Inline(stamina) = army.troops.stamina else {
        panic!("a resolved army holds its stamina inline")
    };
    stamina.amount
}

fn level_three_regen_percent() -> u64 {
    100 + 3 * crate::rules::STAMINA_REGEN_RELIC_STEP_PERCENT.into()
}

#[test]
fn a_level_three_stamina_relic_regenerates_its_step_times_three_faster_for_its_duration_then_normally() {
    let (d, key) = stamina_regen_army(0);
    let duration: u64 = (crate::rules::RELIC_SECONDS_PER_RANK * 3).into();
    let ticks = duration / REGEN_TICK;
    let during = stamina_at(d, key, REGEN_START + duration);
    assert_eq!(during, ticks * level_three_regen_percent() / 100);
    assert_eq!(stamina_at(d, key, REGEN_START + duration + REGEN_TICK) - during, 1);
    assert_eq!(stamina_at(d, key, REGEN_START + 2 * duration) - during, ticks);
}

#[test]
fn a_stamina_relic_multiplies_the_enlightened_regen_rate() {
    let (d, key) = stamina_regen_army(crate::oaths::bit(crate::oaths::ENLIGHTENMENT));
    let duration: u64 = (crate::rules::RELIC_SECONDS_PER_RANK * 3).into();
    let enlightened: u64 = crate::oaths::ENLIGHTENMENT_REGEN_BPS.into();
    let during = stamina_at(d, key, REGEN_START + duration);
    assert_eq!(during, duration * enlightened * level_three_regen_percent() / 100 / (REGEN_TICK * 10000));
}

#[test]
fn a_switched_on_stamina_relic_leaves_its_effect_for_its_duration() {
    let (d, key) = stamina_regen_army(0);
    let effect = snforge_std::interact_with_state(
        d.games,
        || crate::logic::army_relics::effect(
            crate::army_relics::ArmyRelicEffectKey {
                game_id: key.game_id, explorer_id: key.explorer_id, kind: RelicKind::StaminaRegen,
            },
        ),
    );
    let duration: u64 = (crate::rules::RELIC_SECONDS_PER_RANK * 3).into();
    assert_eq!(effect, Some(crate::army_relics::ArmyRelicEffect { rank: 3, expires_at: REGEN_START + duration }));
    assert_eq!(read_loadout(d, key).first, None);
}
