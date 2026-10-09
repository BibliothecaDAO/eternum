use snforge_std::interact_with_state;
use crate::entity_ids::{allocate_home, claim_home, namespace, reserve_homes};

#[test]
fn home_counters_are_independent_and_game_scoped() {
    let d = super::setup(true);
    interact_with_state(
        d.games,
        || {
            let first = allocate_home(1, 7);
            let second = allocate_home(1, 19);
            assert_eq!(first, 0x700000001);
            assert_eq!(second, 0x1300000001);
            assert_eq!(allocate_home(1, 7), first + 1);
            assert_eq!(allocate_home(1, 19), second + 1);
            assert_eq!(allocate_home(2, 7), first);
            assert!(first > 0xffffffff && second > 0xffffffff);
        },
    );
}

#[test]
fn high_home_ids_preserve_their_namespace_and_never_overlap_other_homes() {
    let d = super::setup(true);
    interact_with_state(
        d.games,
        || {
            let home = 0x12345678000000ab;
            assert_eq!(namespace(home), 0x12345678);
            assert_eq!(allocate_home(1, home), 0x1234567800000001);
            assert_eq!(allocate_home(1, 0x12345678), 0x1234567800000002);
            assert_eq!(allocate_home(1, 0x12345679000000ab), 0x1234567900000001);
        },
    );
}

#[test]
fn reservations_are_idempotent_and_triple_homes_are_consumed_per_owner() {
    let d = super::setup(true);
    let game = crate::game::IGameDispatcherTrait::game(crate::game::IGameDispatcher { contract_address: d.games }, 1);
    let mut preset = super::play_fixture::fixture_preset(super::play_fixture::rules());
    preset.settlement.mode = crate::settlement::SettlementMode::Triple;
    super::play_fixture::seed_game_with_preset(d.games, 1, game, preset);
    let other = super::authority();
    interact_with_state(
        d.games,
        || {
            reserve_homes(1, d.actor);
            reserve_homes(1, d.actor);
            reserve_homes(1, other);
            assert_eq!(claim_home(1, d.actor), 1);
            assert_eq!(claim_home(1, other), 4);
            assert_eq!(claim_home(1, d.actor), 2);
            assert_eq!(claim_home(1, other), 5);
            assert_eq!(claim_home(1, d.actor), 3);
            assert_eq!(claim_home(1, other), 6);
            assert_eq!(allocate_home(1, 1), 0x100000001);
            assert_eq!(allocate_home(1, 4), 0x400000001);
        },
    );
}

#[test]
fn occupancy_round_trips_full_width_ids_without_changing_terrain() {
    for entity_id in array![0_u64, 1, 0x100000001, 0x12345678abcdef01, 0xffffffffffffffff] {
        for category in array![1_u8, 15, 35, 255] {
            for is_structure in array![false, true] {
                let occupancy = crate::map::TileOccupancy { entity_id, category, is_structure };
                assert_eq!(crate::map::occupancy_from_bits(crate::map::occupancy_bits(occupancy)), Some(occupancy));
            }
        }
    }
}

#[test]
fn canonical_occupancy_preserves_the_one_felt_terrain_view() {
    use crate::tests::state::MapObservationTrait;
    for is_structure in array![false, true] {
        let d = super::setup(true);
        let map = crate::map::IMapLogicDispatcher { contract_address: d.games };
        let key = crate::map::TileKey { game_id: 1, alt: false, col: 123, row: 456 };
        map.reveal(key, 11);
        let terrain = map.tile(key).unwrap();
        let mut encoded = array![];
        terrain.serialize(ref encoded);
        assert_eq!(encoded.span(), array![terrain.data.into()].span());
        map.occupy(key, 0x12345678abcdef01, 255, is_structure);
        assert_eq!(map.tile(key), Some(terrain));
        assert_eq!(
            map.occupancy(key),
            Some(crate::map::TileOccupancy { entity_id: 0x12345678abcdef01, category: 255, is_structure }),
        );
        assert_eq!(map.structure_occupant(key), if is_structure {
            Some(0x12345678abcdef01)
        } else {
            None
        });
        if !is_structure {
            map.vacate(key, 0x12345678abcdef01);
            assert!(map.occupancy(key).is_none());
            assert_eq!(map.tile(key), Some(terrain));
        }
    }
}

#[test]
fn story_v2_wire_has_entity_keys_and_no_contract_order_fields() {
    let owner: starknet::ContractAddress = 123.try_into().unwrap();
    let event = crate::ownership::StoryEvent {
        version: 2,
        game_id: 3,
        owner: Some(owner),
        entity_id: Some(0x100000001),
        tx_hash: 456,
        story: crate::ownership::Story::RealmCreatedStory(
            crate::ownership::RealmCreatedStory { coord: crate::troops::Coord { alt: false, x: 12, y: 34 } },
        ),
        timestamp: 50,
    };
    let mut keys = array![];
    let mut data = array![];
    starknet::Event::append_keys_and_data(@event, ref keys, ref data);
    assert_eq!(keys.span(), array![2, 3, 0, owner.into(), 0, 0x100000001, 456].span());
    assert_eq!(data.span(), array![2, 0, 12, 34, 50].span());
}

#[test]
fn two_thousand_open_homes_need_no_preparation_or_shared_counter() {
    use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
    use core::dict::{Felt252Dict, Felt252DictTrait};
    let d = super::setup(true);
    interact_with_state(
        d.games,
        || {
            let before = crate::state::read().games.next_entity.read(1);
            let mut seen: Felt252Dict<bool> = Default::default();
            for index in 1_u32..2001 {
                let actor: starknet::ContractAddress = Into::<u32, felt252>::into(index).try_into().unwrap();
                let home = crate::entity_ids::assign_open_home(1, actor);
                assert!(!seen.get(home.into()), "duplicate open home");
                seen.insert(home.into(), true);
                assert_eq!(crate::entity_ids::assign_open_home(1, actor), home);
                assert_eq!(claim_home(1, actor), home);
                assert_eq!(allocate_home(1, home), home + 1);
                assert_eq!(crate::state::read().games.home_reservations.read((1, actor)), 0);
            }
            assert_eq!(crate::state::read().games.next_entity.read(1), before);
        },
    );
}

#[test]
fn colliding_open_namespace_is_probed_without_overwriting_its_owner() {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    let d = super::setup(true);
    interact_with_state(
        d.games,
        || {
            let actor: starknet::ContractAddress = 123.try_into().unwrap();
            let other: starknet::ContractAddress = 456.try_into().unwrap();
            let home = crate::entity_ids::assign_open_home(1, actor);
            let original = namespace(home);
            // Reconstruct the first claimant's first-action state with that slot already owned by another account.
            crate::state::write().games.open_homes.write((1, actor), 0);
            crate::state::write().games.namespace_owners.write((1, original), other);
            let assigned = crate::entity_ids::assign_open_home(1, actor);
            assert_ne!(assigned, home);
            assert_eq!(crate::state::read().games.namespace_owners.read((1, original)), other);
            assert_eq!(crate::state::read().games.namespace_owners.read((1, namespace(assigned))), actor);
        },
    );
}
