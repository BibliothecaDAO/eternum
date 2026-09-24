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
pub struct RecipeConfig {
    pub resource_type: u8,
    pub recipe: ProductionRecipe,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RefillProduction {
    pub structure_id: u32,
    pub resource_types: Span<u8>,
    pub amounts: Span<u128>,
}

#[derive(Copy, Drop, Serde, Default, Debug, PartialEq)]
pub struct ProductionBonus {
    pub incr_resource_rate_percent_num: u16,
    pub incr_labor_rate_percent_num: u16,
    pub incr_troop_rate_percent_num: u16,
    pub incr_resource_rate_end_tick: u32,
    pub incr_labor_rate_end_tick: u32,
    pub incr_troop_rate_end_tick: u32,
}

const U16_SCALE: u128 = 0x10000;
const U32_SCALE: u128 = 0x100000000;
const U48_SCALE: u128 = 0x1000000000000;

pub impl BonusPacking of starknet::storage_access::StorePacking<ProductionBonus, felt252> {
    fn pack(value: ProductionBonus) -> felt252 {
        let percentages: u128 = value.incr_resource_rate_percent_num.into()
            + value.incr_labor_rate_percent_num.into() * U16_SCALE
            + value.incr_troop_rate_percent_num.into() * U32_SCALE;
        let ticks: u128 = value.incr_resource_rate_end_tick.into()
            + value.incr_labor_rate_end_tick.into() * U32_SCALE
            + value.incr_troop_rate_end_tick.into() * U32_SCALE * U32_SCALE;
        percentages.into() + ticks.into() * U48_SCALE.into()
    }
    fn unpack(value: felt252) -> ProductionBonus {
        let value: u256 = value.into();
        let percentages = value.low % U48_SCALE;
        let ticks = value.low / U48_SCALE + value.high * 0x100000000000000000000;
        ProductionBonus {
            incr_resource_rate_percent_num: (percentages % U16_SCALE).try_into().unwrap(),
            incr_labor_rate_percent_num: (percentages / U16_SCALE % U16_SCALE).try_into().unwrap(),
            incr_troop_rate_percent_num: (percentages / U32_SCALE).try_into().unwrap(),
            incr_resource_rate_end_tick: (ticks % U32_SCALE).try_into().unwrap(),
            incr_labor_rate_end_tick: (ticks / U32_SCALE % U32_SCALE).try_into().unwrap(),
            incr_troop_rate_end_tick: (ticks / U32_SCALE / U32_SCALE).try_into().unwrap(),
        }
    }
}

pub fn bonus_output(bonus: ProductionBonus, resource_type: u8, amount: u128, tick: u32) -> u128 {
    let (percent, end) = if resource_type == 23 {
        (bonus.incr_labor_rate_percent_num, bonus.incr_labor_rate_end_tick)
    } else if crate::resources::is_troop_resource(resource_type) {
        (bonus.incr_troop_rate_percent_num, bonus.incr_troop_rate_end_tick)
    } else {
        (bonus.incr_resource_rate_percent_num, bonus.incr_resource_rate_end_tick)
    };
    // The recorded end tick is inclusive for every production bonus.
    if tick > end {
        amount
    } else {
        amount + crate::math::PercentageImpl::get(amount, percent.into())
    }
}

#[starknet::interface]
pub trait IProductionRules<T> {
    fn configure_production(ref self: T, game_id: u32, recipes: Span<RecipeConfig>);
    #[cfg(test)]
    fn production_recipe(self: @T, key: RecipeKey) -> ProductionRecipe;
    #[cfg(test)]
    fn production_bonus(self: @T, key: crate::resources::ResourceKey) -> ProductionBonus;
}

#[starknet::interface]
pub trait IProductionCommands<T> {
    fn burn_labor_for_resource_production(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: RefillProduction,
        context: crate::commands::ActionContext,
    );
    fn burn_resource_for_resource_production(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: RefillProduction,
        context: crate::commands::ActionContext,
    );
}

#[derive(Copy, Drop, Default, starknet::Store)]
pub struct RecipeTerms {
    pub simple_output: u64,
    pub complex_output: u64,
    pub simple_count: u8,
    pub complex_count: u8,
}
