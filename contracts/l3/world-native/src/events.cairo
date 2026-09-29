#[derive(Drop, starknet::Event)]
pub struct RowSet {
    #[key]
    pub version: u8,
    #[key]
    pub model: felt252,
    pub keys: Span<felt252>,
    pub values: Span<felt252>,
}

#[derive(Drop, starknet::Event)]
pub struct RowMemberSet {
    #[key]
    pub version: u8,
    #[key]
    pub model: felt252,
    #[key]
    pub member: felt252,
    pub keys: Span<felt252>,
    pub values: Span<felt252>,
}

#[derive(Drop, starknet::Event)]
pub struct RowDeleted {
    #[key]
    pub version: u8,
    #[key]
    pub model: felt252,
    pub keys: Span<felt252>,
}
