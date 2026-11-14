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

fn optional_quest_rules() -> crate::quests::QuestRules {
    crate::quests::QuestRules {
        base_counts: array![1, 1, 1, 1, 1, 2, 15].span(), labor: 1000, essence: 1500, bonus_percent: 150,
    }
}

#[test]
fn optional_quests_store_every_target_and_reward_without_a_legacy_labor_claim() {
    let d = super::registrar::setup();
    start_cheat_caller_address(d.games, super::authority());
    let (preset_id, mut definition) = current_definition("frontier");
    assert!(definition.economy.quests.is_none());
    let rules = optional_quest_rules();
    definition.economy.quests = Some(rules);
    definition.economy.labor = None;
    let registrar = IRegistrarDispatcher { contract_address: d.games };
    registrar.register_preset(preset_id, definition);
    let commitment = registrar.preset_commitment(preset_id);
    assert!(commitment != 0);
    interact_with_state(
        d.games,
        || {
            let preset = crate::state::read().presets.entry(commitment);
            assert!(preset.labor_rules.read().is_none());
            assert_eq!(preset.quest_rewards.read(), Some((1000, 1500, 150)));
            for kind in 0_u8..crate::quests::QUEST_COUNT {
                assert_eq!(preset.quest_counts.read(kind), *rules.base_counts.at(kind.into()));
            }
        },
    );
}

#[test]
#[feature("safe_dispatcher")]
fn invalid_quest_rules_and_duplicate_reward_paths_refuse_registration() {
    let d = super::registrar::setup();
    start_cheat_caller_address(d.games, super::authority());
    for invalid in 0_u8..10 {
        let (preset_id, mut definition) = current_definition("frontier");
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
        chance_step: 20, quorum_percent: 25, beast_percent: 150, stamina_percent: 50, production_percent: 50,
        quest_counts: array![3, 6, 9, 12, 20, 40, 60, 80, 2500, 6000, 10000, 15000].span(),
    }
}

#[test]
fn optional_banes_store_all_effects_and_whole_unit_targets() {
    let d = super::registrar::setup();
    start_cheat_caller_address(d.games, super::authority());
    let (preset_id, mut definition) = current_definition("frontier");
    assert!(definition.economy.banes.is_none());
    let rules = optional_bane_rules();
    definition.economy.banes = Some(rules);
    definition.economy.quests = Some(optional_quest_rules());
    definition.economy.labor = None;
    let registrar = IRegistrarDispatcher { contract_address: d.games };
    registrar.register_preset(preset_id, definition);
    let commitment = registrar.preset_commitment(preset_id);
    assert!(commitment != 0);
    interact_with_state(d.games, || {
        let preset = crate::state::read().presets.entry(commitment);
        assert_eq!(preset.bane_rules.read(), Some((20, 25, 150, 50, 50)));
        for index in 0_u8..12 {
            assert_eq!(preset.bane_quest_counts.read(index), *rules.quest_counts.at(index.into()));
        }
    });
}

#[test]
#[feature("safe_dispatcher")]
fn malformed_banes_and_banes_without_quests_refuse_registration() {
    let d = super::registrar::setup();
    start_cheat_caller_address(d.games, super::authority());
    for invalid in 0_u8..12 {
        let (preset_id, mut definition) = current_definition("frontier");
        let mut rules = optional_bane_rules();
        if invalid != 0 {
            definition.economy.quests = Some(optional_quest_rules());
            definition.economy.labor = None;
        }
        if invalid == 1 { rules.chance_step = 0; }
        else if invalid == 2 { rules.chance_step = 101; }
        else if invalid == 3 { rules.quorum_percent = 0; }
        else if invalid == 4 { rules.quorum_percent = 101; }
        else if invalid == 5 { rules.beast_percent = 99; }
        else if invalid == 6 { rules.stamina_percent = 0; }
        else if invalid == 7 { rules.stamina_percent = 101; }
        else if invalid == 8 { rules.production_percent = 0; }
        else if invalid == 9 { rules.production_percent = 101; }
        else if invalid == 10 { rules.quest_counts = array![3].span(); }
        else if invalid == 11 { rules.quest_counts = array![3, 6, 9, 12, 20, 40, 60, 80, 2500, 6000, 10000, 0].span(); }
        definition.economy.banes = Some(rules);
        assert!(IRegistrarSafeDispatcher { contract_address: d.games }.register_preset(preset_id, definition).is_err());
        assert_eq!(IRegistrarDispatcher { contract_address: d.games }.preset_commitment(preset_id), 0);
    }
}
