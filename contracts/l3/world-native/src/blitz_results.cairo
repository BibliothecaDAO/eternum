use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct RankedPlayer {
    pub wallet: ContractAddress,
    pub rank: u16,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BlitzResult {
    pub players: Span<RankedPlayer>,
    pub complete: bool,
    pub commitment: felt252,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RecordBlitzResults {
    pub start: u8,
    pub players: Span<RankedPlayer>,
}

#[starknet::interface]
pub trait IBlitzResults<T> {
    fn blitz_result(self: @T, game_id: u32) -> BlitzResult;
    fn record_blitz_results(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: RecordBlitzResults,
        context: crate::commands::ActionContext,
    ) -> u64;
}

// The ledger's version-3 preimage uses frozen L2 wallets and has no nested hashes.
pub fn result_commitment(shard_chain_id: felt252, game_id: u32, players: Span<RankedPlayer>) -> felt252 {
    let mut values = array!['ETERNUM_BLITZ_RESULT', 3, shard_chain_id, game_id.into(), players.len().into()];
    for row in players {
        values.append((*row.wallet).into());
        values.append((*row.rank).into());
    }
    core::poseidon::poseidon_hash_span(values.span())
}
