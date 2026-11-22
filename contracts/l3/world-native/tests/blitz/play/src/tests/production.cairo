pub use world_test_support::tests::troop_management::*;
use super::fixture::blitz_realm;
use super::play_fixture::FIXTURE_START;
use super::resource_commands::{execute_in_game, grant};

const NOW: u64 = FIXTURE_START + 40;
const STONE: u8 = 2;

fn burn_for(home: ResourceKey, resource_type: u8, cycles: u128) -> Command {
    Command::BurnResourceForResourceProduction(
        crate::production::RefillProduction {
            structure_id: home.entity_id, resource_types: array![resource_type].span(), amounts: array![cycles].span(),
        },
    )
}

fn recipe(d: super::Deployment, home: ResourceKey, resource_type: u8) -> crate::production::ProductionRecipe {
    crate::production::IProductionRulesDispatcherTrait::production_recipe(
        crate::production::IProductionRulesDispatcher { contract_address: d.games },
        crate::production::RecipeKey { game_id: home.game_id, resource_type },
    )
}

fn slot(home: ResourceKey, resource_type: u8) -> ResourceSlot {
    ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type }
}

#[test]
fn a_realm_burns_inputs_for_cycles_of_production() {
    let (d, home) = blitz_realm();
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let row = recipe(d, home, STONE);
    for input in row.complex_inputs {
        grant(d, home, *input.resource_type, *input.amount * 2);
    }
    let before = resources.resource_production(slot(home, STONE)).output_amount_left;
    assert!(execute_in_game(d, home.game_id, burn_for(home, STONE, 2), NOW));
    for input in row.complex_inputs {
        assert_eq!(resources.resource_balance(slot(home, *input.resource_type)), 0);
    }
    let after = resources.resource_production(slot(home, STONE)).output_amount_left;
    assert_eq!(after - before, Into::<u64, u128>::into(row.complex_output) * 2);
}

#[test]
fn a_realm_does_not_burn_inputs_it_lacks() {
    let (d, home) = blitz_realm();
    assert!(!execute_in_game(d, home.game_id, burn_for(home, STONE, 1), NOW));
}
