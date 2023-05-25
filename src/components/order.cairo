use eternum::alias::ID;

// DISCUSSION: in future we should be able 
// to trade any entity with any other entity as long it has a weight component
#[derive(Component, Copy, Drop, Serde)]
struct Order {
    maker: ID,
    maker_resource_type: u8,
    maker_resource_quantity: u128,
    maker_arrival: u64,
    maker_caravan_count: u8,
    taker: ID,
    taker_resource_type: u8,
    taker_resource_quantity: u128,
    taker_arrival: u64,
    taker_caravan_count: u8,
    expire_at: u64,
    status: u8,
}
