#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct AddressName {
    #[key]
    pub address: felt252,
    pub name: felt252,
}
