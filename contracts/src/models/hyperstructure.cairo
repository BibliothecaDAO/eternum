use starknet::ContractAddress;

#[derive(Copy, Drop, Serde)]
#[dojo::model]
struct Progress {
    #[key]
    hyperstructure_entity_id: u128,
    #[key]
    resource_type: u8,
    amount: u128,
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
struct Contribution {
    #[key]
    hyperstructure_entity_id: u128,
    #[key]
    player_address: ContractAddress,
    #[key]
    resource_type: u8,
    amount: u128,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
struct HyperstructureUpdate {
    #[key]
    hyperstructure_entity_id: u128,
    last_updated_timestamp: u64,
    last_updated_by: ContractAddress,
}
