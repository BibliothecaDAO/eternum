use starknet::ContractAddress;

pub const LORDS_UNIT: u256 = 1_000_000_000_000_000_000;

#[derive(Copy, Drop, Serde, PartialEq, Debug, starknet::Store)]
pub struct LordsDeposit {
    pub game_id: u32,
    pub games: ContractAddress,
    pub account: ContractAddress,
    pub realms_id: felt252,
    pub home: u64,
    pub payer: ContractAddress,
    pub amount: u128,
    pub paid_at: u64,
    // Pending, delivered, cancelled.
    pub status: u8,
}

pub fn commitment(chain: felt252, ledger: ContractAddress, shard: felt252, id: u64, value: LordsDeposit) -> felt252 {
    core::poseidon::poseidon_hash_span(
        array![
            'LORDS_DEPOSIT_V1', chain, ledger.into(), shard, value.games.into(), value.game_id.into(), id.into(),
            value.account.into(), value.realms_id, value.home.into(), value.payer.into(), value.amount.into(),
            value.paid_at.into(),
        ]
            .span(),
    )
}

pub fn resolution_hash(
    chain: felt252, ledger: ContractAddress, epoch: u64, receipt: felt252, cancelled: bool,
) -> felt252 {
    core::poseidon::poseidon_hash_span(
        array!['LORDS_RESOLVE_V1', chain, ledger.into(), epoch.into(), receipt, if cancelled {
            1
        } else {
            0
        }].span(),
    )
}

#[starknet::interface]
pub trait IDeposits<T> {
    fn enable_deposits(ref self: T, shard: felt252, game_id: u32, games: ContractAddress);
    fn deposit_target(self: @T, shard: felt252, game_id: u32) -> ContractAddress;
    fn deposit_target_count(self: @T) -> u64;
    fn deposit_target_at(self: @T, index: u64) -> (felt252, u32);
    fn deposit_count(self: @T, shard: felt252) -> u64;
    fn get_deposit(self: @T, shard: felt252, id: u64) -> LordsDeposit;
    fn deposit_principal(self: @T) -> (u256, u256, u256);
    fn principal_payment(
        self: @T, shard: felt252, game_id: u32, account: ContractAddress,
    ) -> Option<(ContractAddress, u128)>;
    fn pay_principal(
        ref self: T,
        shard: felt252,
        game_id: u32,
        account: ContractAddress,
        wallet: ContractAddress,
        amount: u128,
        r: felt252,
        s: felt252,
    );
    fn deposit_lords(
        ref self: T,
        shard: felt252,
        game_id: u32,
        account: ContractAddress,
        realms_id: felt252,
        home: u64,
        amount: u128,
        request: felt252,
    ) -> u64;
    fn resolve_deposit(ref self: T, shard: felt252, id: u64, cancelled: bool, r: felt252, s: felt252);
}

pub fn principal_hash(
    chain: felt252,
    ledger: ContractAddress,
    epoch: u64,
    shard: felt252,
    games: ContractAddress,
    game_id: u32,
    account: ContractAddress,
    wallet: ContractAddress,
    amount: u128,
) -> felt252 {
    core::poseidon::poseidon_hash_span(
        array![
            'LORDS_PRINCIPAL_V1', chain, ledger.into(), epoch.into(), shard, games.into(), game_id.into(),
            account.into(), wallet.into(), amount.into(),
        ]
            .span(),
    )
}
