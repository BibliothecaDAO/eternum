use eternum::alias::ID;

// a way to link one entity id to another
// e.g. in a caravan, you want to store the list of entities in the caravan
// using an index and the foreign key
// see CreateCaravan for an example
// TODO: change ForeignKey to CaravanMember and stop using general purpose components
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct ForeignKey {
    #[key]
    foreign_key: felt252,
    entity_id: ID,
}

