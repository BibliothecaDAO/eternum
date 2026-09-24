use starknet::ContractAddress;
use crate::commands::ExecutionContext;
use crate::resources::ResourceKey;

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ExplorationReward {
    pub resource_type: u8,
    pub amount: u128,
    pub amount_max: u128,
    pub weight: u128,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ExtractedReward {
    pub explorer_id: u32,
    pub receiver: u32,
    pub coord: crate::troops::Coord,
    pub resource_type: u8,
    pub amount: u128,
}
#[starknet::interface]
pub trait IExtraction<T> {
    fn configure_extraction(ref self: T, game_id: u32, rewards: Span<ExplorationReward>);
    fn extraction_rewards(self: @T, game_id: u32) -> Span<ExplorationReward>;
    fn extract_exploration_reward(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        explorer_id: u32,
        revealed: Option<crate::troops::Coord>,
        context: ExecutionContext,
    );
}
#[starknet::interface]
pub trait IExplorationGrant<T> {
    fn grant_exploration_reward(ref self: T, key: ResourceKey, resource_type: u8, amount: u128, timestamp: u64);
}
pub fn draw(rewards: Span<ExplorationReward>, seed: u256, timestamp: u64) -> ExplorationReward {
    let mut total: u128 = 0;
    for reward in rewards {
        total += *reward.weight;
    }
    assert!(total != 0, "empty exploration pool");
    let roll = crate::random::range(seed, timestamp.into() + 18, total);
    let mut cumulative = 0;
    for reward in rewards {
        cumulative += *reward.weight;
        if roll < cumulative {
            return ExplorationReward {
                amount: *reward.amount
                    + crate::random::range(seed, timestamp.into() + 19, *reward.amount_max - *reward.amount + 1),
                ..*reward,
            };
        }
    }
    panic!("invalid exploration draw")
}
pub fn boosted_amount(amount: u128, boosts: crate::troops::TroopBoosts, tick: u64) -> u128 {
    let bonus = if tick <= boosts.incr_explore_reward_end_tick.into() {
        amount * boosts.incr_explore_reward_percent_num.into() / 10000
    } else {
        0
    };
    (amount + bonus) * crate::rules::RESOURCE_PRECISION
}
pub fn receiver(home_rewards: bool, explorer_id: u32, home: u32, resource_type: u8) -> u32 {
    if !home_rewards || (resource_type >= 39 && resource_type <= 56) {
        explorer_id
    } else {
        home
    }
}
