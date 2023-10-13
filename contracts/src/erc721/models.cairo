use starknet::ContractAddress;

#[derive(Model, Copy, Drop, Serde)]
struct TokenApproval {
    address: ContractAddress
}

#[derive(Model, Copy, Drop, Serde)]
struct Balance {
    value: u128
}
