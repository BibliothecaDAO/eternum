use eternum::constants::{ResourceTypes, RESOURCE_PRECISION};

const MAP_EXPLORE_EXPLORATION_WHEAT_BURN_AMOUNT: u128 = 1;
const MAP_EXPLORE_EXPLORATION_FISH_BURN_AMOUNT: u128 = 1;

const MAP_EXPLORE_TRAVEL_WHEAT_BURN_AMOUNT: u128 = 1;
const MAP_EXPLORE_TRAVEL_FISH_BURN_AMOUNT: u128 = 1;
const EARTHEN_SHARD_PRODUCTION_AMOUNT_PER_TICK: u128 = 100 * RESOURCE_PRECISION;
const MAP_EXPLORE_WHEAT_BURN_AMOUNT: u128 = 100_000;
const MAP_EXPLORE_FISH_BURN_AMOUNT: u128 = 100_000;

const MAP_EXPLORE_RANDOM_MINT_AMOUNT: u128 = 3;
const SHARDS_MINE_FAIL_PROBABILITY_WEIGHT: u128 = 1000;

const LORDS_COST: u128 = 1_000_000;
const LP_FEES_NUM: u128 = 15;
const LP_FEE_DENOM: u128 = 100;

const STOREHOUSE_CAPACITY_GRAMS: u128 = 10_000_000_000;

fn get_resource_weights() -> Span<(u8, u128)> {
    array![
        (ResourceTypes::WOOD.into(), 1_000),
        (ResourceTypes::STONE.into(), 1_000),
        (ResourceTypes::COAL.into(), 1_000),
        (ResourceTypes::COPPER.into(), 1_000),
        (ResourceTypes::OBSIDIAN.into(), 1_000),
        (ResourceTypes::SILVER.into(), 1_000),
        (ResourceTypes::IRONWOOD.into(), 1_000),
        (ResourceTypes::COLD_IRON.into(), 1_000),
        (ResourceTypes::GOLD.into(), 1_000),
        (ResourceTypes::HARTWOOD.into(), 1_000),
        (ResourceTypes::DIAMONDS.into(), 1_000),
        (ResourceTypes::SAPPHIRE.into(), 1_000),
        (ResourceTypes::RUBY.into(), 1_000),
        (ResourceTypes::DEEP_CRYSTAL.into(), 1_000),
        (ResourceTypes::IGNIUM.into(), 1_000),
        (ResourceTypes::ETHEREAL_SILICA.into(), 1_000),
        (ResourceTypes::TRUE_ICE.into(), 1_000),
        (ResourceTypes::TWILIGHT_QUARTZ.into(), 1_000),
        (ResourceTypes::ALCHEMICAL_SILVER.into(), 1_000),
        (ResourceTypes::ADAMANTINE.into(), 1_000),
        (ResourceTypes::MITHRAL.into(), 1_000),
        (ResourceTypes::DRAGONHIDE.into(), 1_000),
        (ResourceTypes::EARTHEN_SHARD.into(), 1_000),
        (ResourceTypes::DONKEY.into(), 0),
        (ResourceTypes::KNIGHT.into(), 0),
        (ResourceTypes::CROSSBOWMAN.into(), 0),
        (ResourceTypes::PALADIN.into(), 0),
        (ResourceTypes::LORDS.into(), 1),
        (ResourceTypes::WHEAT.into(), 100),
        (ResourceTypes::FISH.into(), 100),
    ]
        .span()
}
