use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct DepositSource {
    pub chain: felt252,
    pub ledger: ContractAddress,
    pub signer: felt252,
    pub epoch: u64,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct LordsDeposit {
    pub id: u64,
    pub account: ContractAddress,
    pub realms_id: felt252,
    pub home: u64,
    pub payer: ContractAddress,
    pub amount: u128,
    pub paid_at: u64,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SpendLords {
    pub available: u128,
    pub consumed: u128,
    pub swept: u128,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct DepositReceipt {
    pub commitment: felt252,
    pub account: ContractAddress,
    pub amount: u128,
    pub cancelled: bool,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct PrincipalWithdrawal {
    pub amount: u128,
}

pub fn deposit_hash(
    source: DepositSource, shard: felt252, games: ContractAddress, game_id: u32, deposit: LordsDeposit,
) -> felt252 {
    core::poseidon::poseidon_hash_span(
        array![
            'LORDS_DEPOSIT_V1', source.chain, source.ledger.into(), shard, games.into(), game_id.into(),
            deposit.id.into(), deposit.account.into(), deposit.realms_id, deposit.home.into(), deposit.payer.into(),
            deposit.amount.into(), deposit.paid_at.into(),
        ]
            .span(),
    )
}

pub fn authorization_hash(commitment: felt252, epoch: u64, cancel: bool) -> felt252 {
    core::poseidon::poseidon_hash_span(
        array!['LORDS_DELIVER_V1', commitment, epoch.into(), if cancel {
            1
        } else {
            0
        }].span(),
    )
}

#[starknet::interface]
pub trait ISpendDepositedLords<T> {
    fn spend_deposited_lords(ref self: T, game_id: u32, account: ContractAddress, amount: u128) -> u128;
}
