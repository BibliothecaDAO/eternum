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

#[test]
fn production_payment_failure_rolls_back_prior_debits() {
    let (deployment, key, _) = setup();
    grant(deployment, key, 2, 100);
    let before = resource_facts(deployment, key);
    let command = Command::BurnResourceForResourceProduction(
        RefillProduction { structure_id: key.entity_id, resource_types: array![26].span(), amounts: array![1].span() },
    );
    assert_terminal_rejection(deployment, command, 60);
    assert_eq!(resource_facts(deployment, key), before);
}

#[test]
fn malformed_refills_and_out_of_game_actions_reject_without_spending() {
    let (deployment, home, _) = setup();
    grant(deployment, home, 2, 100);
    grant(deployment, home, 3, 100);
    let valid = RefillProduction {
        structure_id: home.entity_id, resource_types: array![26].span(), amounts: array![1].span(),
    };
    let before = resource_facts(deployment, home);
    for command in array![Command::BurnResourceForResourceProduction(valid)] {
        assert_terminal_rejection(deployment, command, 19);
    }
    for malformed in array![
        RefillProduction { amounts: array![].span(), ..valid }, RefillProduction { amounts: array![0].span(), ..valid },
        RefillProduction { resource_types: array![0].span(), ..valid },
        RefillProduction { resource_types: array![59].span(), ..valid },
        RefillProduction { structure_id: 999, ..valid },
    ] {
        for command in array![Command::BurnResourceForResourceProduction(malformed)] {
            assert_terminal_rejection(deployment, command, 60);
        }
        assert_eq!(resource_facts(deployment, home), before);
    }
    assert_terminal_rejection(deployment, Command::BurnResourceForResourceProduction(valid), 201);
    assert_eq!(resource_facts(deployment, home), before);
}

