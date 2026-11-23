use core::num::traits::Zero;
use starknet::ContractAddress;
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::resources::ResourceKey;
use crate::troops::TroopType;

pub fn record(game_id: u32, players: Span<ContractAddress>) {
    assert!(crate::logic::game::game_exists(game_id), "game does not exist");
    assert!(crate::logic::game::game(game_id).family == crate::game::BLITZ, "not a Blitz game");
    assert!(!players.is_empty(), "empty roster");
    let state = crate::state::write();
    assert!(state.roster.sizes.read(game_id) == 0, "roster already recorded");
    let mut seen: core::dict::Felt252Dict<u8> = Default::default();
    for index in 0..players.len() {
        let player = *players.at(index);
        assert!(player.is_non_zero(), "zero roster player");
        assert!(seen.get(player.into()) == 0, "duplicate roster player");
        seen.insert(player.into(), 1);
        state.roster.players.write((game_id, index), player);
    }
    state.roster.sizes.write(game_id, players.len());
}

pub fn size(game_id: u32) -> u32 {
    crate::state::read().roster.sizes.read(game_id)
}

pub fn seating(game_id: u32) -> bool {
    crate::state::read().settlements.progress.read(game_id).registered.into() < size(game_id)
}

pub fn draw_player(game_id: u32, seat: u32, seed: u256) -> ContractAddress {
    let state = crate::state::write();
    let remaining = size(game_id) - seat;
    let pick = seat + crate::random::range(seed, 98139, remaining.into()).try_into().unwrap();
    let player = state.roster.players.read((game_id, pick));
    state.roster.players.write((game_id, pick), state.roster.players.read((game_id, seat)));
    state.roster.players.write((game_id, seat), player);
    player
}

pub fn deal(seed: u256) -> Span<TroopType> {
    *array![
        array![TroopType::Knight, TroopType::Crossbowman, TroopType::Paladin].span(),
        array![TroopType::Knight, TroopType::Paladin, TroopType::Crossbowman].span(),
        array![TroopType::Crossbowman, TroopType::Knight, TroopType::Paladin].span(),
        array![TroopType::Crossbowman, TroopType::Paladin, TroopType::Knight].span(),
        array![TroopType::Paladin, TroopType::Knight, TroopType::Crossbowman].span(),
        array![TroopType::Paladin, TroopType::Crossbowman, TroopType::Knight].span(),
    ]
        .at(crate::random::range(seed, 51071, 6).try_into().unwrap())
}

pub fn write_dealt(realm: ResourceKey, troop: TroopType) {
    let code: u8 = troop.into();
    crate::state::write().roster.dealt_troops.write((realm.game_id, realm.entity_id), code + 1);
}

pub fn dealt(key: ResourceKey) -> TroopType {
    let record = crate::logic::structures::record(key);
    let realm = if record.base.category == crate::taxonomy::VILLAGE_CATEGORY {
        record.metadata.village_realm
    } else {
        key.entity_id
    };
    match crate::state::read().roster.dealt_troops.read((key.game_id, realm)) {
        0 => panic!("no troop type was dealt to this realm"),
        1 => TroopType::Knight,
        2 => TroopType::Paladin,
        _ => TroopType::Crossbowman,
    }
}
