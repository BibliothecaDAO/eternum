use crate::resources::ResourceAmount;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RecipeKey {
    pub game_id: u32,
    pub resource_type: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ProductionRecipe {
    pub simple_output: u64,
    pub complex_output: u64,
    pub simple_inputs: Span<ResourceAmount>,
    pub complex_inputs: Span<ResourceAmount>,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RefillProduction {
    pub structure_id: u64,
    pub resource_types: Span<u8>,
    pub amounts: Span<u128>,
}

#[starknet::interface]
pub trait IProductionRules<T> {
    #[cfg(feature: "test_support")]
    fn production_recipe(self: @T, key: RecipeKey) -> ProductionRecipe;
}

#[starknet::interface]
pub trait IProductionCommands<T> {
    fn burn_resource_for_resource_production(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: RefillProduction,
        context: crate::commands::ActionContext,
    );
}

#[derive(Copy, Drop)]
pub struct RecipeRow {
    pub simple_output: u64,
    pub complex_output: u64,
    pub first_input: u32,
    pub simple_count: u32,
    pub complex_count: u32,
}

#[derive(Copy, Drop, Default, starknet::Store)]
pub struct RecipeTerms {
    pub simple_output: u64,
    pub complex_output: u64,
    pub simple_count: u8,
    pub complex_count: u8,
}
