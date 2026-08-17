#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct AddressName {
    #[key]
    pub address: felt252,
    pub name: felt252,
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct EntityName {
    #[key]
    pub game_id: u32,
    #[key]
    pub entity_id: u32,
    pub name: felt252,
}
