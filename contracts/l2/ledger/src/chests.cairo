use core::poseidon::poseidon_hash_span;
use game_ledger::mmr::percentile_position;
use game_ledger::types::ChestOdds;

pub fn rank_band(rank: u16, tie_count: u16, player_count: u16) -> u8 {
    let (position, total) = percentile_position(rank, tie_count, player_count);
    let band = position * 5 / total;
    if band >= 5 {
        4
    } else {
        band.try_into().unwrap()
    }
}

pub fn outcome_weights(odds: ChestOdds) -> Array<u16> {
    array![odds.common, odds.uncommon, odds.rare, odds.epic, odds.legendary, odds.lords, odds.sword, odds.shield]
}

pub fn draw_outcome(odds: ChestOdds, block_hash: felt252, token_id: u256, season_id: u32) -> u8 {
    let seed: u256 = poseidon_hash_span(
        array!['ETERNUM_CHEST_DRAW', block_hash, token_id.low.into(), token_id.high.into(), season_id.into()].span(),
    )
        .into();
    let mut roll: u16 = (seed % 10000).try_into().unwrap();
    let weights = outcome_weights(odds);
    for index in 0_u32..8 {
        let weight = *weights.at(index);
        if roll < weight {
            return index.try_into().unwrap();
        }
        roll -= weight;
    }
    panic!("Ledger: invalid chest odds")
}

pub fn draw_item_index(block_hash: felt252, token_id: u256, season_id: u32, count: u32) -> u32 {
    let seed: u256 = poseidon_hash_span(
        array!['ETERNUM_CHEST_ITEM', block_hash, token_id.low.into(), token_id.high.into(), season_id.into()].span(),
    )
        .into();
    (seed % count.into()).try_into().unwrap()
}
