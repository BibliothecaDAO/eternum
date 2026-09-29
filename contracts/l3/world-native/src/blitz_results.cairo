use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct PlayerResult {
    pub player: ContractAddress,
    pub points: u128,
    pub rank: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BlitzResult {
    pub players: Span<PlayerResult>,
    pub complete: bool,
    pub commitment: felt252,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RecordBlitzResults {
    pub start: u8,
    pub players: Span<PlayerResult>,
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
        story_cursor: crate::ownership::StoryCursor,
    ) -> (u64, crate::ownership::StoryCursor);
}

pub fn result_commitment(game_id: u32, players: Span<PlayerResult>) -> felt252 {
    let mut values = array!['ETERNUM_BLITZ_RESULT', 1, game_id.into()];
    players.serialize(ref values);
    core::poseidon::poseidon_hash_span(values.span())
}
