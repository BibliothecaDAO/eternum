#[starknet::component]
pub mod ProductionState {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::RowSet;
    use crate::production::{ProductionBonus, ProductionRecipe, RecipeConfig, RecipeKey, RecipeTerms};
    use crate::resources::{ResourceAmount, ResourceKey};

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
        fn configure(ref self: ComponentState<TContractState>, game_id: u32, recipes: Span<RecipeConfig>) {
            assert!(!self.data.production.configured.read(game_id), "immutable production recipes");
            assert!(recipes.len() == 58, "incomplete production recipes");
            let mut expected = 1_u8;
            for config in recipes {
                assert!(*config.resource_type == expected, "production recipes must be ordered");
                let recipe = *config.recipe;
                let terms = RecipeTerms {
                    simple_output: recipe.simple_output,
                    complex_output: recipe.complex_output,
                    simple_count: recipe.simple_inputs.len().try_into().unwrap(),
                    complex_count: recipe.complex_inputs.len().try_into().unwrap(),
                };
                self.data.production.terms.write((game_id, expected), terms);
                self.write_inputs(game_id, expected, false, recipe.simple_inputs);
                self.write_inputs(game_id, expected, true, recipe.complex_inputs);
                let mut values = array![];
                recipe.serialize(ref values);
                self
                    .emit(
                        RowSet {
                            version: 1,
                            model: 'ProductionRecipe',
                            keys: array![game_id.into(), expected.into()].span(),
                            values: values.span(),
                        },
                    );
                expected += 1;
            }
            self.data.production.configured.write(game_id, true);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'ProductionReady',
                        keys: array![game_id.into()].span(),
                        values: array![1].span(),
                    },
                );
        }
        fn recipe(self: @ComponentState<TContractState>, key: RecipeKey) -> ProductionRecipe {
            assert!(self.data.production.configured.read(key.game_id), "missing production recipes");
            assert!(key.resource_type > 0 && key.resource_type <= 58, "invalid production resource");
            let terms = self.data.production.terms.read((key.game_id, key.resource_type));
            ProductionRecipe {
                simple_output: terms.simple_output,
                complex_output: terms.complex_output,
                simple_inputs: self.read_inputs(key, false, terms.simple_count),
                complex_inputs: self.read_inputs(key, true, terms.complex_count),
            }
        }
        fn bonus(self: @ComponentState<TContractState>, key: ResourceKey) -> ProductionBonus {
            self.data.production.bonuses.read((key.game_id, key.entity_id))
        }
        fn write_inputs(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            resource_type: u8,
            complex: bool,
            inputs: Span<ResourceAmount>,
        ) {
            let mut index = 0_u8;
            for input in inputs {
                assert!(*input.resource_type > 0 && *input.resource_type <= 58, "invalid recipe input");
                self.data.production.inputs.write((game_id, resource_type, complex, index), *input);
                index += 1;
            }
        }
        fn read_inputs(
            self: @ComponentState<TContractState>, key: RecipeKey, complex: bool, count: u8,
        ) -> Span<ResourceAmount> {
            let mut inputs = array![];
            for index in 0..count {
                inputs.append(self.data.production.inputs.read((key.game_id, key.resource_type, complex, index)));
            }
            inputs.span()
        }
    }
}
