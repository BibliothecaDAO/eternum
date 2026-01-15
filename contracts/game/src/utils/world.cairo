use dojo::world::IWorldDispatcher;
use crate::constants::DEFAULT_NS;

#[generate_trait]
pub impl CustomDojoWorldImpl of CustomDojoWorldTrait {
    fn custom_world_same_namespace(custom_w_address: starknet::ContractAddress) -> dojo::world::storage::WorldStorage {                
        let custom_w_dispatcher = IWorldDispatcher{contract_address: custom_w_address};
        dojo::world::WorldStorageTrait::new(custom_w_dispatcher, DEFAULT_NS())
    }
}