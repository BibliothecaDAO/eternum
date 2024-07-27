use eternum::alias::ID;

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct AddressName {
    #[key]
    address: felt252,
    name: felt252
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct EntityName {
    #[key]
    entity_id: ID,
    name: felt252
}
