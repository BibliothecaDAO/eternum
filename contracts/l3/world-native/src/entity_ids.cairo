use core::num::traits::Zero;
use starknet::ContractAddress;
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};

pub type EntityId = u64;
// Keep allocated ids exact in the client's numeric APIs while retaining the u64 wire/storage layout.
pub const MAX_HOME_NAMESPACE: u32 = 0x1fffff;
const LOCAL_RANGE: u64 = 0x100000000;
const FIELD_RANGE: u64 = 0x100;

// Administrative ids occupy namespace zero. Each home owns a disjoint namespace, including after ownership changes.
pub fn namespace(home: EntityId) -> u32 {
    assert!(home != 0, "zero allocation home");
    let namespace = if home < LOCAL_RANGE {
        home
    } else {
        home / LOCAL_RANGE
    };
    namespace.try_into().unwrap()
}

pub fn allocate_home(game_id: u32, home: EntityId) -> EntityId {
    let home = namespace(home);
    assert!(home <= MAX_HOME_NAMESPACE, "home namespace exceeds safe entity ids");
    let state = crate::state::write();
    let previous = state.games.home_entities.read((game_id, home));
    assert!(previous != 0xffffffff, "home entity space exhausted");
    let next = previous + 1;
    state.games.home_entities.write((game_id, home), next);
    Into::<u32, u64>::into(home) * LOCAL_RANGE + next.into()
}

// The open game assigns a private block before the roll. Collision probing touches no shared allocator or count.
pub fn assign_open_home(game_id: u32, owner: ContractAddress) -> EntityId {
    let state = crate::state::write();
    let previous = state.games.open_homes.read((game_id, owner));
    if previous != 0 {
        return previous;
    }
    let digest: u256 = core::poseidon::poseidon_hash_span(array![game_id.into(), owner.into()].span()).into();
    let spacing = crate::logic::settlement::spacing();
    let regions = core::cmp::min(0x7fffffff_u32 / spacing, MAX_HOME_NAMESPACE);
    assert!(regions != 0, "no expedition home regions");
    let first: u32 = (digest % regions.into()).try_into().unwrap();
    for probe in 0_u32..64 {
        let namespace = 1 + (Into::<u32, u64>::into(first) + probe.into()) % Into::<u32, u64>::into(regions);
        let namespace: u32 = namespace.try_into().unwrap();
        if state.games.namespace_owners.read((game_id, namespace)).is_zero() {
            let home = Into::<u32, u64>::into(namespace) * LOCAL_RANGE + 1;
            state.games.namespace_owners.write((game_id, namespace), owner);
            state.games.open_homes.write((game_id, owner), home);
            state.games.home_entities.write((game_id, namespace), 1);
            return home;
        }
    }
    panic!("home namespace collision space exhausted")
}

pub fn claim_home(game_id: u32, owner: ContractAddress) -> EntityId {
    let assigned = crate::state::read().games.open_homes.read((game_id, owner));
    assert!(assigned != 0, "home ids must be prepared");
    assigned
}

pub fn home_for_actor(game_id: u32, actor: ContractAddress) -> EntityId {
    let home = crate::state::read().games.open_homes.read((game_id, actor));
    assert!(
        home != 0
            && crate::logic::structures::structure(crate::resources::ResourceKey { game_id, entity_id: home })
                .map(|record| record.owner == actor)
                .unwrap_or(false),
        "actor has no prepared home",
    );
    home
}

pub fn allocation_home(key: crate::resources::ResourceKey) -> EntityId {
    let home = crate::state::read().troops.explorers.entry((key.game_id, key.entity_id)).owner.read();
    if home != 0 {
        home
    } else {
        key.entity_id
    }
}
