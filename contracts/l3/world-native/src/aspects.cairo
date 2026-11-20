pub fn pack(orders: Span<u8>) -> u128 {
    let mut packed = 0_u128;
    for index in 0_u32..16 {
        packed = packed * 256 + Into::<u8, u128>::into(*orders.at(15 - index));
    }
    packed
}

pub fn order_aspect(mut packed: u128, order: u8) -> u8 {
    assert!(order >= 1 && order <= 16, "invalid Order");
    for _ in 1..order {
        packed /= 256;
    }
    (packed % 256).try_into().unwrap()
}

#[starknet::interface]
pub trait IAspects<T> {
    fn draw_realm(self: @T, order: u8, seed: u256) -> u32;
    fn join(ref self: T, key: crate::resources::ResourceKey, order: u8);
}
