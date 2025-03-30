use starknet::ContractAddress;

#[derive(Drop, Serde)]
#[dojo::model]
pub struct Message {
    #[key]
    pub identity: ContractAddress,
    #[key]
    pub channel: felt252,
    #[key]
    pub salt: felt252,
    pub content: ByteArray,
    pub timestamp: u64,
}
