use starknet::ContractAddress;
use crate::utils::interfaces::collectibles::{
    ICollectibleDispatcher, ICollectibleDispatcherTrait,
    ICollectibleTimeLockManagerDispatcher, ICollectibleTimeLockManagerDispatcherTrait
};


#[generate_trait]
pub impl iCollectiblesImpl of ICollectiblesTrait {
    fn create_lock(
        collection_timelock_admin: ContractAddress,
        collection: ContractAddress,
        lock_id: u64, 
    ) {
        // lock_id == lock_end_time
        let collection_timelock_admin_contract = ICollectibleTimeLockManagerDispatcher{contract_address: collection_timelock_admin};
        collection_timelock_admin_contract.create_lock(collection, lock_id);
    }

    fn ensure_locked_and_retrieve_attrs(
        collection: ContractAddress,
        player: ContractAddress,
        token_ids: Span<u128>, 
        lock_id: felt252, 
        max_tokens: u8 // todo hmm todo
    ) -> Span<u128> {

        assert!(token_ids.len() <= max_tokens.into(), "Eternum: exceeded max allowed tokens");
        
        let collectible_contract = ICollectibleDispatcher{contract_address: collection};
        
        let mut token_attrs = array![];
        for token_id in token_ids {
            let token_id = *token_id;

            // Ensure the token is owned by the player
            let owner = collectible_contract.owner_of(token_id.into());
            assert!(owner == player, "Eternum: player does not own the token");

            // Ensure token is locked with the expected lock_id
            let (retrieved_lock_id, _) = collectible_contract.token_lock_state(token_id.into());
            assert!(retrieved_lock_id != 0, "Eternum: token is not locked");
            assert!(retrieved_lock_id == lock_id, "Eternum: token is not locked with the expected lock_id");

            let attrs = collectible_contract.get_metadata_raw(token_id.into());
            assert!(attrs != 0, "Eternum: token attributes cannot be zero");
            token_attrs.append(attrs);
        }

        return token_attrs.span();
    }
}