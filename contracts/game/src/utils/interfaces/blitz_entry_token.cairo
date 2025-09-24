// Note: dont include burn as that would affect the total supply check in `obtain_entry_token` function
#[starknet::interface]
pub trait IBlitzEntryToken<T> {
    fn mint(ref self: T, recipient: starknet::ContractAddress, attributes_raw: u128);
    fn lock_state_update(ref self: T, lock_id: felt252, unlock_at: u64);
    fn set_attrs_raw_to_ipfs_cid(ref self: T, attrs_raw: u128, ipfs_cid: ByteArray, overwrite: bool);


    fn token_lock_state(self: @T, token_id: u256) -> (felt252, felt252);
    fn total_supply(self: @T) -> u256;
}