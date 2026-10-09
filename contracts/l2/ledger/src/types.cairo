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
    pub paid_fraction_bps: u16,
    pub decay_bps: u16,
    pub sword_price: u256,
    pub shield_price: u256,
    pub mmr: MmrParams,
}

#[derive(Copy, Default, Drop, Serde, starknet::Store)]
pub struct Game {
    pub season_id: u32,
    pub exists: bool,
    pub preset_id: u32,
    pub start: u64,
    pub end: u64,
    pub pool: u256,
    pub registered_count: u16,
    pub cancelled: bool,
    pub finalized: bool,
}

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct Registration {
    pub registered: bool,
    pub sword: bool,
    pub shield: bool,
    pub flags_consumed: bool,
    pub paid: u256,
    pub realm_id: u256,
    pub pass_kind: u8,
}

#[derive(Copy, Default, Drop, Serde, starknet::Store)]
pub struct PlayerResult {
    pub rank: u16,
    pub chests: u16,
    pub mmr_before: u128,
    pub mmr_after: u128,
}

#[derive(Copy, Drop, Serde)]
pub struct RankedPlayer {
    pub owner: ContractAddress,
    pub rank: u16,
    pub chests: u16,
}

#[derive(Copy, Default, Drop, Serde, starknet::Store)]
pub struct FrontierSeason {
    pub funded: bool,
    pub start: u64,
    pub end: u64,
    pub pool: u256,
    pub paid: u256,
    pub closed: bool,
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
    pub exists: bool,
    pub preset_id: u32,
    pub start: u64,
    pub end: u64,
    pub pool: u256,
}
