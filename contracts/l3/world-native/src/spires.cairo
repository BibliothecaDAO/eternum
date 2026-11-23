use crate::rules::SPIRE_REVEAL_LIMIT;
use crate::troops::Coord;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ExpeditionSpireKey {
    pub game_id: u32,
    pub structure_id: u64,
    pub epoch: u64,
    pub depth: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ExpeditionSpire {
    pub reveals: u8,
    pub location: Option<Coord>,
}

pub fn discover(previous: ExpeditionSpire, coord: Coord, seed: u256) -> ExpeditionSpire {
    if previous.location.is_some() {
        return previous;
    }
    let reveals = previous.reveals + 1;
    assert!(reveals <= SPIRE_REVEAL_LIMIT, "spire discovery exhausted");
    let chance: u128 = Into::<u8, u128>::into(reveals) * 10000 / SPIRE_REVEAL_LIMIT.into();
    let found = crate::random::range(seed, 0x5350495245, 10000) < chance;
    ExpeditionSpire { reveals, location: if found {
        Some(coord)
    } else {
        None
    } }
}

