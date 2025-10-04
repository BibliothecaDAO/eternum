// Note: dont include burn as that would affect the total supply check in `obtain_entry_token` function
#[starknet::interface]
pub trait ICollectible<T> {
    fn mint(ref self: T, recipient: starknet::ContractAddress, attributes_raw: u128);
    fn lock_state_update(ref self: T, lock_id: felt252, unlock_at: u64);
    fn set_attrs_raw_to_ipfs_cid(ref self: T, attrs_raw: u128, ipfs_cid: ByteArray, overwrite: bool);

    fn get_metadata_raw(self: @T, token_id: u256) -> u128;
    fn token_lock_state(self: @T, token_id: u256) -> (felt252, felt252);
    fn token_lock(ref self: T, token_id: u256, lock_id: felt252);
    fn total_supply(self: @T) -> u256;

    // ERC721
    fn owner_of(self: @T, token_id: u256) -> starknet::ContractAddress;
}


#[starknet::interface]
pub trait ICollectibleTimeLockManager<T> {
    fn create_lock(ref self: T, collection: starknet::ContractAddress, lock_end_time: u64);
}