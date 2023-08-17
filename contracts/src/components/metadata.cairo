use eternum::alias::ID;

// a way to store the type of the entity in addition
// to the list of components which we already have
#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct MetaData {
    #[key]
    entity_id: u128,
    entity_type: u128,
}


// a way to link one entity id to another
// e.g. in a caravan, you want to store the list of entities in the caravan
// using an index and the foreign key
// see CreateCaravan for an example
// TODO: change ForeignKey to CaravanMember and stop using general purpose components 
#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct ForeignKey {
    #[key]
    foreign_key: u128,
    entity_id: u128,
}

