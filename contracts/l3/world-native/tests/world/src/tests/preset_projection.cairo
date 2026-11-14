use starknet::storage::StoragePathEntry;
pub use world_test_support::tests::preset_projection::*;


#[test]
fn current_blitz_launch_readers_match_herald_projection() {
    compare_current_launch("blitz");
}

#[test]
fn current_frontier_launch_readers_match_herald_projection() {
    compare_current_launch("frontier");
}

#[test]
#[feature("safe_dispatcher")]
fn current_frontier_check_launch_has_no_cash_rules_and_matches_herald_projection() {
    let (preset_id, preset) = current_definition("frontier-check");
    assert_eq!(preset_id, 104);
    assert!(preset.economy.chests.is_none());
    compare_current_launch("frontier-check");
    assert_unfunded_cash_rules_refuse_registration();
}

#[test]
#[feature("safe_dispatcher")]
fn current_frontier_rejects_a_reintroduced_supply_pool() {
    let d = super::registrar::setup();
    start_cheat_caller_address(d.games, super::authority());
    let mut registration = read_txt(@FileTrait::new("../fixtures/current-presets/frontier-check-register.txt")).span();
    let preset_id: u32 = Serde::deserialize(ref registration).unwrap();
    let mut definition: crate::presets::PresetDefinition = Serde::deserialize(ref registration).unwrap();
    assert!(registration.is_empty());
    assert!(definition.exploration.is_empty());
    definition
        .exploration =
            array![
                crate::exploration_rewards::ExplorationReward {
                    resource_type: crate::resources::ESSENCE, percent: 1, percent_max: 1, weight: 1,
                },
            ]
        .span();
    assert!(IRegistrarSafeDispatcher { contract_address: d.games }.register_preset(preset_id, definition).is_err());
    assert_eq!(IRegistrarDispatcher { contract_address: d.games }.preset_commitment(preset_id), 0);
}

#[test]
#[feature("safe_dispatcher")]
fn current_frontier_requires_complete_progression_rules() {
    let d = super::registrar::setup();
    start_cheat_caller_address(d.games, super::authority());
    for invalid in 0_u8..8 {
        let (preset_id, mut definition) = current_definition("frontier-check");
        let mut progression = definition.economy.progression.unwrap();
        if invalid == 1 {
            progression.reveal_xp = 0;
        } else if invalid == 2 {
            progression.common_xp = 0;
        } else if invalid == 3 {
            progression.uncommon_xp = 0;
        } else if invalid == 4 {
            progression.rare_xp = 0;
        } else if invalid == 5 {
            progression.epic_xp = 0;
        } else if invalid == 6 {
            progression.legendary_xp = 0;
        } else if invalid == 7 {
            progression.reveal_xp_per_depth = 0xffffffff;
        }
        definition.economy.progression = if invalid == 0 {
            None
        } else {
            Some(progression)
        };
        assert!(IRegistrarSafeDispatcher { contract_address: d.games }.register_preset(preset_id, definition).is_err());
        assert_eq!(IRegistrarDispatcher { contract_address: d.games }.preset_commitment(preset_id), 0);
    }
}

#[test]
#[feature("safe_dispatcher")]
fn current_frontier_requires_discovery_rejects_cash_rules_and_refuses_sequential_odds() {
    let d = super::registrar::setup();
    start_cheat_caller_address(d.games, super::authority());
    for invalid in 0_u8..3 {
        let (preset_id, mut definition) = current_definition("frontier-check");
        if invalid == 0 {
            definition.economy.discovery = None;
        } else if invalid == 1 {
            definition.economy.chests = Some(retired_frontier_chest_rules());
        } else {
            definition.rules.map_config.camp_win_probability = 4;
        }
        assert!(IRegistrarSafeDispatcher { contract_address: d.games }.register_preset(preset_id, definition).is_err());
        assert_eq!(IRegistrarDispatcher { contract_address: d.games }.preset_commitment(preset_id), 0);
    }
}

fn optional_deep_rules() -> crate::deep::DeepRules {
    let precision = crate::rules::RESOURCE_PRECISION;
    crate::deep::DeepRules {
        foundation: crate::troops::Coord { alt: false, x: 25, y: 35 },
        quarry: crate::troops::Coord { alt: false, x: 12, y: 20 },
        altar: crate::troops::Coord { alt: false, x: 38, y: 20 },
        beast_count: 10000 * precision,
        loss_per_tick: 200 * precision,
        quarry_per_tick: 500 * precision,
        altar_per_tick: 5,
        altar_threshold: 1500,
    }
}

#[test]
fn an_optional_deep_preset_stores_the_exact_sites_and_tick_rules() {
    let d = super::registrar::setup();
    start_cheat_caller_address(d.games, super::authority());
    let (preset_id, mut definition) = current_definition("frontier");
    assert!(definition.economy.deep.is_none());
    let deep = optional_deep_rules();
    definition.economy.deep = Some(deep);
    let registrar = IRegistrarDispatcher { contract_address: d.games };
    registrar.register_preset(preset_id, definition);
    let commitment = registrar.preset_commitment(preset_id);
    assert!(commitment != 0);
    interact_with_state(
        d.games, || {
            assert_eq!(crate::state::read().presets.entry(commitment).deep_rules.read(), Some(deep));
        },
    );
}

#[test]
#[feature("safe_dispatcher")]
fn invalid_deep_rules_leave_no_preset_registered() {
    let d = super::registrar::setup();
    start_cheat_caller_address(d.games, super::authority());
    for invalid in 0_u8..9 {
        let (preset_id, mut definition) = current_definition("frontier");
        let mut deep = optional_deep_rules();
        if invalid == 0 {
            definition.settlement.order_aspects = array![].span();
        } else if invalid == 1 {
            definition.rules.day_unit_seconds = 0;
        } else if invalid == 2 {
            deep.altar = deep.quarry;
        } else if invalid == 3 {
            deep.foundation.x = crate::rules::DEEP_MAP_SIZE;
        } else if invalid == 4 {
            deep
                .foundation =
                    crate::troops::Coord {
                        alt: false, x: crate::rules::DEEP_MAP_SIZE / 2, y: crate::rules::DEEP_ARRIVAL_Y,
                    };
        } else if invalid == 5 {
            deep.beast_count = 1;
        } else if invalid == 6 {
            deep.loss_per_tick = 0;
        } else if invalid == 7 {
            deep.altar_threshold = 1501;
        } else {
            deep.quarry_per_tick = 0;
        }
        definition.economy.deep = Some(deep);
        assert!(IRegistrarSafeDispatcher { contract_address: d.games }.register_preset(preset_id, definition).is_err());
        assert_eq!(IRegistrarDispatcher { contract_address: d.games }.preset_commitment(preset_id), 0);
    }
}
