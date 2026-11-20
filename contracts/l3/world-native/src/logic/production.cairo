#[starknet::component]
pub mod ProductionState {
    use crate::events::RowSet;
    use crate::production::{ProductionRecipe, RecipeKey};

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    pub struct Storage {
        #[flat]
        pub data: crate::state::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
    }

    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn recipe(self: @ComponentState<TContractState>, key: RecipeKey) -> ProductionRecipe {
            assert!(key.resource_type > 0 && key.resource_type <= 58, "invalid production resource");
            let row = *crate::balance::resources::RECIPES.span().at(key.resource_type.into() - 1);
            let inputs = crate::balance::resources::RECIPE_INPUTS.span();
            ProductionRecipe {
                simple_output: row.simple_output,
                complex_output: row.complex_output,
                simple_inputs: inputs.slice(row.first_input, row.simple_count),
                complex_inputs: inputs.slice(row.first_input + row.simple_count, row.complex_count),
            }
        }
    }
}
