use eternum::alias::ID;

#[derive(Component, Copy, Drop, Serde)]
struct Entities {
    key: ID,
    count: usize,
}

#[derive(Component, Copy, Drop, Serde)]
struct ForeignKey {
    entity_id: ID, 
}

#[derive(Component, Copy, Drop, Serde)]
struct FungibleEntities {
    key: ID,
    count: usize,
}

