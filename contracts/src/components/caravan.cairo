use eternum::alias::ID;

#[derive(Component, Copy, Drop, Serde)]
struct Caravan {
    caravan_id: ID, 
}

#[derive(Component, Copy, Drop, Serde)]
struct CaravanMembers {
    key: ID,
    count: usize,
}
