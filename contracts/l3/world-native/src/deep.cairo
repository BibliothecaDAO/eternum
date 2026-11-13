#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct DeepShare {
    pub home: u64,
    pub troops: u128,
}

#[starknet::interface]
pub trait IDeepRewards<T> {
    fn pay_deep_tick(ref self: T, game_id: u32, kind: u8, aspect: u8, shares: Span<DeepShare>, timestamp: u64);
}
