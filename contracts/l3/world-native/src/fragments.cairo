use starknet::ContractAddress;

pub const WONDER_QUEST_FRAGMENTS: u16 = 10;
pub const SEAL_FRAGMENTS: u16 = 1000;
pub const OATH_REROLL_FRAGMENTS: u16 = 25;
pub const STAMINA_PER_FRAGMENT: u16 = 2;
pub const CACHE_TROOPS_PER_FRAGMENT: u16 = 100;
pub const SURFACE_CACHE_PERCENT: u8 = 19;
pub const VEIL_CACHE_PERCENT: u8 = 10;
pub const HOLLOW_CACHE_PERCENT: u8 = 5;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct FragmentCredit {
    pub id: felt252,
    pub account: ContractAddress,
    pub amount: u128,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BuyStamina {
    pub explorer_id: u64,
    pub fragments: u64,
}

#[starknet::interface]
pub trait ISealShop<T> {
    fn buy_seal(ref self: T, game_id: u32, actor: ContractAddress, context: crate::commands::ActionContext);
}

#[starknet::interface]
pub trait IStaminaShop<T> {
    fn buy_stamina(
        ref self: T, game_id: u32, actor: ContractAddress, command: BuyStamina, context: crate::commands::ActionContext,
    );
}

pub fn stamina_fragments(gap: u64) -> u64 {
    let points: u64 = STAMINA_PER_FRAGMENT.into();
    (gap + points - 1) / points
}

pub fn holds_cache(seed: u256, depth: u8) -> bool {
    let percent = match depth {
        0 => SURFACE_CACHE_PERCENT,
        1 => VEIL_CACHE_PERCENT,
        2 => HOLLOW_CACHE_PERCENT,
        _ => 0,
    };
    let roll: u256 = core::poseidon::poseidon_hash_span(array!['cache', seed.low.into(), seed.high.into()].span())
        .into();
    roll % 100 < percent.into()
}

pub fn cache_fragments(relic: crate::army_relics::ArmyRelic, depth: u8) -> u128 {
    crate::army_relics::ruin_strength(relic.rank, depth) / CACHE_TROOPS_PER_FRAGMENT.into()
}
