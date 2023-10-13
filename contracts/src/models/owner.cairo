use starknet::ContractAddress;

// contract address owning an entity
#[derive(Model, Copy, Drop, Serde)]
struct Owner {
    #[key]
    entity_id: u128,
    address: ContractAddress,
}
