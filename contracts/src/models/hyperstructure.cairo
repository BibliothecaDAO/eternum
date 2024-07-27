use starknet::ContractAddress;

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Progress {
    #[key]
    hyperstructure_entity_id: u128,
    #[key]
    resource_type: u8,
    amount: u128,
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Contribution {
    #[key]
    hyperstructure_entity_id: u128,
    #[key]
    player_address: ContractAddress,
    #[key]
    resource_type: u8,
    amount: u128,
}
