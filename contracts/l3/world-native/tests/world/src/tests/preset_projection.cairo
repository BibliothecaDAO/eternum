use starknet::storage::StoragePathEntry;
pub use world_test_support::tests::preset_projection::*;


#[test]
fn current_frontier_launch_readers_match_herald_projection() {
    compare_current_launch("frontier");
}

#[test]
fn current_frontier_check_launch_readers_match_herald_projection() {
    let (preset_id, _) = current_definition("frontier-check");
    assert_eq!(preset_id, 104);
    compare_current_launch("frontier-check");
}

#[test]
#[feature("safe_dispatcher")]
fn current_frontier_refuses_sequential_odds() {
    let d = super::registrar::setup();
    start_cheat_caller_address(d.games, super::authority());
    let (preset_id, mut definition) = current_definition("frontier-check");
    definition.rules.map_config.camp_win_probability = 4;
    assert!(IRegistrarSafeDispatcher { contract_address: d.games }.register_preset(preset_id, definition).is_err());
    assert_eq!(IRegistrarDispatcher { contract_address: d.games }.preset_commitment(preset_id), 0);
}

#[test]
#[feature("safe_dispatcher")]
fn invalid_deep_rules_leave_no_preset_registered() {
    let d = super::registrar::setup();
    start_cheat_caller_address(d.games, super::authority());
    for invalid in 0_u8..5 {
        let (preset_id, mut definition) = current_definition("frontier-check");
        let mut deep = definition.economy.deep.unwrap();
        if invalid == 0 {
            definition.settlement.order_aspects = array![].span();
        } else if invalid == 1 {
            definition.rules.day_unit_seconds = 0;
        } else if invalid == 2 {
            deep.rings = deep.rings.slice(0, deep.rings.len() - 1);
        } else if invalid == 3 {
            deep.beasts = deep.beasts.slice(0, deep.beasts.len() - 1);
        } else {
            deep.altar_threshold += 1;
        }
        definition.economy.deep = Some(deep);
        assert!(IRegistrarSafeDispatcher { contract_address: d.games }.register_preset(preset_id, definition).is_err());
        assert_eq!(IRegistrarDispatcher { contract_address: d.games }.preset_commitment(preset_id), 0);
    }
}

fn optional_quest_rules() -> crate::quests::QuestRules {
    crate::quests::QuestRules {
        base_counts: array![1, 1, 1, 1, 1, 2, 15].span(), labor: 1000, essence: 1500, bonus_percent: 150,
    }
}

#[test]
#[feature("safe_dispatcher")]
fn invalid_quest_rules_and_duplicate_reward_paths_refuse_registration() {
    let d = super::registrar::setup();
    start_cheat_caller_address(d.games, super::authority());
    for invalid in 0_u8..10 {
        let (preset_id, mut definition) = current_definition("frontier-check");
        let mut rules = optional_quest_rules();
        if invalid != 0 {
            definition.economy.labor = None;
        }
        if invalid == 1 {
            definition.rules.day_unit_seconds = 0;
        } else if invalid == 2 {
            definition.settlement.order_aspects = array![].span();
        } else if invalid == 3 {
            rules.base_counts = array![1].span();
        } else if invalid == 4 {
            rules.base_counts = array![1, 1, 1, 0, 1, 2, 15].span();
        } else if invalid == 5 {
            rules.labor = 0;
        } else if invalid == 6 {
            rules.essence = 0;
        } else if invalid == 7 {
            rules.bonus_percent = 99;
        } else if invalid == 8 {
            rules.labor = core::num::traits::Bounded::MAX;
        } else if invalid == 9 {
            rules.essence = core::num::traits::Bounded::MAX;
        }
        definition.economy.quests = Some(rules);
        assert!(IRegistrarSafeDispatcher { contract_address: d.games }.register_preset(preset_id, definition).is_err());
        assert_eq!(IRegistrarDispatcher { contract_address: d.games }.preset_commitment(preset_id), 0);
    }
}

fn optional_bane_rules() -> crate::banes::BaneRules {
    crate::banes::BaneRules {
        chance_step: 20,
        quorum_percent: 25,
        beast_percent: 150,
        stamina_percent: 50,
        production_percent: 50,
        quest_counts: array![3, 6, 9, 12, 20, 40, 60, 80, 2500, 6000, 10000, 15000].span(),
    }
}

#[test]
#[feature("safe_dispatcher")]
fn malformed_banes_and_banes_without_quests_refuse_registration() {
    let d = super::registrar::setup();
    start_cheat_caller_address(d.games, super::authority());
    for invalid in 0_u8..12 {
        let (preset_id, mut definition) = current_definition("frontier-check");
        let mut rules = optional_bane_rules();
        if invalid != 0 {
            definition.economy.quests = Some(optional_quest_rules());
            definition.economy.labor = None;
        }
        if invalid == 1 {
            rules.chance_step = 0;
        } else if invalid == 2 {
            rules.chance_step = 101;
        } else if invalid == 3 {
            rules.quorum_percent = 0;
        } else if invalid == 4 {
            rules.quorum_percent = 101;
        } else if invalid == 5 {
            rules.beast_percent = 99;
        } else if invalid == 6 {
            rules.stamina_percent = 0;
        } else if invalid == 7 {
            rules.stamina_percent = 101;
        } else if invalid == 8 {
            rules.production_percent = 0;
        } else if invalid == 9 {
            rules.production_percent = 101;
        } else if invalid == 10 {
            rules.quest_counts = array![3].span();
        } else if invalid == 11 {
            rules.quest_counts = array![3, 6, 9, 12, 20, 40, 60, 80, 2500, 6000, 10000, 0].span();
        }
        definition.economy.banes = Some(rules);
        assert!(IRegistrarSafeDispatcher { contract_address: d.games }.register_preset(preset_id, definition).is_err());
        assert_eq!(IRegistrarDispatcher { contract_address: d.games }.preset_commitment(preset_id), 0);
    }
}


#[test]
#[feature("safe_dispatcher")]
fn malformed_race_rules_leave_no_preset_registered() {
    let d = super::registrar::setup();
    start_cheat_caller_address(d.games, super::authority());
    for invalid in 0_u8..3 {
        let (preset_id, mut definition) = current_definition("frontier-check");
        let mut race = definition.economy.race.unwrap();
        if invalid == 0 {
            definition.economy.deep = None;
        } else if invalid == 1 {
            race.stage_height += 1;
        } else {
            definition.rules.troop_limit_config.t1_tier_strength = 2;
        }
        definition.economy.race = Some(race);
        assert!(IRegistrarSafeDispatcher { contract_address: d.games }.register_preset(preset_id, definition).is_err());
        assert_eq!(IRegistrarDispatcher { contract_address: d.games }.preset_commitment(preset_id), 0);
    }
}
