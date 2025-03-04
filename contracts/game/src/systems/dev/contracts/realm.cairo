use starknet::ContractAddress;

#[starknet::interface]
trait ITestRealmMint<T> {
    fn mint(ref self: T, token_id: u256);
}

#[starknet::interface]
trait ILordsMint<T> {
    fn mint(ref self: T, token_id: u256);
}

#[starknet::interface]
trait ISeasonPassMint<T> {
    fn mint(ref self: T, recipient: ContractAddress, token_id: u256);
}

#[starknet::interface]
trait IERC721Approval<T> {
    fn approve(ref self: T, to: ContractAddress, token_id: u256);
}
