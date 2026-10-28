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
fn current_frontier_check_launch_starts_unfunded_and_matches_herald_projection() {
    let (preset_id, _) = current_definition("frontier-check");
    assert_eq!(preset_id, 104);
    compare_current_launch("frontier-check");
    super::registrar::assert_zero_pool_never_funds_a_ruin_or_payout_over_a_day();
    assert_all_zero_chest_rules_refuse_registration();
}

#[test]
fn current_eternum_optional_sections_and_map_match_herald_projection() {
    compare_current_launch("eternum");
}

#[test]
#[feature("safe_dispatcher")]
fn current_frontier_rejects_a_reintroduced_supply_pool() {
    let d = super::registrar::setup();
    start_cheat_caller_address(d.games, super::authority());
    let mut registration = read_txt(@FileTrait::new("../fixtures/current-presets/frontier-register.txt")).span();
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
        let (preset_id, mut definition) = current_definition("frontier");
        let mut progression = definition.economy.progression.unwrap();
        if invalid == 1 {
            progression.reveal_xp = 0;
        } else if invalid == 2 {
            progression.fixed_xp = 0;
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
fn current_frontier_requires_discovery_and_chest_rules_and_refuses_sequential_odds() {
    let d = super::registrar::setup();
    start_cheat_caller_address(d.games, super::authority());
    for invalid in 0_u8..3 {
        let (preset_id, mut definition) = current_definition("frontier");
        if invalid == 0 {
            definition.economy.discovery = None;
        } else if invalid == 1 {
            definition.economy.chests = None;
        } else {
            definition.rules.map_config.camp_win_probability = 4;
        }
        assert!(IRegistrarSafeDispatcher { contract_address: d.games }.register_preset(preset_id, definition).is_err());
        assert_eq!(IRegistrarDispatcher { contract_address: d.games }.preset_commitment(preset_id), 0);
    }
}
