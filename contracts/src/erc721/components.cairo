use starknet::ContractAddress;

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct TokenApproval {
    address: ContractAddress
}

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Balance {
    value: u128
}
