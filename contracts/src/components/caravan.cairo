use eternum::alias::ID;

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Caravan {
    caravan_id: ID, 
}

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct CaravanMembers {
    key: ID,
    count: usize,
}
