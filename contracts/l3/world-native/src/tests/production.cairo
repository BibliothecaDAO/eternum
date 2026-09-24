use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use crate::commands::Command;
use crate::production::{
    IProductionRulesDispatcher, IProductionRulesDispatcherTrait, IProductionRulesSafeDispatcher,
    IProductionRulesSafeDispatcherTrait, ProductionBonus, ProductionRecipe, RecipeConfig, RefillProduction,
    bonus_output,
};
use crate::resources::{
    IResourceOperationsDispatcher, IResourceOperationsDispatcherTrait, ResourceAmount, ResourceRule, ResourceSlot,
};
use crate::tests::state::ResourceObservationTrait;
use super::resource_commands::{
    assert_terminal_rejection, execute_recorded_at, grant, resource_facts, set_fixture, setup,
};

#[test]
fn all_production_bonuses_end_after_the_inclusive_recorded_end_tick() {
    let bonus = ProductionBonus {
        incr_resource_rate_percent_num: 2500,
        incr_labor_rate_percent_num: 3000,
        incr_troop_rate_percent_num: 5000,
        incr_resource_rate_end_tick: 10,
        incr_labor_rate_end_tick: 11,
        incr_troop_rate_end_tick: 12,
    };
    for (resource, end, output) in array![(1_u8, 10_u32, 125_u128), (23, 11, 130), (26, 12, 150), (34, 12, 150)] {
        assert_eq!(bonus_output(bonus, resource, 100, end - 1), output);
        assert_eq!(bonus_output(bonus, resource, 100, end), output);
        assert_eq!(bonus_output(bonus, resource, 100, end + 1), 100);
    }
    assert_eq!(bonus_output(bonus, 26, 3, 12), 4);
}

#[test]
#[fuzzer(runs: 64)]
fn production_bonus_packing_retains_full_width_percentages_and_ticks(a: u16, b: u16, c: u16, d: u32, e: u32, f: u32) {
    let bonus = ProductionBonus {
        incr_resource_rate_percent_num: a,
        incr_labor_rate_percent_num: b,
        incr_troop_rate_percent_num: c,
        incr_resource_rate_end_tick: d,
        incr_labor_rate_end_tick: e,
        incr_troop_rate_end_tick: f,
    };
    let packed = crate::production::BonusPacking::pack(bonus);
    assert_eq!(crate::production::BonusPacking::unpack(packed), bonus);
}

#[test]
#[fuzzer(runs: 64)]
fn building_packing_preserves_structure_pause_and_full_width_population(
    category: u8, owner: u32, paused: bool, current: u32, maximum: u32, labor_paid: u128,
) {
    let building = crate::buildings::Building { category, outer_entity_id: owner, paused, labor_paid };
    assert_eq!(crate::buildings::BuildingPacking::unpack(crate::buildings::BuildingPacking::pack(building)), building);
    let population = crate::buildings::Population { current, max: maximum };
    assert_eq!(
        crate::buildings::PopulationPacking::unpack(crate::buildings::PopulationPacking::pack(population)), population,
    );
}

pub fn recipes() -> Span<RecipeConfig> {
    let mut recipes = array![];
    for resource_type in 1_u8..59 {
        recipes
            .append(
                RecipeConfig {
                    resource_type,
                    recipe: ProductionRecipe {
                        simple_output: 100,
                        complex_output: 200,
                        simple_inputs: array![ResourceAmount { resource_type: 2, amount: 10 }].span(),
                        complex_inputs: array![
                            ResourceAmount { resource_type: 2, amount: 10 },
                            ResourceAmount { resource_type: 3, amount: 20 },
                        ]
                            .span(),
                    },
                },
            );
    }
    recipes.span()
}

fn configure(deployment: super::Deployment) {
    start_cheat_caller_address(deployment.games, super::authority());
    IProductionRulesDispatcher { contract_address: deployment.games }.configure_production(3, recipes());
    stop_cheat_caller_address(deployment.games);
}

#[test]
fn late_refills_use_recorded_troop_bonus_expiry_without_retroactive_production() {
    let (deployment, key, _) = setup();
    configure(deployment);
    grant(deployment, key, 2, 100);
    set_fixture(
        deployment.games,
        selector!("production"),
        selector!("bonuses"),
        array![3, key.entity_id.into()].span(),
        ProductionBonus { incr_troop_rate_percent_num: 5000, incr_troop_rate_end_tick: 1, ..Default::default() },
    );
    let refill = RefillProduction {
        structure_id: key.entity_id, resource_types: array![26].span(), amounts: array![1].span(),
    };
    assert!(execute_recorded_at(deployment, Command::BurnLaborForResourceProduction(refill), 60, 1000));
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    let slot = ResourceSlot { game_id: 3, entity_id: key.entity_id, resource_type: 26 };
    let at_end = resources.resource_production(slot);
    assert_eq!(at_end.output_amount_left, 150);
    assert_eq!(at_end.last_updated_at, 0);
    assert!(execute_recorded_at(deployment, Command::BurnLaborForResourceProduction(refill), 120, 1001));
    assert_eq!(resources.resource_production(slot).output_amount_left, 250);
    assert_eq!(resources.resource_balance(slot), 0);
    assert_eq!(resources.resource_balance(ResourceSlot { resource_type: 2, ..slot }), 80);
}

#[test]
fn late_production_payment_failure_rolls_back_prior_debits_and_consumes_ticket() {
    let (deployment, key, _) = setup();
    configure(deployment);
    grant(deployment, key, 2, 100);
    let before = resource_facts(deployment, key);
    let command = Command::BurnResourceForResourceProduction(
        RefillProduction { structure_id: key.entity_id, resource_types: array![26].span(), amounts: array![1].span() },
    );
    assert_terminal_rejection(deployment, command, 60);
    assert_eq!(resource_facts(deployment, key), before);
}

#[test]
#[feature("safe_dispatcher")]
fn production_recipes_require_authority_and_cannot_be_reconfigured() {
    let (deployment, _, _) = setup();
    let rules = IProductionRulesSafeDispatcher { contract_address: deployment.games };
    start_cheat_caller_address(deployment.games, deployment.actor);
    assert!(rules.configure_production(3, recipes()).is_err());
    stop_cheat_caller_address(deployment.games);
    configure(deployment);
    start_cheat_caller_address(deployment.games, super::authority());
    assert!(rules.configure_production(3, recipes()).is_err());
    stop_cheat_caller_address(deployment.games);
}

#[test]
fn resource_configuration_keeps_full_width_rates_without_storing_its_key_twice() {
    let deployment = super::setup_with_domains(true, "StructuresLogic", "TroopsLogic");
    let store = IResourceOperationsDispatcher { contract_address: deployment.games };
    let mut rules = array![];
    for resource_type in 1_u8..59 {
        rules
            .append(
                ResourceRule {
                    resource_type,
                    unit_weight: 0xffffffffffffffffffffffffffffffff,
                    realm_rate: 0xffffffffffffffff,
                    village_rate: 0xffffffffffffffff - resource_type.into(),
                },
            );
    }
    start_cheat_caller_address(deployment.games, super::authority());
    store.configure_resources(2, rules.span());
    stop_cheat_caller_address(deployment.games);
    for expected in rules {
        assert_eq!(store.resource_rule(2, expected.resource_type), expected);
    }
}

#[test]
fn all_refill_strategies_pay_their_inputs_and_queue_output_without_an_active_building() {
    let (deployment, home, _) = setup();
    configure(deployment);
    let precision = crate::rules::RESOURCE_PRECISION;
    grant(deployment, home, 2, 2 * precision + 100);
    grant(deployment, home, 3, 100);
    set_fixture(
        deployment.games,
        selector!("resources"),
        selector!("resource_rules"),
        array![3, 2].span(),
        (1_u128, 0x10000000000000002_u128, 7_u64),
    );
    let refill = RefillProduction {
        structure_id: home.entity_id, resource_types: array![2].span(), amounts: array![2 * precision].span(),
    };
    let refill = RefillProduction { resource_types: array![26].span(), amounts: array![2].span(), ..refill };
    assert!(execute_recorded_at(deployment, Command::BurnLaborForResourceProduction(refill), 60, 1001));
    assert!(execute_recorded_at(deployment, Command::BurnResourceForResourceProduction(refill), 60, 1002));
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    let slot = ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 26 };
    assert_eq!(resources.resource_production(slot).output_amount_left, 600);
    assert_eq!(resources.resource_production(slot).building_count, 0);
    assert_eq!(resources.resource_balance(slot), 0);
    assert_eq!(resources.resource_balance(ResourceSlot { resource_type: 2, ..slot }), 2 * precision + 60);
    assert_eq!(resources.resource_balance(ResourceSlot { resource_type: 3, ..slot }), 60);
}

#[test]
fn malformed_refills_and_out_of_game_actions_reject_without_spending() {
    let (deployment, home, _) = setup();
    configure(deployment);
    grant(deployment, home, 2, 100);
    grant(deployment, home, 3, 100);
    let valid = RefillProduction {
        structure_id: home.entity_id, resource_types: array![26].span(), amounts: array![1].span(),
    };
    let before = resource_facts(deployment, home);
    for command in array![
        Command::BurnLaborForResourceProduction(valid), Command::BurnResourceForResourceProduction(valid),
    ] {
        assert_terminal_rejection(deployment, command, 19);
    }
    for malformed in array![
        RefillProduction { amounts: array![].span(), ..valid }, RefillProduction { amounts: array![0].span(), ..valid },
        RefillProduction { resource_types: array![0].span(), ..valid },
        RefillProduction { resource_types: array![59].span(), ..valid },
        RefillProduction { structure_id: 999, ..valid },
    ] {
        for command in array![
            Command::BurnLaborForResourceProduction(malformed), Command::BurnResourceForResourceProduction(malformed),
        ] {
            assert_terminal_rejection(deployment, command, 60);
        }
        assert_eq!(resource_facts(deployment, home), before);
    }
    assert_terminal_rejection(deployment, Command::BurnLaborForResourceProduction(valid), 201);
    assert_terminal_rejection(deployment, Command::BurnResourceForResourceProduction(valid), 201);
    assert_eq!(resource_facts(deployment, home), before);
}

#[test]
fn blitz_rejects_labor_recipes_but_accepts_resource_production() {
    let (deployment, key, _) = super::resource_commands::setup_with_rules(
        crate::rules::SliceRules {
            mode_rules: super::recorded::BLITZ_RULES,
            entry_rule: crate::rules::ENTRY_ROSTER,
            command_mask: super::recorded::BLITZ_COMMAND_MASK,
            ..super::recorded::rules(),
        },
    );
    configure(deployment);
    grant(deployment, key, 2, 100);
    grant(deployment, key, 3, 100);
    let refill = RefillProduction {
        structure_id: key.entity_id, resource_types: array![26].span(), amounts: array![1].span(),
    };
    assert_terminal_rejection(deployment, Command::BurnLaborForResourceProduction(refill), 60);
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    let slot = ResourceSlot { game_id: 3, entity_id: key.entity_id, resource_type: 2 };
    assert_eq!(resources.resource_balance(slot), 100);
    assert!(execute_recorded_at(deployment, Command::BurnResourceForResourceProduction(refill), 60, 1000));
    assert_eq!(resources.resource_balance(slot), 90);
}
