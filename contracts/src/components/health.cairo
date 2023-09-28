use eternum::alias::ID;

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Health {
    #[key]
    entity_id: ID,
    balance: u8 
}
