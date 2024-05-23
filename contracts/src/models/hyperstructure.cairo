use starknet::ContractAddress;

#[derive(Model, Copy, Drop, Serde)]
struct Progress {
    #[key]
    hyperstructure_entity_id: u128,
    #[key]
    resource_type: u8,
    amount: u128,
}

#[derive(Model, Copy, Drop, Serde)]
struct Contribution {
    #[key]
    hyperstructure_entity_id: u128,
    #[key]
    player_address: ContractAddress,
    #[key]
    resource_type: u8,
    amount: u128,
}
