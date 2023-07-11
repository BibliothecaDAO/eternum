use eternum::alias::ID;

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Caravan {
    caravan_id: u128, 
}

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct CaravanMembers {
    key: u128,
    count: usize,
}
