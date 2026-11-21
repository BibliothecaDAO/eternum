pub use world_test_support::tests::production::*;

#[test]
#[fuzzer(runs: 64)]
fn building_packing_preserves_structure_pause_and_full_width_population(
    category: u8, paused: bool, current: u32, maximum: u32, labor_paid: u128,
) {
    let building = crate::buildings::Building { category, paused, labor_paid };
    assert_eq!(crate::buildings::BuildingPacking::unpack(crate::buildings::BuildingPacking::pack(building)), building);
    let population = crate::buildings::Population { current, max: maximum };
    assert_eq!(
        crate::buildings::PopulationPacking::unpack(crate::buildings::PopulationPacking::pack(population)), population,
    );
}

