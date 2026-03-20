use core::array::SpanTrait;
use crate::constants::ResourceTypes;

pub const OFFICIAL_60_BLITZ_EXPLORATION_REWARD_PROFILE_ID: u8 = 1;
pub const OFFICIAL_90_BLITZ_EXPLORATION_REWARD_PROFILE_ID: u8 = 2;
pub const DEFAULT_BLITZ_EXPLORATION_REWARD_PROFILE_ID: u8 = OFFICIAL_90_BLITZ_EXPLORATION_REWARD_PROFILE_ID;

#[generate_trait]
pub impl iBlitzExplorationRewardsImpl of iBlitzExplorationRewardsTrait {
    fn is_known_blitz_exploration_reward_profile_id(reward_profile_id: u8) -> bool {
        reward_profile_id == OFFICIAL_60_BLITZ_EXPLORATION_REWARD_PROFILE_ID
            || reward_profile_id == OFFICIAL_90_BLITZ_EXPLORATION_REWARD_PROFILE_ID
    }

    fn assert_known_blitz_exploration_reward_profile_id(reward_profile_id: u8) {
        assert!(Self::is_known_blitz_exploration_reward_profile_id(reward_profile_id), "unknown blitz reward profile");
    }

    fn resolve_blitz_exploration_reward_profile_id(reward_profile_id: u8) -> u8 {
        if reward_profile_id == 0 {
            return DEFAULT_BLITZ_EXPLORATION_REWARD_PROFILE_ID;
        }

        Self::assert_known_blitz_exploration_reward_profile_id(reward_profile_id);
        reward_profile_id
    }

    fn get_official_60_blitz_exploration_rewards() -> Span<(u8, u128, u128)> {
        array![
            (ResourceTypes::ESSENCE, 150, 3_500), (ResourceTypes::ESSENCE, 300, 2_500),
            (ResourceTypes::ESSENCE, 600, 1_500), (ResourceTypes::LABOR, 500, 1_500),
            (ResourceTypes::LABOR, 1_000, 500), (ResourceTypes::DONKEY, 500, 500),
        ]
            .span()
    }

    fn get_official_90_blitz_exploration_rewards() -> Span<(u8, u128, u128)> {
        array![
            (ResourceTypes::ESSENCE, 100, 3_000), (ResourceTypes::ESSENCE, 250, 2_000),
            (ResourceTypes::ESSENCE, 500, 1_500), (ResourceTypes::LABOR, 250, 1_500), (ResourceTypes::LABOR, 500, 800),
            (ResourceTypes::DONKEY, 100, 600), (ResourceTypes::KNIGHT_T1, 1_000, 200),
            (ResourceTypes::CROSSBOWMAN_T1, 1_000, 200), (ResourceTypes::PALADIN_T1, 1_000, 200),
        ]
            .span()
    }

    fn split_blitz_exploration_rewards_and_probabilities(reward_profile_id: u8) -> (Span<(u8, u128)>, Span<u128>) {
        let resolved_reward_profile_id = Self::resolve_blitz_exploration_reward_profile_id(reward_profile_id);
        let mut zipped = if resolved_reward_profile_id == OFFICIAL_60_BLITZ_EXPLORATION_REWARD_PROFILE_ID {
            Self::get_official_60_blitz_exploration_rewards()
        } else {
            Self::get_official_90_blitz_exploration_rewards()
        };
        let mut rewards = array![];
        let mut probabilities = array![];

        loop {
            match zipped.pop_front() {
                Option::Some((
                    reward_id, amount, probability,
                )) => {
                    rewards.append((*reward_id, *amount));
                    probabilities.append(*probability);
                },
                Option::None => { break; },
            }
        }

        (rewards.span(), probabilities.span())
    }
}

#[cfg(test)]
mod tests {
    use core::array::SpanTrait;
    use crate::constants::ResourceTypes;
    use super::{
        DEFAULT_BLITZ_EXPLORATION_REWARD_PROFILE_ID, OFFICIAL_60_BLITZ_EXPLORATION_REWARD_PROFILE_ID,
        OFFICIAL_90_BLITZ_EXPLORATION_REWARD_PROFILE_ID, iBlitzExplorationRewardsImpl,
    };

    fn assert_reward_row(
        rewards: Span<(u8, u128, u128)>,
        index: usize,
        expected_reward_id: u8,
        expected_amount: u128,
        expected_probability: u128,
    ) {
        let (reward_id, amount, probability) = *rewards.at(index);
        assert_eq!(reward_id, expected_reward_id);
        assert_eq!(amount, expected_amount);
        assert_eq!(probability, expected_probability);
    }

    fn assert_split_reward_row(
        rewards: Span<(u8, u128)>,
        probabilities: Span<u128>,
        index: usize,
        expected_reward_id: u8,
        expected_amount: u128,
        expected_probability: u128,
    ) {
        let (reward_id, amount) = *rewards.at(index);
        let probability = *probabilities.at(index);
        assert_eq!(reward_id, expected_reward_id);
        assert_eq!(amount, expected_amount);
        assert_eq!(probability, expected_probability);
    }

    #[test]
    fn resolves_zero_to_the_default_profile_id() {
        let resolved_reward_profile_id = iBlitzExplorationRewardsImpl::resolve_blitz_exploration_reward_profile_id(0);

        assert_eq!(resolved_reward_profile_id, DEFAULT_BLITZ_EXPLORATION_REWARD_PROFILE_ID);
        assert_eq!(resolved_reward_profile_id, OFFICIAL_90_BLITZ_EXPLORATION_REWARD_PROFILE_ID);
    }

    #[test]
    #[should_panic]
    fn rejects_unknown_profile_ids() {
        iBlitzExplorationRewardsImpl::resolve_blitz_exploration_reward_profile_id(7);
    }

    #[test]
    fn returns_the_official_60_reward_rows() {
        let rewards = iBlitzExplorationRewardsImpl::get_official_60_blitz_exploration_rewards();

        assert_eq!(rewards.len(), 6);
        assert_reward_row(rewards, 0, ResourceTypes::ESSENCE, 150, 3_500);
        assert_reward_row(rewards, 1, ResourceTypes::ESSENCE, 300, 2_500);
        assert_reward_row(rewards, 2, ResourceTypes::ESSENCE, 600, 1_500);
        assert_reward_row(rewards, 3, ResourceTypes::LABOR, 500, 1_500);
        assert_reward_row(rewards, 4, ResourceTypes::LABOR, 1_000, 500);
        assert_reward_row(rewards, 5, ResourceTypes::DONKEY, 500, 500);
    }

    #[test]
    fn returns_the_official_90_reward_rows() {
        let rewards = iBlitzExplorationRewardsImpl::get_official_90_blitz_exploration_rewards();

        assert_eq!(rewards.len(), 9);
        assert_reward_row(rewards, 0, ResourceTypes::ESSENCE, 100, 3_000);
        assert_reward_row(rewards, 1, ResourceTypes::ESSENCE, 250, 2_000);
        assert_reward_row(rewards, 2, ResourceTypes::ESSENCE, 500, 1_500);
        assert_reward_row(rewards, 3, ResourceTypes::LABOR, 250, 1_500);
        assert_reward_row(rewards, 4, ResourceTypes::LABOR, 500, 800);
        assert_reward_row(rewards, 5, ResourceTypes::DONKEY, 100, 600);
        assert_reward_row(rewards, 6, ResourceTypes::KNIGHT_T1, 1_000, 200);
        assert_reward_row(rewards, 7, ResourceTypes::CROSSBOWMAN_T1, 1_000, 200);
        assert_reward_row(rewards, 8, ResourceTypes::PALADIN_T1, 1_000, 200);
    }

    #[test]
    fn splits_the_official_60_reward_rows_and_probabilities() {
        let (rewards, probabilities) = iBlitzExplorationRewardsImpl::split_blitz_exploration_rewards_and_probabilities(
            OFFICIAL_60_BLITZ_EXPLORATION_REWARD_PROFILE_ID,
        );

        assert_eq!(rewards.len(), 6);
        assert_eq!(probabilities.len(), 6);
        assert_split_reward_row(rewards, probabilities, 0, ResourceTypes::ESSENCE, 150, 3_500);
        assert_split_reward_row(rewards, probabilities, 5, ResourceTypes::DONKEY, 500, 500);
    }
}
