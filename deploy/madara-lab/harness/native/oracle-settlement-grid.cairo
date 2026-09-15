use world_native::settlement::SettlementMode;
use world_native::settlement_grid::{reservation_count, reservation_location, settlement_location, target_pool_size};
use crate::models::config::{BlitzHypersSettlementConfigImpl, BlitzSettlementConfigImpl};
use crate::models::position::Coord;

#[test]
fn world_parity_settlement_geometry() {
    for offset in 0_u32..2 {
        let center = Coord { alt: false, x: 2147483646 - offset, y: 2147483646 - offset };
        let native_center = world_native::troops::Coord { alt: center.alt, x: center.x, y: center.y };
        for profile in 0_u8..3 {
            for single in array![true, false].span() {
                let mode = if *single {
                    SettlementMode::Single
                } else {
                    SettlementMode::Triple
                };
                let mut cursor = BlitzSettlementConfigImpl::new(6, *single, false);
                for candidate in 0_u32..96 {
                    let original = cursor.generate_coords(center, profile);
                    let native = settlement_location(native_center, mode, profile, candidate);
                    assert_coords(original.span(), native);
                    cursor.next();
                }
            }
            let mut cursor = BlitzSettlementConfigImpl::new(6, false, true);
            for candidate in 0_u32..2 {
                assert_coords(
                    cursor.generate_coords(center, profile).span(),
                    settlement_location(native_center, SettlementMode::Duel, profile, candidate),
                );
                cursor.next();
            }
            for mode in array![SettlementMode::Single, SettlementMode::Triple, SettlementMode::Duel].span() {
                for limit in array![0_u16, 1, 2, 3, 6, 7, 15, 24, 25, 54, 55, 96].span() {
                    let duel = *mode == SettlementMode::Duel;
                    let mut cursor = BlitzHypersSettlementConfigImpl::new();
                    cursor
                        .max_ring_count =
                            BlitzHypersSettlementConfigImpl::max_ring_count_for_registration_count(
                                (*limit).into(), duel,
                            );
                    let mut count = 0;
                    while cursor.is_valid_ring(duel) {
                        let original = cursor.next_coord(center, duel, profile);
                        let native = reservation_location(native_center, *mode, profile, count);
                        assert_coords(array![original].span(), array![native].span());
                        count += 1;
                        cursor.next(duel);
                    }
                    assert!(count == reservation_count(*limit, *mode), "reservation completion differs");
                }
            }
        }
    }
}

#[test]
fn world_parity_settlement_pool_windows() {
    for limit in 0_u16..97 {
        for registered in 0_u16..98 {
            for duel in array![false, true].span() {
                let mode = if *duel {
                    SettlementMode::Duel
                } else {
                    SettlementMode::Triple
                };
                let original = crate::constants::blitz_target_open_settlement_count(registered, limit, *duel);
                assert!(original == target_pool_size(registered, limit, mode), "settlement pool window differs");
            }
        }
    }
}

fn assert_coords(original: Span<Coord>, native: Span<world_native::troops::Coord>) {
    let mut original_values = array![];
    let mut native_values = array![];
    original.serialize(ref original_values);
    native.serialize(ref native_values);
    assert!(original_values == native_values, "settlement coordinates differ");
}

#[test]
fn world_parity_starting_troop_table() {
    let grants = crate::native_inputs::realm_grants();
    assert!(
        grants.realm_resources == crate::constants::blitz_produceable_resources().span(),
        "configured realm resources differ from pinned rules",
    );
    assert!(grants.starting_troops.len() == 17);
    for biome in 1_u8..18 {
        let (resource, (category, tier)) = crate::models::troop::TroopsImpl::start_troop_type(biome.into());
        let native = *grants.starting_troops.at((biome - 1).into());
        let mut original = array![];
        category.serialize(ref original);
        let mut actual = array![];
        native.serialize(ref actual);
        assert!(original == actual, "configured starting troops differ from pinned rules");
        assert!(resource == world_native::troops::troop_resource(native, 0));
        assert!(tier == crate::models::troop::TroopTier::T1);
    }
}
