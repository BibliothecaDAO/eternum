use starknet::ContractAddress;

pub const PURCHASE: u8 = 1;
pub const FRIEND: u8 = 2;
pub const WONDER_QUEST: u16 = 10;
pub const SEAL_PRICE: u16 = 1000;
pub const STAMINA_PER_FRAGMENT: u16 = 2;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct FragmentCredit {
    pub id: felt252,
    pub account: ContractAddress,
    pub source: u8,
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
