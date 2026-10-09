use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct MmrParams {
    pub enabled: bool,
    pub mean: u16,
    pub spread: u16,
    pub max_delta: u8,
    pub k: u8,
    pub regression_bps: u16,
    pub min_players: u8,
}

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct Preset {
    pub entry_fee: u256,
    pub protocol_cut_bps: u16,
    pub chest_lords_bps: u16,
    pub paid_fraction_bps: u16,
    pub decay_bps: u16,
    pub sword_price: u256,
    pub shield_price: u256,
    pub mmr: MmrParams,
    pub day_unit_seconds: u32,
    pub season_bags: u32,
    pub claim_window_seconds: u32,
}

#[derive(Copy, Default, Drop, Serde, starknet::Store)]
pub struct Game {
    pub season_id: u32,
    pub exists: bool,
    pub preset_id: u32,
    pub start: u64,
    pub end: u64,
    pub pool: u256,
    pub result_commitment: felt252,
    pub registered_count: u16,
    pub cancelled: bool,
    pub finalized: bool,
}

#[derive(Copy, Default, Drop, Serde, starknet::Store)]
pub struct Registration {
    pub registered: bool,
    pub sword: bool,
    pub shield: bool,
    pub flags_consumed: bool,
    pub sword_credit: bool,
    pub shield_credit: bool,
    pub paid: u256,
    pub realm_id: u256,
    pub pass_kind: u8,
}

#[derive(Copy, Default, Drop, Serde, starknet::Store)]
pub struct PlayerResult {
    pub rank: u16,
    pub chest_id: u256,
    pub mmr_before: u128,
    pub mmr_after: u128,
}

#[derive(Copy, Drop, Serde)]
pub struct RankedPlayer {
    pub wallet: ContractAddress,
    pub rank: u16,
}

#[derive(Copy, Drop, Serde)]
pub struct ChestContent {
    pub kind: u8,
    pub cosmetic: u128,
    pub lords: u256,
}

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct Chest {
    pub exists: bool,
    pub season_id: u32,
    pub band: u8,
    pub requested: bool,
    pub finished: bool,
    pub requester: ContractAddress,
    pub request_block: u64,
}

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct ChestOdds {
    pub common: u16,
    pub uncommon: u16,
    pub rare: u16,
    pub epic: u16,
    pub legendary: u16,
    pub lords: u16,
    pub sword: u16,
    pub shield: u16,
}

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct ChestBandPreset {
    pub metadata: u128,
    pub odds: ChestOdds,
    pub lords_amount: u256,
}

#[derive(Copy, Default, Drop, Serde, starknet::Store)]
pub struct Credits {
    pub swords: u32,
    pub shields: u32,
}

#[derive(Copy, Default, Drop, Serde, starknet::Store)]
pub struct FrontierSeason {
    pub funded: bool,
    pub start: u64,
    pub end: u64,
    pub pool: u256,
    pub paid: u256,
    pub closed: bool,
    pub preset_id: u32,
    pub seed: felt252,
}

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct WithdrawalPayment {
    pub paid: bool,
    pub season_id: u32,
    pub wallet: ContractAddress,
    pub amount: u256,
}

#[derive(Copy, Default, Drop, Serde, starknet::Store)]
pub struct BlitzSeason {
    pub chest_reserve: u256,
    pub participant_count: u32,
    pub top_count: u32,
    pub posted: bool,
    pub challenged: bool,
    pub review_until: u64,
    pub settlement_started: bool,
    pub paid: u256,
    pub exists: bool,
    pub preset_id: u32,
    pub start: u64,
    pub end: u64,
    pub pool: u256,
}

#[derive(Copy, Drop, Serde, Hash, PartialEq, starknet::Store)]
pub struct GameKey {
    pub shard: felt252,
    pub game_id: u32,
}

// The shared day schedule reads only these launch values, not the world contract's gameplay state.
#[derive(Copy, Drop)]
pub struct FrontierClock {
    pub start_main_at: u64,
    pub seed: felt252,
}
