use eternum::alias::ID;
#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Usage {
    #[key]
    entity_id: ID,
    count: usize
}