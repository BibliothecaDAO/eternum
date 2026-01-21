use dojo::storage::dojo_store::DojoStore;
use starknet::ContractAddress;
use crate::alias::ID;
use crate::constants::WORLD_CONFIG_ID;

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct FaithConfig {
    pub wonder_base_fp: u64,
    pub realm_follower_fp: u64,
    pub village_follower_fp: u64,
    pub wonder_follower_fp: u64,
    pub owner_share_bps: u16,
    pub follower_share_bps: u16,
    pub prize_pool_total: u128,
    pub claim_window_ticks: u32,
    pub config_id: ID,
}

#[generate_trait]
pub impl FaithConfigImpl of FaithConfigTrait {
    fn assert_valid(self: FaithConfig) {
        let total_bps: u32 = self.owner_share_bps.into() + self.follower_share_bps.into();
        assert!(total_bps == 10_000_u32, "Invalid faith share split");
    }
}

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct FaithPrizeConfig {
    pub rank_1_share_bps: u16,
    pub rank_2_share_bps: u16,
    pub rank_3_share_bps: u16,
    pub rank_4_share_bps: u16,
    pub rank_5_share_bps: u16,
    pub rank_6_share_bps: u16,
    pub rank_7_share_bps: u16,
    pub rank_8_share_bps: u16,
    pub rank_9_share_bps: u16,
    pub rank_10_share_bps: u16,
    pub wonder_owner_share_bps: u16,
    pub fp_holders_share_bps: u16,
    pub config_id: ID,
}

#[derive(IntrospectPacked, Copy, Drop, Serde, Default)]
#[dojo::model]
pub struct WonderFaith {
    #[key]
    pub wonder_id: ID,
    pub season_id: u32,
    pub realm_follower_count: u32,
    pub village_follower_count: u32,
    pub wonder_follower_count: u32,
    pub total_fp_generated: u128,
    pub current_owner_fp: u128,
    pub last_tick_processed: u64,
    pub season_fp: u128,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct WonderFaithHistory {
    #[key]
    pub wonder_id: ID,
    #[key]
    pub season_id: u32,
    #[key]
    pub original_owner: ContractAddress,
    pub fp_earned_while_owner: u128,
    pub ownership_start_tick: u64,
    pub ownership_end_tick: u64,
    pub prize_claimed: bool,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct FollowerAllegiance {
    #[key]
    pub entity_id: ID,
    pub wonder_id: ID,
    pub pledge_tick: u64,
    pub last_fp_tick: u64,
    pub accumulated_fp: u128,
    pub entity_type: FollowerType,
}

#[derive(Introspect, Copy, Drop, Serde, PartialEq, Default, DojoStore)]
pub enum FollowerType {
    #[default]
    None,
    Realm,
    Village,
    Wonder,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct FollowerFaithBalance {
    #[key]
    pub wonder_id: ID,
    #[key]
    pub season_id: u32,
    #[key]
    pub holder_address: ContractAddress,
    pub total_fp: u128,
    pub last_fp_update_tick: u64,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct FaithSeasonState {
    #[key]
    pub season_id: u32,
    pub prize_pool_total: u128,
    pub season_end_tick: u64,
    pub claim_window_end_tick: u64,
    pub distributed: bool,
    pub leftover_withdrawn: bool,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct FaithSeasonSnapshot {
    #[key]
    pub season_id: u32,
    #[key]
    pub wonder_id: ID,
    pub season_fp: u128,
    pub total_holder_fp: u128,
    pub total_owner_fp: u128,
    pub rank: u32,
    pub total_prize: u128,
    pub owner_prize: u128,
    pub holders_prize: u128,
    pub distributed: bool,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct FaithPrizeBalance {
    #[key]
    pub season_id: u32,
    #[key]
    pub wonder_id: ID,
    #[key]
    pub claimant: ContractAddress,
    pub amount: u128,
    pub claimed: bool,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct FaithLeaderboardEntry {
    #[key]
    pub rank: u32,
    #[key]
    pub season_id: u32,
    pub wonder_id: ID,
    pub total_season_fp: u128,
    pub follower_count: u32,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct WonderRank {
    #[key]
    pub wonder_id: ID,
    #[key]
    pub season_id: u32,
    pub current_rank: u32,
}

pub fn DEFAULT_FAITH_CONFIG() -> FaithConfig {
    FaithConfig {
        wonder_base_fp: 50,
        realm_follower_fp: 10,
        village_follower_fp: 1,
        wonder_follower_fp: 50,
        owner_share_bps: 3000,
        follower_share_bps: 7000,
        prize_pool_total: 0,
        claim_window_ticks: 168,
        config_id: WORLD_CONFIG_ID,
    }
}
