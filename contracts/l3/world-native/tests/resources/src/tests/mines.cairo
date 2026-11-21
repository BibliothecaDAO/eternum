pub use world_test_support::tests::mines::*;
use super::play_fixture::FIXTURE_START;
#[test]
fn a_mine_draw_takes_its_kind_from_the_release_surface_pool_and_its_cap_from_that_kind() {
    let deployment = super::setup_with_domains(true, "StructuresLogic", "TroopsLogic");
    let rules = IMineRulesDispatcher { contract_address: deployment.games };
    let pool = crate::balance::resources::SURFACE_MINES.span();
    for root in 0_u64..32 {
        let seed = root.into();
        let (kind, config, amount) = rules.mine_draw(MinePoolKey { game_id: 1 }, seed);
        assert_eq!(kind, select_kind(pool, seed));
        assert_eq!(config, *crate::balance::resources::MINE_KINDS.span().at(kind.into() - 1));
        assert_eq!(config, rules.mine_kind(MineKindKey { game_id: 1, kind }));
        assert_eq!(amount, cap(config, seed));
    }
}

#[test]
fn fragment_cap_is_the_original_ten_step_draw_and_rift_cap_is_fixed() {
    let fragment = *crate::balance::resources::MINE_KINDS.span().at(1);
    let rift = *crate::balance::resources::MINE_KINDS.span().at(0);
    let steps: u128 = fragment.cap_steps.into();
    let mut seen = 0_u16;
    for root in 0_u64..128 {
        let seed = root.into();
        let expected = 1 + crate::random::range(seed, 124, steps);
        let amount = cap(fragment, seed);
        assert_eq!(amount, fragment.cap_min * expected);
        assert!(amount >= fragment.cap_min && amount <= steps * fragment.cap_min);
        let mut bit = 1_u16;
        for _ in 1..expected {
            bit *= 2;
        }
        if seen / bit % 2 == 0 {
            seen += bit;
        }
        assert_eq!(cap(rift, seed), rift.cap_min);
    }
    assert_eq!(seen, 1023);
    let custom = MineKindConfig { cap_min: 17, cap_steps: 3, ..rift };
    for root in 0_u64..32 {
        let amount = cap(custom, root.into());
        assert!(amount == 17 || amount == 34 || amount == 51);
    }
}

#[test]
fn pool_weights_use_one_draw_across_the_complete_distribution() {
    let weights = array![MineWeight { kind: 1, weight: 3 }, MineWeight { kind: 2, weight: 7 }].span();
    for root in 0_u64..64 {
        let seed = root.into();
        let roll = crate::random::range(seed, 'MINE_KIND', 10);
        assert_eq!(select_kind(weights, seed), if roll < 3 {
            1
        } else {
            2
        });
    }
}

