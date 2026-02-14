use starknet::{ClassHash, ContractAddress};


#[dojo::model]
pub struct Series {
    #[key]
    pub name: felt252,
    pub owner: ContractAddress,
    pub game_count: u16,
}

#[dojo::model]
pub struct SeriesContract {
    #[key]
    pub name: felt252,
    #[key]
    pub game_number: u16,
    #[key]
    pub contract_class_hash: ClassHash,
    pub contract_address: ContractAddress,
}

#[dojo::model]
pub struct SeriesContractBySelector {
    #[key]
    pub name: felt252,
    #[key]
    pub game_number: u16,
    #[key]
    pub contract_selector: felt252,
    pub contract_address: ContractAddress,
}


#[dojo::model]
pub struct SeriesGame {
    #[key]
    pub contract_address: ContractAddress,
    pub name: felt252,
    pub game_number: u16,
}
