pub use world_test_support::tests::registrar::*;


#[test]
#[feature("safe_dispatcher")]
fn launch_rejects_unregistered_presets_before_allocating() {
    let d = setup();
    let preset = definition(true);
    assert!(safe(d, super::authority()).create_game(params(true)).is_err());
    assert!(safe(d, super::authority()).register_preset(0, preset).is_err());
    assert!(safe(d, d.actor).register_preset(1, preset).is_err());
    registry(d).register_preset(1, preset);
    assert_eq!(registry(d).preset_commitment(1), crate::presets::commitment(preset));
    assert!(safe(d, super::authority()).create_game(CreateGameParams { preset_id: 99, ..params(true) }).is_err());
    assert_eq!(registry(d).next_game_id(), 1);
}

#[test]
#[feature("safe_dispatcher")]
fn registered_presets_are_immutable_and_changed_rules_require_a_new_id() {
    let d = setup();
    let original = definition(true);
    registry(d).register_preset(1, original);
    let old_id = registry(d).create_game(params(true));
    let mut changed = original;
    changed.rules.troop_stamina_config.stamina_explore_stamina_cost += 1;
    assert!(safe(d, d.actor).register_preset(1, changed).is_err());
    assert_eq!(registry(d).preset_commitment(1), crate::presets::commitment(original));
    assert!(safe(d, super::authority()).register_preset(1, original).is_err());
    assert!(safe(d, super::authority()).register_preset(1, changed).is_err());
    assert_eq!(registry(d).preset_commitment(1), crate::presets::commitment(original));
    assert_eq!(registry(d).create_game(params(true)), old_id);
    let next_params = CreateGameParams { name: 'next', ..params(true) };
    assert!(safe(d, super::authority()).create_game(CreateGameParams { preset_id: 101, ..next_params }).is_err());
    let next_original_id = registry(d).create_game(next_params);
    assert!(safe(d, d.actor).register_preset(101, changed).is_err());
    registry(d).register_preset(101, changed);
    assert_eq!(registry(d).preset_commitment(101), crate::presets::commitment(changed));
    let new_id = registry(d).create_game(CreateGameParams { name: 'changed', preset_id: 101, ..params(true) });
    let games = IGameDispatcher { contract_address: d.games };
    assert_eq!(
        games.rules(old_id).troop_stamina_config.stamina_explore_stamina_cost,
        original.rules.troop_stamina_config.stamina_explore_stamina_cost,
    );
    assert_eq!(
        games.rules(next_original_id).troop_stamina_config.stamina_explore_stamina_cost,
        original.rules.troop_stamina_config.stamina_explore_stamina_cost,
    );
    assert_eq!(
        games.rules(new_id).troop_stamina_config.stamina_explore_stamina_cost,
        changed.rules.troop_stamina_config.stamina_explore_stamina_cost,
    );
}

#[test]
fn identical_content_under_a_second_id_reuses_the_record_without_rewriting_withdrawals() {
    let d = setup();
    let mut preset = definition(false);
    let token = crate::withdrawals::ResourceToken { resource_type: 1, token: 0xfee.try_into().unwrap() };
    preset
        .economy
        .withdrawals = Some(WithdrawalPreset { tokens: array![token].span(), ..preset.economy.withdrawals.unwrap() });
    let commitment = crate::presets::commitment(preset);
    registry(d).register_preset(1, preset);
    let stored_token = snforge_std::interact_with_state(
        d.games, || {
            crate::state::read().presets.entry(commitment).withdrawal_tokens.read(1)
        },
    );
    assert_eq!(stored_token, token.token);
    // Re-entering the withdrawal writer would reject the already populated resource token.
    registry(d).register_preset(2, preset);
    assert_eq!(registry(d).preset_commitment(1), commitment);
    assert_eq!(registry(d).preset_commitment(2), commitment);
    let reused_token = snforge_std::interact_with_state(
        d.games, || {
            crate::state::read().presets.entry(commitment).withdrawal_tokens.read(1)
        },
    );
    assert_eq!(reused_token, stored_token);
}

#[test]
fn blitz_launch_initializes_domains_once_and_allocates_isolated_games() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    let games = IGameDispatcher { contract_address: d.games };
    for expected in 1_u32..3 {
        assert_eq!(registry(d).create_game(CreateGameParams { name: expected.into(), ..params(true) }), expected);
        let game = games.game(expected);
        assert_eq!(game.preset_id, 1);
        assert_eq!(game.end_at, 400);
        assert_eq!(game.end_grace_seconds, 0);
        assert_eq!(
            crate::games::IGamesRolesDispatcherTrait::launcher(
                crate::games::IGamesRolesDispatcher { contract_address: d.games },
            ),
            super::authority(),
        );
        assert_eq!(status_at(game, 299), GameStatus::Registration);
        assert_eq!(status_at(game, 300), GameStatus::Registration);
        assert_eq!(status_at(game, 400), GameStatus::Registration);
        assert_eq!(games.rules(expected).map_center_offset, crate::registrar::map_center_offset(expected, 42));
        let settlement = ISettlementViewsDispatcher { contract_address: d.games };
        assert_eq!(settlement.realm_grants(expected), preset.settlement.realms);
        assert_eq!(settlement.settlement_rules(expected).registration_limit, 2);
    }
    assert_eq!(registry(d).next_game_id(), 3);
}

#[test]
#[feature("safe_dispatcher")]
fn blitz_launch_accepts_empty_construction_requirements_without_allowing_reconfiguration() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    let game_id = registry(d).create_game(params(true));
    let economy = crate::hyperstructures::IHyperstructuresDispatcher { contract_address: d.games };
    assert_eq!(
        crate::hyperstructures::IHyperstructuresDispatcherTrait::hyperstructure_rules(economy, game_id),
        preset.economy.hyperstructures,
    );
    start_cheat_caller_address(d.games, super::authority());
    assert!(IRegistrarSafeDispatcher { contract_address: d.games }.register_preset(1, preset).is_err());
}

#[test]
#[feature("safe_dispatcher")]
fn eternum_launch_initializes_spires_and_never_uses_entry_capacity() {
    let d = setup();
    let preset = definition(false);
    registry(d).register_preset(1, preset);
    assert!(safe(d, d.actor).create_game(params(false)).is_err());
    assert_eq!(registry(d).next_game_id(), 1);
    assert_eq!(registry(d).create_game(params(false)), 1);
    let rules = IGameDispatcher { contract_address: d.games }.rules(1);
    let center = 2147483646 - rules.map_center_offset;
    for alt in array![false, true] {
        let _tile = IMapLogicDispatcher { contract_address: d.games }
            .tile(TileKey { game_id: 1, alt, col: center, row: center })
            .unwrap();
        assert_eq!(
            IMapLogicDispatcher { contract_address: d.games }
                .occupancy(TileKey { game_id: 1, alt, col: center, row: center })
                .unwrap()
                .category,
            35,
        );
    }
    let spires = crate::spires::ISpiresDispatcher { contract_address: d.games };
    assert_eq!(crate::spires::ISpiresDispatcherTrait::spire_layout(spires, 1), preset.settlement.spires);
    let settlement = ISettlementViewsDispatcher { contract_address: d.games };
    assert_eq!(settlement.settlement_rules(1).registration_limit, 0);
    assert_eq!(settlement.settlement_rules(1).mode, SettlementMode::Single);
}

#[test]
#[feature("safe_dispatcher")]
fn invalid_schedules_modes_and_registration_limits_never_allocate() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    for input in array![
        CreateGameParams { name: 0, ..params(true) }, CreateGameParams { seed: 0, ..params(true) },
        CreateGameParams { duration_seconds: 0, ..params(true) },
        CreateGameParams { end_grace_seconds: 1, ..params(true) },
        CreateGameParams { start_settling_at: 301, ..params(true) },
        CreateGameParams { registration_start: 200, ..params(true) },
        CreateGameParams { roster: roster(25), ..params(true) },
    ] {
        assert!(safe(d, super::authority()).create_game(input).is_err());
    }
    assert_eq!(registry(d).next_game_id(), 1);
}

#[test]
#[feature("safe_dispatcher")]
fn a_late_preset_validation_failure_rolls_back_the_record_and_allows_retry() {
    let d = setup();
    let mut preset = definition(true);
    preset.economy.banks.lp_fee_denom = 0;
    let commitment = crate::presets::commitment(preset);
    start_cheat_caller_address(d.games, super::authority());
    let (caller, _) = super::deploy("RollbackFixture", @array![]);
    assert!(
        !super::fixtures::IRollbackFixtureDispatcherTrait::attempt_preset(
            super::fixtures::IRollbackFixtureDispatcher { contract_address: caller }, d.games, 1, preset,
        ),
    );
    assert_eq!(registry(d).next_game_id(), 1);
    assert_eq!(registry(d).preset_commitment(1), 0);
    let written_mode = snforge_std::interact_with_state(
        d.games, || {
            crate::state::read().presets.entry(commitment).rules.mode_rules.read()
        },
    );
    assert!(preset.rules.mode_rules != 0);
    assert_eq!(written_mode, 0);
    assert!(
        crate::game::IGameSafeDispatcherTrait::game(crate::game::IGameSafeDispatcher { contract_address: d.games }, 1)
            .is_err(),
    );
    registry(d).register_preset(1, definition(true));
    assert_eq!(registry(d).create_game(params(true)), 1);
}

#[test]
fn relic_preset_failure_rolls_back_domain_writes_and_allows_retry() {
    let d = setup();
    let mut preset = definition(true);
    let mut relics = array![];
    for rule in preset.economy.relics {
        relics.append(crate::relics::RelicRule { draw_weight: 0, ..*rule });
    }
    preset.economy.relics = relics.span();
    let commitment = crate::presets::commitment(preset);
    start_cheat_caller_address(d.games, super::authority());
    let (caller, _) = super::deploy("RollbackFixture", @array![]);
    assert!(
        !super::fixtures::IRollbackFixtureDispatcherTrait::attempt_preset(
            super::fixtures::IRollbackFixtureDispatcher { contract_address: caller }, d.games, 1, preset,
        ),
    );
    assert_eq!(registry(d).preset_commitment(1), 0);
    let (army_tick, first_relic) = snforge_std::interact_with_state(
        d.games,
        || {
            let record = crate::state::read().presets.entry(commitment);
            (
                record.rules.tick_config.armies_tick_in_seconds.read(),
                record.relic_rules.read(crate::relics::FIRST_RELIC),
            )
        },
    );
    assert_eq!(army_tick, 0);
    assert_eq!(
        first_relic, crate::relics::RelicRule { rate_bps: 0, duration: 0, uses: 0, essence_cost: 0, draw_weight: 0 },
    );
    registry(d).register_preset(1, definition(true));
    assert_eq!(registry(d).create_game(params(true)), 1);
}

#[test]
fn settlement_uses_block_time_after_grace_and_allows_retry_after_rejection() {
    let (d, _, _) = super::resource_commands::setup();
    let command = crate::commands::Command::MarkGameSettled;
    super::resource_commands::assert_terminal_rejection(d, command, 100);
    let d = super::bind_authority(d);
    let games = IGameDispatcher { contract_address: d.games };
    let game = games.game(3);
    let boundary = game.end_at + game.end_grace_seconds.into();
    super::resource_commands::assert_terminal_rejection(d, command, boundary);
    assert!(!games.game(3).settled);
    assert!(super::resource_commands::execute(d, command, boundary + 1));
    assert!(games.game(3).settled);
    assert_eq!(status_at(games.game(3), boundary + 1), GameStatus::Settled);
    assert!(super::resource_commands::execute(d, command, boundary + 2));
    assert_eq!(status_at(games.game(3), boundary + 2), GameStatus::Settled);
}

#[test]
#[feature("safe_dispatcher")]
fn preset_registration_rejects_enabled_mines_without_a_pool() {
    let d = setup();
    let mut preset = definition(true);
    preset.rules.map_config.shards_mines_win_probability = 1;
    preset.resources.surface_mines = array![].span();
    assert!(safe(d, super::authority()).register_preset(1, preset).is_err());
    assert_eq!(registry(d).preset_commitment(1), 0);
}

#[test]
#[feature("safe_dispatcher")]
fn preset_registration_rejects_camps_with_zero_camp_labor() {
    let d = setup();
    let mut preset = definition(true);
    preset.rules.map_config.camp_win_probability = 1;
    preset.structures.camps.labor_rate = 0;
    assert!(safe(d, super::authority()).register_preset(1, preset).is_err());
    assert_eq!(registry(d).preset_commitment(1), 0);
}

#[test]
#[feature("safe_dispatcher")]
fn preset_registration_rejects_reversed_light_and_heavy_guard_bounds() {
    let d = setup();
    for light in array![true, false] {
        let mut preset = definition(true);
        if light {
            preset.rules.troop_limit_config.light_guard_lower_bound = 10;
            preset.rules.troop_limit_config.light_guard_upper_bound = 9;
        } else {
            preset.rules.troop_limit_config.heavy_guard_lower_bound = 10;
            preset.rules.troop_limit_config.heavy_guard_upper_bound = 9;
        }
        assert!(safe(d, super::authority()).register_preset(1, preset).is_err());
        assert_eq!(registry(d).preset_commitment(1), 0);
    }
}

#[test]
#[feature("safe_dispatcher")]
fn preset_registration_accepts_single_value_guard_ranges() {
    let d = setup();
    let mut preset = definition(true);
    preset.rules.troop_limit_config.light_guard_lower_bound = 10;
    preset.rules.troop_limit_config.light_guard_upper_bound = 10;
    preset.rules.troop_limit_config.heavy_guard_lower_bound = 65535;
    preset.rules.troop_limit_config.heavy_guard_upper_bound = 65535;
    assert!(safe(d, super::authority()).register_preset(1, preset).is_ok());
    assert_eq!(registry(d).preset_commitment(1), crate::presets::commitment(preset));
}

#[test]
#[feature("safe_dispatcher")]
fn fixed_blitz_rosters_require_unique_accounts_and_wallets_and_regular_mode() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    let player = *roster(1).at(0);
    for players in array![
        array![].span(), roster(25), array![player, player].span(),
        array![RosterPlayer { account: 0.try_into().unwrap(), wallet: 1.try_into().unwrap() }].span(),
        array![RosterPlayer { wallet: 0.try_into().unwrap(), ..player }].span(),
        array![player, RosterPlayer { account: 0x999.try_into().unwrap(), ..player }].span(),
    ] {
        assert!(safe(d, super::authority()).create_game(CreateGameParams { roster: players, ..params(true) }).is_err());
        assert_eq!(registry(d).next_game_id(), 1);
    }
    assert!(safe(d, super::authority()).create_game(CreateGameParams { dev_mode_on: true, ..params(true) }).is_err());
    for size in array![1_u32, 13, 17, 24] {
        let players = roster(size);
        let id = registry(d).create_game(CreateGameParams { name: size.into(), roster: players, ..params(true) });
        assert_eq!(registry(d).blitz_roster(id), players);
        let settlement = ISettlementViewsDispatcher { contract_address: d.games };
        assert_eq!(settlement.settlement_rules(id).registration_limit, size.try_into().unwrap());
    }
}

#[test]
#[feature("safe_dispatcher")]
fn launch_retries_return_the_same_game_and_conflicting_rosters_reject() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    let request = params(true);
    assert!(safe(d, d.actor).create_game(request).is_err());
    assert_eq!(registry(d).game_id_by_name(request.name), 0);
    let first = registry(d).create_game(request);
    assert_eq!(registry(d).create_game(request), first);
    assert_eq!(registry(d).next_game_id(), first + 1);
    assert_eq!(registry(d).game_id_by_name(request.name), first);
    assert!(safe(d, super::authority()).create_game(CreateGameParams { roster: roster(1), ..request }).is_err());
    assert!(safe(d, super::authority()).create_game(CreateGameParams { duration_seconds: 101, ..request }).is_err());
    assert_eq!(registry(d).blitz_roster(first), request.roster);
    assert_eq!(registry(d).next_game_id(), first + 1);
}


#[test]
fn fixed_blitz_rosters_have_exact_spots_and_deterministic_unique_permutations() {
    for count in array![1_u32, 13, 17, 24] {
        let players = crate::settlement::shuffle_roster(count, 123456789);
        assert!(players == crate::settlement::shuffle_roster(count, 123456789));
        assert!(players.len() == count);
        let mut seen: core::dict::Felt252Dict<bool> = Default::default();
        let mut tiles: core::dict::Felt252Dict<bool> = Default::default();
        for index in 0..count {
            let player = *players.at(index);
            assert!(player.into() < count && !seen.get(player.into()));
            seen.insert(player.into(), true);
            let coords = crate::settlement_grid::settlement_location(
                crate::troops::Coord { alt: false, x: 1000, y: 1000 }, SettlementMode::Triple, 6, index,
            );
            assert!(coords.len() == 3);
            for coord in coords {
                let key = Into::<u32, felt252>::into(*coord.x) * 0x100000000 + Into::<u32, felt252>::into(*coord.y);
                assert!(!tiles.get(key), "settlement spots overlap");
                tiles.insert(key, true);
            }
        }
    }
}

#[test]
fn each_player_is_dealt_every_troop_type_in_a_recorded_order() {
    let mut orders: core::dict::Felt252Dict<bool> = Default::default();
    let mut distinct = 0_u32;
    for seed in 0_u32..64 {
        let root: u256 = seed.into();
        let three = crate::settlement::deal_troop_types(root, 3);
        assert!(three == crate::settlement::deal_troop_types(root, 3), "the deal is not replayable");
        let (a, b, c): (u8, u8, u8) = ((*three.at(0)).into(), (*three.at(1)).into(), (*three.at(2)).into());
        assert!(a != b && b != c && a != c, "three realms repeat a troop type");
        let order: felt252 = a.into() * 9 + b.into() * 3 + c.into();
        if !orders.get(order) {
            orders.insert(order, true);
            distinct += 1;
        }
        assert!(crate::settlement::deal_troop_types(root, 2) == three.slice(0, 2));
        let four = crate::settlement::deal_troop_types(root, 4);
        assert!(four.slice(0, 3) == three && *four.at(3) == *three.at(0));
    }
    assert_eq!(distinct, 6, "some orders are never dealt");
}

#[test]
#[feature("safe_dispatcher")]
fn automatic_blitz_settlement_holds_play_for_its_last_seat_and_never_moves_the_start() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    let game_id = registry(d).create_game(CreateGameParams { roster: roster(3), ..params(true) });
    let games = IGameDispatcher { contract_address: d.games };
    let commands = ISettlementCommandsDispatcher { contract_address: d.games };
    let safe = ISettlementCommandsSafeDispatcher { contract_address: d.games };
    let views = ISettlementViewsDispatcher { contract_address: d.games };
    let mut context = crate::commands::ExecutionContext {
        raw_root: 98765, timestamp: 205, ..super::context(d.games, game_id),
    };
    assert!(!games.game(game_id).ready);
    assert!(status_at(games.game(game_id), 300) == GameStatus::Registration, "an unseated roster holds play");
    start_cheat_caller_address(d.games, d.actor);
    start_cheat_caller_address(d.games, d.games);
    assert!(
        safe
            .settle_blitz_roster(
                game_id,
                super::authority(),
                crate::commands::action_context(crate::commands::ExecutionContext { timestamp: 199, ..context }),
            )
            .is_err(),
    );
    assert!(views.blitz_settlement_order(game_id).is_empty());
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let guards = IGuardsDispatcher { contract_address: d.games };
    let mut fixed_order = array![].span();
    for batch in 0_u32..3 {
        if batch != 0 {
            // The remaining seats land after the start: the game waits for the last, then runs shorter.
            context.raw_root = 111 + batch.into();
            context.timestamp = 300 + batch.into();
        }
        let caller = if batch == 0 {
            d.actor
        } else {
            super::authority()
        };
        let mut creation_events = snforge_std::spy_events();
        assert!(
            commands
                .settle_blitz_roster(game_id, caller, crate::commands::action_context(context)) == (2 - batch)
                .into(),
        );
        let order = views.blitz_settlement_order(game_id);
        if batch == 0 {
            fixed_order = order;
        } else {
            assert!(order == fixed_order, "retry reshuffled roster");
        }
        let player = *roster(3).at((*order.at(batch)).into());
        assert_eq!(
            views.player_entry(crate::settlement::EntryKey { game_id, owner: player.account }),
            Some(crate::settlement::PlayerEntry { player: player.account }),
        );
        assert!(views.settlement_progress(game_id).registered.into() == batch + 1);
        let mut dealt: core::dict::Felt252Dict<bool> = Default::default();
        for realm in 0_u32..3 {
            let center = 2147483646 - games.rules(game_id).map_center_offset;
            let coord = *crate::settlement_grid::settlement_location(
                crate::troops::Coord { alt: false, x: center, y: center }, SettlementMode::Triple, 6, batch,
            )
                .at(realm);
            let entity_id = IMapLogicDispatcher { contract_address: d.games }
                .structure_occupant(TileKey { game_id, alt: false, col: coord.x, row: coord.y })
                .unwrap();
            let key = ResourceKey { game_id, entity_id };
            let structure = structures.structure(key).unwrap();
            assert!(structure.owner == player.account && structure.base.starting_troops_granted);
            assert_eq!(structure.resources_packed, 0x030204050b07130916);
            for grant in preset.settlement.realms.resources {
                if !crate::resources::is_troop_resource(*grant.resource_type) {
                    assert_eq!(
                        resources
                            .resource_balance(ResourceSlot { game_id, entity_id, resource_type: *grant.resource_type }),
                        *grant.amount,
                        "each realm receives every non-troop grant",
                    );
                }
            }
            let production = resources.resource_production(ResourceSlot { game_id, entity_id, resource_type: 23 });
            assert!(production.building_count == 1 && production.production_rate == 10);
            let guard = guards.guard(GuardKey { game_id, structure_id: entity_id, slot: 0 });
            assert_eq!(guard.troops.count, 1500 * crate::rules::RESOURCE_PRECISION);
            assert!(guard.troops.tier == crate::troops::TroopTier::T1);
            let category: u8 = guard.troops.category.into();
            assert!(!dealt.get(category.into()), "a player was dealt one troop type twice");
            dealt.insert(category.into(), true);
            for other in array![
                crate::troops::TroopType::Knight, crate::troops::TroopType::Paladin,
                crate::troops::TroopType::Crossbowman,
            ] {
                let reserve = resources
                    .resource_balance(
                        ResourceSlot { game_id, entity_id, resource_type: crate::troops::troop_resource(other, 0) },
                    );
                let expected = if other == guard.troops.category {
                    1500 * crate::rules::RESOURCE_PRECISION
                } else {
                    0
                };
                assert_eq!(reserve, expected, "reserve holds only the realm's own troop type");
            }
        }
        let mut created = 0;
        for (_, event) in creation_events.get_events().emitted_by(d.games).events {
            if event.keys.span() != array![selector!("StructureEvent"), selector!("RowSet"), 1, 'Structure'].span() {
                continue;
            }
            let mut data = event.data.span();
            let keys: Span<felt252> = Serde::deserialize(ref data).unwrap();
            let mut values: Span<felt252> = Serde::deserialize(ref data).unwrap();
            assert!(data.is_empty());
            assert_eq!(keys.len(), 2);
            assert_eq!(*keys.at(0), game_id.into());
            let emitted: crate::structures::Structure = Serde::deserialize(ref values).unwrap();
            assert!(values.is_empty());
            let stored = structures
                .structure(ResourceKey { game_id, entity_id: (*keys.at(1)).try_into().unwrap() })
                .unwrap();
            assert_eq!(Into::<u16, u32>::into(emitted.metadata.realm_id), batch * 3 + created + 1);
            assert_eq!(
                emitted,
                crate::structures::Structure {
                    base: crate::structures::StructureBase { starting_troops_granted: false, ..stored.base }, ..stored,
                },
                "creation row precedes the starting troop grant",
            );
            created += 1;
        }
        assert_eq!(created, 3, "one complete creation row per realm");
        let game = games.game(game_id);
        assert!(game.start_main_at == 300 && game.end_at == 400, "seating moved the start");
        assert!(game.ready == (batch == 2));
    }
    assert!(status_at(games.game(game_id), 302) == GameStatus::Live);
    let game = games.game(game_id);
    // A roster's start never moves, so the biomes its seats stored still match the terrain the game derives.
    let map_center = 2147483646 - games.rules(game_id).map_center_offset;
    let mut realms = array![];
    for batch in 0_u32..3 {
        realms
            .append_span(
                crate::settlement_grid::settlement_location(
                    crate::troops::Coord { alt: false, x: map_center, y: map_center }, SettlementMode::Triple, 6, batch,
                ),
            );
    }
    let reserved = snforge_std::interact_with_state(
        d.games, || crate::state::read().settlement_pool.reserved_hyperstructures.read(game_id),
    );
    for index in 0..reserved {
        realms
            .append(
                crate::settlement_grid::reservation_location(
                    crate::troops::Coord { alt: false, x: map_center, y: map_center }, SettlementMode::Triple, 6, index,
                ),
            );
    }
    assert!(super::terrain::assert_biomes_match_terrain(d, game_id, realms.span()) != 0);
    let center = 2147483646 - games.rules(game_id).map_center_offset;
    let coord = *crate::settlement_grid::settlement_location(
        crate::troops::Coord { alt: false, x: center, y: center }, SettlementMode::Triple, 6, 0,
    )
        .at(0);
    let entity_id = IMapLogicDispatcher { contract_address: d.games }
        .structure_occupant(TileKey { game_id, alt: false, col: coord.x, row: coord.y })
        .unwrap();
    let slot = ResourceSlot { game_id, entity_id, resource_type: 23 };
    let balance = resources.resource_balance(slot);
    start_cheat_caller_address(d.games, d.games);
    resources
        .spend_resource(
            ResourceKey { game_id, entity_id },
            23,
            0,
            300,
            crate::commands::resource_context(super::context(d.games, game_id)),
        );
    assert_eq!(resources.resource_balance(slot), balance, "early realm accrued before main play");
    resources
        .spend_resource(
            ResourceKey { game_id, entity_id },
            23,
            1,
            301,
            crate::commands::resource_context(super::context(d.games, game_id)),
        );
    assert_eq!(resources.resource_balance(slot), balance + 10 - 1, "first second of production missing");
    resources
        .spend_resource(
            ResourceKey { game_id, entity_id },
            23,
            0,
            320,
            crate::commands::resource_context(super::context(d.games, game_id)),
        );
    assert_eq!(resources.resource_balance(slot), balance + 20 * 10 - 1, "elapsed production missing");
    // The second player's realm was provisioned when its seat landed at 301, one second into the hold: it produces from
    // its seat, not from the scheduled start, so by 320 it trails the first player's realm by exactly that second.
    let late_coord = *crate::settlement_grid::settlement_location(
        crate::troops::Coord { alt: false, x: center, y: center }, SettlementMode::Triple, 6, 1,
    )
        .at(0);
    let late_id = IMapLogicDispatcher { contract_address: d.games }
        .structure_occupant(TileKey { game_id, alt: false, col: late_coord.x, row: late_coord.y })
        .unwrap();
    let late_slot = ResourceSlot { game_id, entity_id: late_id, resource_type: 23 };
    let late_balance = resources.resource_balance(late_slot);
    for (timestamp, accrued) in array![(301_u64, 0_u128), (320, 19 * 10)] {
        resources
            .spend_resource(
                ResourceKey { game_id, entity_id: late_id },
                23,
                0,
                timestamp,
                crate::commands::resource_context(super::context(d.games, game_id)),
            );
        assert_eq!(
            resources.resource_balance(late_slot), late_balance + accrued, "late realm produced before its seat",
        );
    }
    stop_cheat_caller_address(d.games);
    let progress = views.settlement_progress(game_id);
    let mut completed_events = snforge_std::spy_events();
    assert!(commands.settle_blitz_roster(game_id, super::authority(), crate::commands::action_context(context)) == 0);
    assert!(views.settlement_progress(game_id) == progress && games.game(game_id) == game);
    assert!(completed_events.get_events().emitted_by(d.games).events.is_empty(), "completed roster emitted again");
}

#[test]
fn only_the_games_seater_seats_it_and_the_global_launcher_no_longer_can() {
    let d = setup();
    registry(d).register_preset(1, definition(true));
    let game_id = registry(d).create_game(CreateGameParams { roster: roster(2), ..params(true) });
    assert_eq!(IRegistrarDispatcher { contract_address: d.games }.game_seater(game_id), super::authority());
    // The global launcher is now another approved account: it may still create games, but not seat this one.
    super::set_launcher(d, d.actor);
    super::play_fixture::assert_preflight_rejection(
        d.games,
        super::play_fixture::TestAction {
            game_id, actor: d.actor, command: crate::commands::Command::SettleBlitzRoster,
        },
        205,
    );
    let seater = super::bind_authority(d);
    super::season_lifecycle::execute_batch_in_game(
        seater, game_id, crate::commands::Command::SettleBlitzRoster, 205, 1,
    );
    super::season_lifecycle::execute_batch_in_game(
        seater, game_id, crate::commands::Command::SettleBlitzRoster, 206, 0,
    );
    assert!(IGameDispatcher { contract_address: d.games }.game(game_id).ready);
}

#[test]
#[feature("safe_dispatcher")]
fn a_fixed_roster_names_its_seater_and_an_open_game_names_none() {
    let d = setup();
    registry(d).register_preset(1, definition(true));
    let unseated = CreateGameParams { seater: 0.try_into().unwrap(), ..params(true) };
    assert!(safe(d, super::authority()).create_game(unseated).is_err());
    assert_eq!(registry(d).next_game_id(), 1);
    let other = setup();
    registry(other).register_preset(1, expedition_preset());
    let season = CreateGameParams {
        dev_mode_on: true, end_grace_seconds: 0, duration_seconds: 2 * BAG_SECONDS, start_main_at: 360, ..params(false),
    };
    assert!(
        safe(other, super::authority()).create_game(CreateGameParams { seater: super::authority(), ..season }).is_err(),
    );
    assert_eq!(registry(other).create_game(season), 1);
    assert_eq!(IRegistrarDispatcher { contract_address: other.games }.game_seater(1), 0.try_into().unwrap());
}

#[test]
fn launcher_roster_batches_block_early_play_and_report_transaction_progress() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    let game_id = registry(d).create_game(CreateGameParams { roster: roster(2), ..params(true) });
    assert!(d.actor != super::authority());
    let command = crate::commands::Command::SettleBlitzRoster;
    super::play_fixture::assert_preflight_rejection(
        d.games,
        super::play_fixture::TestAction { game_id, actor: d.actor, command: crate::commands::Command::CloseSeason },
        205,
    );
    let launcher = super::bind_authority(d);
    super::season_lifecycle::execute_batch_in_game(launcher, game_id, command, 205, 1);
    assert!(!IGameDispatcher { contract_address: d.games }.game(game_id).ready);
    super::play_fixture::assert_preflight_rejection(
        d.games,
        super::play_fixture::TestAction { game_id, actor: d.actor, command: crate::commands::Command::CloseSeason },
        206,
    );
    super::season_lifecycle::execute_batch_in_game(launcher, game_id, command, 207, 0);
    assert!(IGameDispatcher { contract_address: d.games }.game(game_id).ready);
    super::season_lifecycle::execute_batch_in_game(launcher, game_id, command, 208, 0);
    let games = IGameDispatcher { contract_address: d.games };
    let end_at = games.game(game_id).end_at;
    let finalize = crate::commands::Command::MarkGameSettled;
    assert!(!super::resource_commands::execute_in_game(d, game_id, finalize, end_at - 1));
    assert!(!games.game(game_id).settled);
    super::season_lifecycle::execute_batch_in_game(d, game_id, finalize, end_at, 0);
    assert!(games.game(game_id).settled);
    assert_eq!(status_at(games.game(game_id), end_at), GameStatus::Settled);
}

#[test]
fn roster_settlement_displaces_an_army_without_a_stale_position_or_home_entry() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    let game_id = registry(d).create_game(CreateGameParams { roster: roster(1), ..params(true) });
    let rules = IGameDispatcher { contract_address: d.games }.rules(game_id);
    let center = 2147483646 - rules.map_center_offset;
    let origin = *crate::settlement_grid::settlement_location(
        crate::troops::Coord { alt: false, x: center, y: center }, preset.settlement.mode, preset.settlement.spacing, 0,
    )
        .at(0);
    let home = ResourceKey { game_id, entity_id: 10000 };
    let army = crate::troops::ExplorerKey { game_id, explorer_id: 10001 };
    snforge_std::interact_with_state(
        d.games,
        || {
            crate::logic::structures::StructureState::create(
                home,
                crate::structures::StructureRecord {
                    owner: d.actor,
                    base: crate::structures::StructureBase {
                        category: 1, troop_max_explorer_count: 1, ..Default::default(),
                    },
                    resources_packed: 0,
                    metadata: Default::default(),
                },
            );
        },
    );
    super::resource_commands::set_explorer_fixture(
        d.games,
        army,
        crate::troops::ExplorerTroops {
            owner: home.entity_id,
            coord: origin,
            troops: crate::troops::Troops {
                category: crate::troops::TroopType::Knight,
                tier: crate::troops::TroopTier::T1,
                count: RESOURCE_PRECISION,
                stamina: crate::troops::Stamina { amount: 120, settled_at: 0, remainder: 0 }.into(),
                boosts: Default::default(),
                battle_cooldown_end: 0,
            },
        },
    );
    crate::tests::state::assert_spatial_indexes(d.games, game_id, array![10000, 10001].span(), array![origin].span());
    super::season_lifecycle::execute_batch_in_game(
        super::bind_authority(d), game_id, Command::SettleBlitzRoster, 205, 0,
    );
    let moved = GameState { contract_address: d.games }.resolved_explorer(army).unwrap();
    assert!(moved.coord != origin);
    assert_eq!(moved.owner, home.entity_id);
    crate::tests::state::assert_spatial_indexes(
        d.games, game_id, array![1, 10000, 10001].span(), array![origin, moved.coord].span(),
    );
    assert_eq!(
        IStructureOperationsDispatcher { contract_address: d.games }.position(ResourceKey { game_id, entity_id: 1 }),
        Some(origin),
    );
}

#[test]
fn open_preset_exploration_discovers_a_camp_and_credits_the_home_realm() {
    let d = setup();
    let mut preset = definition(true);
    preset.rules.command_mask = super::play_fixture::BLITZ_COMMAND_MASK;
    preset.rules.mode_rules = HOME_REWARDS | DISCOVER_CAMPS | DISCOVER_CHESTS;
    open_entry(ref preset);
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset.rules.map_config.shards_mines_fail_probability = 1;
    preset.rules.map_config.camp_win_probability = 1;
    preset.rules.map_config.camp_fail_probability = 0;
    preset.rules.map_config.relic_discovery_interval_sec = 60000;
    registry(d).register_preset(1, preset);
    let game_id = registry(d).create_game(CreateGameParams { end_grace_seconds: 0, ..params(false) });

    let center = 2147483646 - IGameDispatcher { contract_address: d.games }.rules(game_id).map_center_offset;
    start_cheat_block_timestamp_global(300);
    start_cheat_caller_address(d.games, d.games);
    let home = ResourceKey {
        game_id,
        entity_id: ISettlementCreationDispatcher { contract_address: d.games }
            .create_settlement(
                game_id,
                d.actor,
                crate::troops::Coord { alt: false, x: center, y: center },
                SettlementCreation::Realm(
                    RealmCreation {
                        realm_id: 1,
                        traits: crate::realms::RealmTraits { wonder: 1, order: 1, resources: array![1].span() },
                        troops: crate::settlement::StartingTroops::Biome,
                        activate_economy: true,
                    },
                ),
                crate::commands::action_context(
                    crate::commands::ExecutionContext { timestamp: 300, ..super::context(d.games, game_id) },
                ),
            ),
    };
    stop_cheat_caller_address(d.games);
    let guards = IGuardsDispatcher { contract_address: d.games };
    let category: u8 = guards.guard(GuardKey { game_id, structure_id: home.entity_id, slot: 0 }).troops.category.into();
    assert!(
        !execute_in_game(
            d,
            game_id,
            Command::CreateExplorer(
                CreateExplorer {
                    slot: 1, structure_id: home.entity_id, category, tier: 0, amount: RESOURCE_PRECISION, direction: 0,
                },
            ),
            301,
        ),
    );
    assert_eq!(IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home).len(), 0);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::CreateExplorer(
                CreateExplorer {
                    slot: 0, structure_id: home.entity_id, category, tier: 0, amount: RESOURCE_PRECISION, direction: 0,
                },
            ),
            301,
        ),
    );
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let explorer_id = *structures.home_armies(home).at(0);
    let troops = GameState { contract_address: d.games };
    let explorer = ExplorerKey { game_id, explorer_id };
    let origin = troops.resolved_explorer(explorer).unwrap().coord;
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let home_slot = ResourceSlot { game_id, entity_id: home.entity_id, resource_type: 1 };
    let before = resources.resource_balance(home_slot);

    assert!(execute_in_game(d, game_id, Command::Explore(Explore { explorer_id, direction: 0 }), 360));

    let target = crate::geometry::neighbor(origin, 0);
    let _tile = IMapLogicDispatcher { contract_address: d.games }
        .tile(crate::geometry::tile_key(game_id, target))
        .unwrap();
    assert_eq!(
        IMapLogicDispatcher { contract_address: d.games }
            .occupancy(crate::geometry::tile_key(game_id, target))
            .unwrap()
            .category,
        crate::taxonomy::CAMP_OCCUPIER,
    );
    assert_eq!(troops.resolved_explorer(explorer).unwrap().coord, origin);
    // The pool's one row pays 10 percent of the army's strength: one T1 troop earns a tenth of a unit.
    assert_eq!(resources.resource_balance(home_slot), before + RESOURCE_PRECISION / 10);
    assert_eq!(resources.resource_balance(ResourceSlot { entity_id: explorer_id, ..home_slot }), 0);
}

#[test]
#[feature("safe_dispatcher")]
fn a_day_is_whole_armies_ticks_and_a_season_starts_on_one() {
    let d = setup();
    let mut uneven = expedition_preset();
    uneven.rules.tick_config.armies_tick_in_seconds = 50;
    assert!(safe(d, super::authority()).register_preset(1, uneven).is_err());
    registry(d).register_preset(1, expedition_preset());
    let season = CreateGameParams {
        dev_mode_on: true, end_grace_seconds: 0, duration_seconds: 2 * BAG_SECONDS, ..params(false),
    };
    assert!(safe(d, super::authority()).create_game(CreateGameParams { start_main_at: 310, ..season }).is_err());
    assert_eq!(registry(d).next_game_id(), 1);
    assert_eq!(registry(d).create_game(CreateGameParams { start_main_at: 360, ..season }), 1);
}

#[test]
fn expedition_armies_merge_into_the_lower_stamina_and_never_past_the_size_limit() {
    let d = setup();
    let (game_id, _, category) = expedition_home(d);
    let (source, target) = expedition_armies(d, game_id, category);
    let troops = GameState { contract_address: d.games };
    assert!(
        crate::geometry::adjacent(
            troops.resolved_explorer(source).unwrap().coord, troops.resolved_explorer(target).unwrap().coord,
        ),
    );

    // A tired army merging into a rested one leaves the merged army tired: merging never refills.
    let mut tired = troops.resolved_explorer(source).unwrap();
    tired.troops.stamina.set_amount(5);
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: game_id.into(), explorer_id: source.explorer_id }, tired,
    );
    assert!(troops.resolved_explorer(target).unwrap().troops.stamina.inline().amount > 5);
    assert!(execute_in_game(d, game_id, transfer(source, target, 1), 352));
    let merged = troops.resolved_explorer(target).unwrap();
    assert_eq!(merged.troops.count, 4 * RESOURCE_PRECISION);
    assert_eq!(merged.troops.stamina.inline().amount, 5);
    assert_eq!(troops.resolved_explorer(source).unwrap().troops.count, 2 * RESOURCE_PRECISION);

    // An army at its size limit takes no more troops.
    let rules = IGameDispatcher { contract_address: d.games }.rules(game_id);
    let level = IStructureOperationsDispatcher { contract_address: d.games }
        .structure(ResourceKey { game_id, entity_id: 1 })
        .unwrap()
        .base
        .level;
    let limit: u128 = crate::troops::max_army_size(rules.troop_limit_config, level, merged.troops.tier).into()
        * RESOURCE_PRECISION;
    let mut full = merged;
    full.troops.count = limit;
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: game_id.into(), explorer_id: target.explorer_id }, full,
    );
    assert!(!execute_in_game(d, game_id, transfer(source, target, 1), 353));
    assert_eq!(troops.resolved_explorer(target).unwrap().troops.count, limit);
    assert_eq!(troops.resolved_explorer(source).unwrap().troops.count, 2 * RESOURCE_PRECISION);
}

#[test]
fn an_expedition_army_cannot_recruit_because_its_home_stands_off_the_map() {
    let d = setup();
    let (game_id, _, category) = expedition_home(d);
    let (army, _) = expedition_armies(d, game_id, category);
    let recruit = Command::ManageTroops(
        crate::troop_management::ManageTroops::RecruitExplorer(
            crate::troop_management::RecruitExplorer { explorer_id: army.explorer_id, amount: RESOURCE_PRECISION },
        ),
    );
    assert!(!execute_in_game(d, game_id, recruit, 352));
    assert_eq!(
        GameState { contract_address: d.games }.resolved_explorer(army).unwrap().troops.count, 3 * RESOURCE_PRECISION,
    );
}

#[test]
fn guard_management_is_refused_past_the_home_guard_slots() {
    let d = setup();
    let (game_id, _, _) = expedition_home(d);
    let home = ResourceKey { game_id, entity_id: 1 };
    // Paying for the knights succeeds, so only the slot rule can refuse the recruit.
    start_cheat_caller_address(d.games, d.games);
    IResourceOperationsDispatcher { contract_address: d.games }
        .grant_resource(
            home,
            26,
            1000 * RESOURCE_PRECISION,
            351,
            crate::commands::resource_context(
                crate::commands::ExecutionContext { timestamp: 351, ..crate::tests::context(d.games, (home).game_id) },
            ),
        );
    stop_cheat_caller_address(d.games);
    let slots = IStructureOperationsDispatcher { contract_address: d.games }
        .structure(home)
        .unwrap()
        .base
        .troop_max_guard_count;
    let slot = crate::troop_management::GuardSlot { structure_id: 1, slot: slots };
    let recruit = crate::troop_management::RecruitGuard {
        guard: slot,
        category: crate::troops::TroopType::Knight,
        tier: crate::troops::TroopTier::T1,
        amount: RESOURCE_PRECISION,
    };
    assert!(
        !execute_in_game(
            d, game_id, Command::ManageTroops(crate::troop_management::ManageTroops::RecruitGuard(recruit)), 352,
        ),
    );
    assert!(
        !execute_in_game(
            d, game_id, Command::ManageTroops(crate::troop_management::ManageTroops::RemoveGuard(slot)), 353,
        ),
    );
}

#[test]
fn yesterdays_armies_leave_todays_army_cap_free() {
    let d = setup();
    let (game_id, _, category) = expedition_home(d);
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let troops = GameState { contract_address: d.games };
    let home = ResourceKey { game_id, entity_id: 1 };
    assert!(execute_in_game(d, game_id, muster_command(category, 0), 351));
    assert!(execute_in_game(d, game_id, muster_slot_command(category, 1, 1), 352));
    assert!(!execute_in_game(d, game_id, muster_slot_command(category, 2, 2), 353));
    let yesterday = structures.home_armies(home);
    // The next day both armies are dead by rule; the realm musters its full cap again.
    let tomorrow = day_start(d, game_id, 1);
    assert!(execute_in_game(d, game_id, muster_command(category, 0), tomorrow + 1));
    assert!(execute_in_game(d, game_id, muster_slot_command(category, 1, 1), tomorrow + 2));
    for id in yesterday {
        assert!(troops.resolved_explorer(ExplorerKey { game_id, explorer_id: *id }).is_none());
    }
    assert_eq!(structures.home_armies(home).len(), 2);
}

#[test]
fn a_materialized_home_ring_moves_and_explores_without_a_roll() {
    let d = setup();
    let (game_id, preset, category) = expedition_home(d);
    let spacing = preset.settlement.spacing;
    let map = IMapLogicDispatcher { contract_address: d.games };
    let troops = GameState { contract_address: d.games };
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    assert!(execute_in_game(d, game_id, muster_command(category, 0), 351));
    let key = ExplorerKey {
        game_id, explorer_id: *structures.home_armies(ResourceKey { game_id, entity_id: 1 }).at(0),
    };
    let spawn = troops.resolved_explorer(key).unwrap().coord;
    let site = crate::geometry::neighbor(spawn, 3);

    // All neighbours were materialized together before the first deployment.
    let (step, ring_tile) = free_ring_neighbor(map, game_id, spawn, site, spacing);
    let move = Command::Move(crate::commands::Move { explorer_id: key.explorer_id, directions: array![step].span() });
    assert!(execute_in_game(d, game_id, move, 352));
    let tile_key = crate::geometry::tile_key(game_id, ring_tile);
    assert_eq!(troops.resolved_explorer(key).unwrap().coord, ring_tile);
    assert_eq!(
        map.tile(tile_key).unwrap().data / 0x20000000000 % 256,
        map
            .biome(
                tile_key,
                crate::commands::biome_context(
                    crate::commands::ExecutionContext {
                        timestamp: 100, ..crate::tests::context(d.games, (tile_key).game_id),
                    },
                ),
            )
            .into(),
    );

    // An explore onto another ring tile moves at move cost: no discovery, no supplies.
    let (step, target) = free_ring_neighbor(map, game_id, ring_tile, site, spacing);
    // The fixture's armies start with one move of stamina and regain it per 50 s tick, and the move above spent it in
    // this tick; rest the army by one dearest move so the explore is judged on the ring rule, not on fatigue.
    let stamina = preset.rules.troop_stamina_config;
    let mut rested = troops.resolved_explorer(key).unwrap();
    rested
        .troops
        .stamina
        .set_amount(
            rested.troops.stamina.inline().amount
                + (stamina.stamina_travel_stamina_cost + stamina.stamina_bonus_value).into(),
        );
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: game_id.into(), explorer_id: key.explorer_id }, rested,
    );
    let before = troops.resolved_explorer(key).unwrap();
    let progress_before = snforge_std::interact_with_state(d.games, || crate::logic::progression::read(key));
    let discovery_key = crate::expeditions::ExpeditionDiscoveryKey { game_id, structure_id: 1, epoch: 0 };
    let discovery_before = snforge_std::interact_with_state(
        d.games, || crate::logic::expeditions::discovery(discovery_key),
    );
    let mut balances = array![];
    for resource in array![23_u8, 26, 38].span() {
        balances.append(resources.resource_balance(ResourceSlot { game_id, entity_id: 1, resource_type: *resource }));
    }
    let target_key = crate::geometry::tile_key(game_id, target);
    let mut troops_before = before.troops;
    let (increase, bonus) = troops_before
        .stamina_travel_bonus(
            map
                .biome(
                    target_key,
                    crate::commands::biome_context(
                        crate::commands::ExecutionContext {
                            timestamp: 100, ..crate::tests::context(d.games, (target_key).game_id),
                        },
                    ),
                )
                .into(),
            preset.rules.troop_stamina_config,
        );
    let travel: u64 = preset.rules.troop_stamina_config.stamina_travel_stamina_cost.into();
    let move_cost = if increase {
        travel + bonus.into()
    } else {
        travel - bonus.into()
    };
    assert!(
        execute_in_game(d, game_id, Command::Explore(Explore { explorer_id: key.explorer_id, direction: step }), 353),
    );
    let after = troops.resolved_explorer(key).unwrap();
    assert_eq!(progress_before, snforge_std::interact_with_state(d.games, || crate::logic::progression::read(key)));
    assert_eq!(
        discovery_before,
        snforge_std::interact_with_state(d.games, || crate::logic::expeditions::discovery(discovery_key)),
    );
    assert_eq!(after.coord, target);
    assert_eq!(before.troops.stamina.inline().amount - after.troops.stamina.inline().amount, move_cost);
    assert!(!map.occupancy(target_key).unwrap().is_structure);
    let mut index = 0;
    for resource in array![23_u8, 26, 38].span() {
        assert_eq!(
            resources.resource_balance(ResourceSlot { game_id, entity_id: 1, resource_type: *resource }),
            *balances.at(index),
        );
        index += 1;
    }
    // The home ring, the moved-to and the explored tiles keep the biome the terrain derives for them.
    assert!(
        super::terrain::assert_biomes_match_terrain(d, game_id, array![site, spawn, ring_tile, target].span()) != 0,
    );
}
