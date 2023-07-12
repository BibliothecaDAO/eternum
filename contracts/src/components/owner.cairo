use starknet::ContractAddress;

// contract address owning an entity
#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Owner {
    address: ContractAddress, 
}
