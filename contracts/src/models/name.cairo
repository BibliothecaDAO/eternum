#[derive(Model, Copy, Drop, Serde)]
struct AddressName {
    #[key]
    address: felt252,
    name: felt252
}
