pub use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
pub use crate::commands::Command;
pub use crate::game::{IGameDispatcher, IGameDispatcherTrait};
pub use crate::production::{ProductionBonus, ProductionRecipe, RecipeConfig, RefillProduction};
pub use crate::registrar::{IRegistrarSafeDispatcher, IRegistrarSafeDispatcherTrait};
pub use crate::resources::{IResourceOperationsDispatcher, ResourceAmount, ResourceRule, ResourceSlot};
pub use crate::tests::state::ResourceObservationTrait;
pub use super::resource_commands::{
    assert_terminal_rejection, execute, grant, resource_facts, set_fixture, setup, setup_with_rules,
};
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
