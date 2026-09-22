use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use crate::buildings::{IBuildingRulesDispatcher, IBuildingRulesDispatcherTrait};
use crate::game::{IGameDispatcher, IGameDispatcherTrait};
use crate::map::{IMapDispatcher, IMapDispatcherTrait};
use crate::mines::{
    IMineRulesDispatcher, IMineRulesDispatcherTrait, IMineRulesSafeDispatcher, IMineRulesSafeDispatcherTrait,
    MineKindConfig, MineKindEntry, MineKindKey, MinePoolKey, MineWeight, cap, select_kind,
};
use crate::resources::{IResourcesDispatcher, IResourcesDispatcherTrait, ResourceKey, ResourceSlot};
use crate::rules::RESOURCE_PRECISION;
use crate::structures::{IStructuresDispatcher, IStructuresDispatcherTrait, structure_coord};
use crate::troops::{Coord, TroopTier, TroopType};

pub fn kinds() -> Span<MineKindEntry> {
    array![
        MineKindEntry {
            kind: 1,
            config: MineKindConfig {
                resource_type: 38,
                building_category: 39,
                production_rate: 2500000000,
                cap_min: 36000 * RESOURCE_PRECISION,
                cap_steps: 1,
            },
        },
        MineKindEntry {
            kind: 2,
            config: MineKindConfig {
                resource_type: 24,
                building_category: 26,
                production_rate: 1500000000,
                cap_min: 300000 * RESOURCE_PRECISION,
                cap_steps: 10,
            },
        },
    ]
        .span()
}

fn surface() -> Span<MineWeight> {
    array![MineWeight { kind: 1, weight: 1 }, MineWeight { kind: 2, weight: 1 }].span()
}

#[test]
fn the_surface_pool_selects_only_its_configured_kinds_and_keeps_game_configuration_isolated() {
    let deployment = super::setup_with_domains(true, "StructuresDomain", "TroopsDomain");
    let rules = IMineRulesDispatcher { contract_address: deployment.peers.resources };
    let rift = array![MineWeight { kind: 1, weight: 1 }].span();
    start_cheat_caller_address(deployment.peers.resources, super::authority());
    rules.configure_mines(1, kinds(), surface());
    rules.configure_mines(2, kinds(), rift);
    stop_cheat_caller_address(deployment.peers.resources);
    let mut seen_rift = false;
    let mut seen_fragment = false;
    for root in 0_u64..32 {
        let seed = root.into();
        let (kind, config, amount) = rules.mine_draw(MinePoolKey { game_id: 1 }, seed);
        seen_rift = seen_rift || kind == 1;
        seen_fragment = seen_fragment || kind == 2;
        assert_eq!(config, rules.mine_kind(MineKindKey { game_id: 1, kind }));
        assert_eq!(amount, cap(config, seed));
        let (kind, _, _) = rules.mine_draw(MinePoolKey { game_id: 2 }, seed);
        assert_eq!(kind, 1);
    }
    assert!(seen_rift && seen_fragment);
    assert_eq!(rules.mine_pool(MinePoolKey { game_id: 2 }), rift);
}

#[test]
fn fragment_cap_is_the_original_ten_step_draw_and_rift_cap_is_fixed() {
    let fragment = (*kinds().at(1)).config;
    let rift = (*kinds().at(0)).config;
    let mut seen = 0_u16;
    for root in 0_u64..128 {
        let seed = root.into();
        let expected = 1 + crate::random::range(seed, 124, 10);
        let amount = cap(fragment, seed);
        assert_eq!(amount, 300000 * RESOURCE_PRECISION * expected);
        assert!(amount >= fragment.cap_min && amount <= 10 * fragment.cap_min);
        let mut bit = 1_u16;
        for _ in 1..expected {
            bit *= 2;
        }
        if seen / bit % 2 == 0 {
            seen += bit;
        }
        assert_eq!(cap(rift, seed), 36000 * RESOURCE_PRECISION);
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

#[test]
#[feature("safe_dispatcher")]
fn mine_configuration_is_authorized_immutable_and_rejects_unknown_or_duplicate_weights() {
    let deployment = super::setup_with_domains(true, "StructuresDomain", "TroopsDomain");
    let rules = IMineRulesSafeDispatcher { contract_address: deployment.peers.resources };
    assert!(rules.configure_mines(1, kinds(), surface()).is_err());
    start_cheat_caller_address(deployment.peers.resources, super::authority());
    for weights in array![
        array![MineWeight { kind: 9, weight: 1 }].span(), array![MineWeight { kind: 1, weight: 0 }].span(),
        array![MineWeight { kind: 1, weight: 1 }, MineWeight { kind: 1, weight: 1 }].span(),
    ] {
        assert!(rules.configure_mines(1, kinds(), weights).is_err());
    }
    assert!(rules.configure_mines(1, kinds(), surface()).is_ok());
    assert!(rules.configure_mines(1, kinds(), surface()).is_err());
    assert!(rules.mine_kind(MineKindKey { game_id: 1, kind: 9 }).is_err());
    assert!(rules.mine_pool(MinePoolKey { game_id: 2 }).is_err());
    assert!(rules.mine_draw(MinePoolKey { game_id: 2 }, 1).is_err());
    stop_cheat_caller_address(deployment.peers.resources);
}

#[test]
#[feature("safe_dispatcher")]
fn invalid_rate_cap_ladder_and_building_resource_pairs_cannot_initialize_a_game() {
    let deployment = super::setup_with_domains(true, "StructuresDomain", "TroopsDomain");
    let rules = IMineRulesSafeDispatcher { contract_address: deployment.peers.resources };
    let valid = (*kinds().at(0)).config;
    start_cheat_caller_address(deployment.peers.resources, super::authority());
    for config in array![
        MineKindConfig { production_rate: 0, ..valid }, MineKindConfig { cap_min: 0, ..valid },
        MineKindConfig { cap_steps: 0, ..valid },
        MineKindConfig { cap_min: 0xffffffffffffffffffffffffffffffff, cap_steps: 2, ..valid },
        MineKindConfig { resource_type: 24, ..valid },
    ] {
        assert!(
            rules
                .configure_mines(
                    1,
                    array![MineKindEntry { kind: 1, config }].span(),
                    array![MineWeight { kind: 1, weight: 1 }].span(),
                )
                .is_err(),
        );
    }
    assert!(rules.configure_mines(1, kinds(), surface()).is_ok());
    stop_cheat_caller_address(deployment.peers.resources);
}

#[test]
fn discovered_surface_mines_use_kind_production_without_revealing_neighbors() {
    let (deployment, _, _) = super::resource_commands::setup();
    let peers = deployment.peers;
    start_cheat_caller_address(peers.resources, super::authority());
    let mine_rules = IMineRulesDispatcher { contract_address: peers.resources };
    mine_rules.configure_mines(3, kinds(), surface());
    stop_cheat_caller_address(peers.resources);
    start_cheat_caller_address(peers.structures, super::authority());
    IBuildingRulesDispatcher { contract_address: peers.structures }
        .configure_buildings(3, super::building_commands::rules(), None);
    start_cheat_caller_address(peers.structures, peers.troops);
    let structures = IStructuresDispatcher { contract_address: peers.structures };
    let resources = IResourcesDispatcher { contract_address: peers.resources };
    let map = IMapDispatcher { contract_address: peers.map };
    let mut seen = 0_u8;
    for index in 0_u32..12 {
        let coord = Coord { alt: false, x: 2000100 + index * 10, y: 2000100 };
        let seed: u256 = index.into();
        let (kind, config, cap) = mine_rules.mine_draw(MinePoolKey { game_id: 3 }, seed);
        let id = structures.create_discovery(3, coord, crate::discovery::Discovery::Mine, seed, 30);
        let structure = structures.structure(ResourceKey { game_id: 3, entity_id: id }).unwrap();
        assert_eq!(structure.metadata.mine_kind, kind);
        assert_eq!(structure.base.category, 4);
        assert_eq!(structure_coord(structure.base), coord);
        assert_eq!(
            crate::guards::IGuardsDispatcherTrait::guard(
                crate::guards::IGuardsDispatcher { contract_address: deployment.peers.troops },
                crate::guards::GuardKey { game_id: 3, structure_id: id, slot: 0 },
            )
                .troops
                .category,
            TroopType::Crossbowman,
        );
        assert_eq!(
            crate::guards::IGuardsDispatcherTrait::guard(
                crate::guards::IGuardsDispatcher { contract_address: deployment.peers.troops },
                crate::guards::GuardKey { game_id: 3, structure_id: id, slot: 0 },
            )
                .troops
                .tier,
            TroopTier::T1,
        );
        for slot in 1_u8..4 {
            assert_eq!(
                crate::guards::IGuardsDispatcherTrait::guard(
                    crate::guards::IGuardsDispatcher { contract_address: peers.troops },
                    crate::guards::GuardKey { game_id: 3, structure_id: id, slot },
                ),
                Default::default(),
            );
        }
        let production = resources
            .resource_production(ResourceSlot { game_id: 3, entity_id: id, resource_type: config.resource_type });
        assert_eq!(production.production_rate, config.production_rate);
        assert_eq!(production.output_amount_left, cap);
        assert_eq!(production.building_count, 1);
        assert_eq!(production.last_updated_at, 30);
        assert!(map.tile(crate::geometry::tile_key(3, coord)).is_some());
        for direction in 0_u8..6 {
            assert!(map.tile(crate::geometry::tile_key(3, crate::geometry::neighbor(coord, direction))).is_none());
        }
        seen = seen | if kind == 1 {
            1
        } else {
            2
        };
    }
    assert_eq!(seen, 3);
    stop_cheat_caller_address(peers.structures);
}

#[test]
fn ethereal_discovery_never_draws_from_the_ordinary_mine_pool() {
    let d = super::setup(true);
    let game = IGameDispatcher { contract_address: d.peers.registry };
    let mut rules = super::recorded::rules();
    rules.bitcoin_mine_config.enabled = false;
    rules.map_config.shards_mines_win_probability = 1;
    rules.map_config.shards_mines_fail_probability = 0;
    super::recorded::seed_game(d.peers.registry, 3, game.game(1), rules);
    start_cheat_caller_address(d.peers.resources, super::authority());
    IMineRulesDispatcher { contract_address: d.peers.resources }.configure_mines(3, kinds(), surface());
    stop_cheat_caller_address(d.peers.resources);
    let map = IMapDispatcher { contract_address: d.peers.map };
    for root in 0_u64..8 {
        assert_eq!(
            map
                .discovery(
                    crate::map::TileKey { game_id: 3, alt: true, col: 2000100, row: 2000100 }, root.into(), 0, 30,
                ),
            crate::discovery::Discovery::None,
        );
    }
}
