use starknet;
use crate::utils::interfaces::collectibles::ICollectible;


#[starknet::contract]
pub mod CollectibleMock {
    use starknet::ContractAddress;
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use super::ICollectible;

    #[storage]
    struct Storage {
        owners: Map<u256, ContractAddress>,
        balances: Map<ContractAddress, u256>,
        owner_tokens: Map<(ContractAddress, u256), u256>,
        attributes: Map<u256, u128>,
        lock_ids: Map<u256, felt252>,
        supply: u256,
    }

    #[abi(embed_v0)]
    impl CollectibleImpl of ICollectible<ContractState> {
        fn balance_of(self: @ContractState, owner: ContractAddress) -> u256 {
            self.balances.entry(owner).read()
        }

        fn mint(ref self: ContractState, recipient: ContractAddress, attributes_raw: u128) {
            mint_token(ref self, recipient, attributes_raw);
        }

        fn mint_many(ref self: ContractState, recipient: ContractAddress, attributes_and_counts: Span<(u128, u16)>) {
            for entry in attributes_and_counts {
                let (attributes_raw, count) = *entry;
                let mut minted: u16 = 0;
                while minted < count {
                    mint_token(ref self, recipient, attributes_raw);
                    minted += 1;
                }
            }
        }

        fn lock_state_update(ref self: ContractState, lock_id: felt252, unlock_at: u64) {
            let _ = (lock_id, unlock_at);
        }

        fn set_attrs_raw_to_ipfs_cid(ref self: ContractState, attrs_raw: u128, ipfs_cid: ByteArray, overwrite: bool) {
            let _ = (attrs_raw, ipfs_cid, overwrite);
        }

        fn get_metadata_raw(self: @ContractState, token_id: u256) -> u128 {
            self.attributes.entry(token_id).read()
        }

        fn token_lock_state(self: @ContractState, token_id: u256) -> (felt252, felt252) {
            (self.lock_ids.entry(token_id).read(), 0)
        }

        fn token_lock(ref self: ContractState, token_id: u256, lock_id: felt252) {
            self.lock_ids.entry(token_id).write(lock_id);
        }

        fn total_supply(self: @ContractState) -> u256 {
            self.supply.read()
        }

        fn owner_of(self: @ContractState, token_id: u256) -> ContractAddress {
            self.owners.entry(token_id).read()
        }

        fn token_of_owner_by_index(self: @ContractState, owner: ContractAddress, index: u256) -> u256 {
            self.owner_tokens.entry((owner, index)).read()
        }
    }

    fn mint_token(ref self: ContractState, recipient: ContractAddress, attributes_raw: u128) {
        let token_id = self.supply.read() + 1;
        let owner_balance = self.balances.entry(recipient).read();
        self.supply.write(token_id);
        self.owners.entry(token_id).write(recipient);
        self.attributes.entry(token_id).write(attributes_raw);
        self.owner_tokens.entry((recipient, owner_balance)).write(token_id);
        self.balances.entry(recipient).write(owner_balance + 1);
    }
}
