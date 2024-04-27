#[derive(Model, Copy, Drop, Serde)]
struct AddressName {
    #[key]
    address: felt252,
    name: felt252
}

#[derive(Model, Copy, Drop, Serde)]
struct EntityName {
    #[key]
    entity_id: u128,
    name: felt252
}
