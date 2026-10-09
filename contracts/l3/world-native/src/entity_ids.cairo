use core::num::traits::Zero;
use starknet::ContractAddress;
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePathEntry};

pub type EntityId = u64;
const LOCAL_RANGE: u64 = 0x100000000;
const FIELD_RANGE: u64 = 0x100;

// Administrative ids occupy namespace zero. Each home owns a disjoint namespace, including after ownership changes.
pub fn namespace(home: EntityId) -> u32 {
    assert!(home != 0, "zero allocation home");
    let namespace = if home < LOCAL_RANGE { home } else { home / LOCAL_RANGE };
    namespace.try_into().unwrap()
}

pub fn allocate_home(game_id: u32, home: EntityId) -> EntityId {
    let home = namespace(home);
    let state = crate::state::write();
    let previous = state.games.home_entities.read((game_id, home));
    assert!(previous != 0xffffffff, "home entity space exhausted");
    let next = previous + 1;
    state.games.home_entities.write((game_id, home), next);
    Into::<u32, u64>::into(home) * LOCAL_RANGE + next.into()
}

// Reserve once at registration or launch. The first id, count and consumed count fit one private storage word.
pub fn reserve_homes(game_id: u32, owner: ContractAddress) {
    assert!(crate::logic::game::game_exists(game_id), "prepare an existing game");
    assert!(owner.is_non_zero(), "zero home owner");
    let state = crate::state::write();
    if state.games.home_reservations.read((game_id, owner)) != 0 { return; }
    let count: u8 = match crate::logic::settlement::rules(game_id).mode {
        crate::settlement::SettlementMode::Triple => 3,
        _ => 1,
    };
    let mut first = 0_u32;
    for index in 0..count {
        let id = crate::logic::game::allocate_setup_entity(game_id);
        if index == 0 { first = id; }
    }
    let reservation = Into::<u32, u64>::into(first) + Into::<u8, u64>::into(count) * LOCAL_RANGE;
    state.games.home_reservations.write((game_id, owner), reservation);
}

pub fn claim_home(game_id: u32, owner: ContractAddress) -> EntityId {
    let state = crate::state::write();
    let reservation = state.games.home_reservations.read((game_id, owner));
    let first = reservation % LOCAL_RANGE;
    let count = reservation / LOCAL_RANGE % FIELD_RANGE;
    let used = reservation / LOCAL_RANGE / FIELD_RANGE;
    assert!(first != 0 && used < count, "home ids must be prepared");
    state.games.home_reservations.write((game_id, owner), reservation + LOCAL_RANGE * FIELD_RANGE);
    first + used
}

pub fn home_for_actor(game_id: u32, actor: ContractAddress) -> EntityId {
    let reservation = crate::state::read().games.home_reservations.read((game_id, actor));
    let first = reservation % LOCAL_RANGE;
    let count = reservation / LOCAL_RANGE % FIELD_RANGE;
    for index in 0..count {
        let home = first + index;
        let key = crate::resources::ResourceKey { game_id, entity_id: home };
        if crate::logic::structures::structure(key).map(|structure| structure.owner == actor).unwrap_or(false) {
            return home;
        }
    }
    panic!("actor has no prepared home")
}

pub fn allocation_home(key: crate::resources::ResourceKey) -> EntityId {
    let home = crate::state::read().troops.explorers.entry((key.game_id, key.entity_id)).owner.read();
    if home != 0 { home } else { key.entity_id }
}
