//! Read-only draw vectors for the timestamp-invariance probe; not a gameplay entry.
#[starknet::contract]
pub mod DrawProbe {
    #[storage]
    struct Storage {}
    #[external(v0)]
    fn vector(self: @ContractState, mut root: u256, _clock: u64) -> felt252 {
        let seed = world_native::random::game_root(ref root, 7, 17);
        let tier = world_native::relics::roll_tier(world_native::relics::ChestTiers {
            common: 2000, uncommon: 2000, rare: 2000, epic: 2000, legendary: 2000,
        }, seed, world_native::random::CHEST_TIER_SALT);
        let rewards = array![
            world_native::exploration_rewards::ExplorationReward { resource_type: 1, amount: 1, amount_max: 10, weight: 5000 },
            world_native::exploration_rewards::ExplorationReward { resource_type: 2, amount: 1, amount_max: 10, weight: 5000 },
        ];
        let reward = world_native::exploration_rewards::draw(rewards.span(), seed, world_native::random::REWARD_SALT);
        let destination = world_native::relics::chest_destination(world_native::troops::Coord { alt: false, x: 1000, y: 1000 }, seed, world_native::random::RELIC_POSITION_SALT, 1);
        let mut values = array![tier.into(), reward.resource_type.into(), reward.amount.try_into().unwrap()];
        destination.serialize(ref values);
        let site = world_native::discovery::frontier(world_native::expeditions::FrontierDiscoveryRules {
            stragglers_bps: 1000, camp_bps: 1000, rift_bps: 1000, ruin_bps: 1000, shrine_bps: 1000, well_bps: 1000, empty_reveal_limit: 2,
        }, 0, 0, 0, 0, Some(world_native::relics::SiteChest { tier: 0, amount: 1 }), seed, world_native::random::SITE_SALT);
        site.serialize(ref values);
        for offset in array![1_u256, 2, 7, 10] {
            world_native::random::lottery(seed, offset, 50, 50, world_native::random::DISCOVERY_SALT).serialize(ref values);
        }
        world_native::random::range(seed, Into::<u64, u128>::into(world_native::random::REVEAL_REWARD_SALT)+18, 2).serialize(ref values);
        core::poseidon::poseidon_hash_span(values.span())
    }
}
