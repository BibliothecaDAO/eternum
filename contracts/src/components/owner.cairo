#[derive(Component, Copy, Drop, Serde)]
struct Owner {
    address: starknet::ContractAddress, 
}
