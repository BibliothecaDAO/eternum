#[starknet::component]
pub mod ProductionState {
    use starknet::storage::StorageMapReadAccess;
    use crate::events::RowSet;
    use crate::production::{ProductionBonus, ProductionRecipe, RecipeKey};
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
        fn recipe(self: @ComponentState<TContractState>, key: RecipeKey) -> ProductionRecipe {
            let preset = crate::logic::preset_record::for_game(key.game_id);
            assert!(key.resource_type > 0 && key.resource_type <= 58, "invalid production resource");
            let terms = preset.production_terms.read(key.resource_type);
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
        fn read_inputs(
            self: @ComponentState<TContractState>, key: RecipeKey, complex: bool, count: u8,
        ) -> Span<ResourceAmount> {
            let preset = crate::logic::preset_record::for_game(key.game_id);
            let mut inputs = array![];
            for index in 0..count {
                inputs.append(preset.production_inputs.read((key.resource_type, complex, index)));
            }
            inputs.span()
        }
    }
}
