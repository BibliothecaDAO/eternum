use starknet::ContractAddress;

// contract address owning an entity
#[derive(Component, Copy, Drop, Serde)]
struct Owner {
    address: ContractAddress, 
}
