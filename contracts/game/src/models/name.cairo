use s1_eternum::alias::ID;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct AddressName {
    #[key]
    address: felt252,
    name: felt252
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct EntityName {
    #[key]
    entity_id: ID,
    name: felt252
}
