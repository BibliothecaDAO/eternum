use starknet::ContractAddress;

#[derive(Component, Copy, Drop, Serde)]
struct TokenApproval {
    address: ContractAddress
}

#[derive(Component, Copy, Drop, Serde)]
struct Balance {
    value: u128
}

#[derive(Component, Copy, Drop, Serde)]
struct Owner {
    address: ContractAddress
}
