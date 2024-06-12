#[derive(Copy, Drop, Serde)]
#[dojo::model]
struct AddressName {
    #[key]
    address: felt252,
    name: felt252
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
struct EntityName {
    #[key]
    entity_id: u128,
    name: felt252
}
