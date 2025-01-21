use starknet::ContractAddress;

#[derive(Drop, Serde)]
#[dojo::model]
pub struct Message {
    #[key]
    pub identity: ContractAddress,
    #[key]
    pub channel: felt252,
    pub content: ByteArray,
    #[key]
    pub salt: felt252,
    pub timestamp: u64,
}
