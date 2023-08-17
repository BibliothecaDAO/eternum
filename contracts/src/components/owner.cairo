use starknet::ContractAddress;

// contract address owning an entity
#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Owner {
    #[key]
    entity_id: u128,
    address: ContractAddress,
}
