use starknet::ContractAddress;

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct Liquidity {
    #[key]
    pub player: ContractAddress,
    #[key]
    pub resource_type: u8,
    pub shares: u128,
}
