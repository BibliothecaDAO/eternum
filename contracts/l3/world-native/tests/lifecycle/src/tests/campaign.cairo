use snforge_std::{interact_with_state, start_cheat_block_timestamp};
use world_test_support::tests::entry::*;
use crate::entry::LaborHome;
use crate::resources::{ESSENCE, LABOR, ResourceKey};
use crate::rules::RESOURCE_PRECISION;

fn ticket(tier: u8) -> EntryEntitlement {
    EntryEntitlement {
        realm_id: 0,
        metadata_1: 'devcon-2026',
        metadata_2: tier.into(),
        metadata_3: 0,
        pass_kind: crate::settlement::CAMPAIGN_KIND,
    }
}

#[feature("safe_dispatcher")]
fn register(d: Deployment, game_id: u32, entitlement: EntryEntitlement) {
    start_cheat_caller_address(d.games, authority());
    ledger(d).register_entitlement(EntryKey { game_id, owner: d.actor }, entitlement).unwrap();
}

fn found(d: Deployment, game_id: u32) -> LaborHome {
    found_at(d, game_id, 360)
}

fn found_at(d: Deployment, game_id: u32, timestamp: u64) -> LaborHome {
    assert!(
        super::resource_commands::execute_in_game(
            d,
            game_id,
            crate::commands::Command::SettleSeason(crate::realms::SettleSeason { selected_realm: None, aspect: None }),
            timestamp,
        ),
    );
    LaborHome { game_id, home: interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor)) }
}

#[feature("safe_dispatcher")]
fn campaign_home(preset: ByteArray, tier: u8) -> (Deployment, LaborHome) {
    let (d, game_id) = super::registrar::setup_open_frontier_preset(preset, 2);
    set_operator(d, authority());
    register(d, game_id, ticket(tier));
    let home = found(d, game_id);
    start_cheat_block_timestamp(d.games, 360);
    start_cheat_caller_address(d.games, authority());
    (d, home)
}

fn balance(d: Deployment, home: LaborHome, resource: u8) -> u128 {
    interact_with_state(
        d.games,
        || crate::logic::resources::balance(ResourceKey { game_id: home.game_id, entity_id: home.home }, resource),
    )
}

#[feature("safe_dispatcher")]
fn claims_each_game_day(tier: u8, expected_amount: u128, expected_essence: u128) {
    let (d, home) = campaign_home("devcon", tier);
    let operator = IHomeGrantsSafeDispatcher { contract_address: d.games };
    let labor_before = balance(d, home, LABOR);
    let essence_before = balance(d, home, ESSENCE);
    assert!(operator.grant_labor(home, 1, d.actor).is_err());
    assert!(operator.grant_labor(home, 0, authority()).is_err());
    let mut spy = spy_events();
    let grant = operator.grant_labor(home, 0, d.actor).unwrap();
    assert_eq!(grant.amount, expected_amount * RESOURCE_PRECISION);
    assert_eq!(grant.essence, expected_essence * RESOURCE_PRECISION);
    assert_eq!(balance(d, home, LABOR), labor_before + grant.amount);
    assert_eq!(balance(d, home, ESSENCE), essence_before + grant.essence);
    let mut receipts = 0;
    for (_, event) in spy.get_events().emitted_by(d.games).events {
        if event.keys.len() >= 3 && *event.keys.at(event.keys.len() - 1) == 'LaborGrant' {
            assert_eq!(
                event.data.span(),
                array![
                    3, home.game_id.into(), home.home.into(), 0, 3, d.actor.into(), grant.amount.into(),
                    grant.essence.into(),
                ]
                    .span(),
            );
            receipts += 1;
        }
    }
    assert_eq!(receipts, 1);
    let mut retry = spy_events();
    assert_eq!(operator.grant_labor(home, 0, d.actor).unwrap(), grant);
    assert_eq!(operator.labor_grant(home, 0).unwrap(), Some(grant));
    assert_eq!(retry.get_events().emitted_by(d.games).events.len(), 0);
    assert_eq!(balance(d, home, ESSENCE), essence_before + grant.essence);
    let game = crate::game::IGameDispatcherTrait::game(
        crate::game::IGameDispatcher { contract_address: d.games }, home.game_id,
    );
    let (_, preset) = super::preset_projection::current_definition("devcon");
    let unit = preset.rules.day_unit_seconds;
    assert_eq!(unit, 7200);
    assert_eq!(crate::days::day_of(game, unit, game.end_at - 1).index + 1, 10);
    let old_first_day = crate::days::day_of(game, 4800, 360);
    start_cheat_block_timestamp(d.games, old_first_day.end);
    assert!(operator.grant_labor(home, 1, d.actor).is_err());
    let labor_rate = interact_with_state(
        d.games,
        || crate::logic::resources::production(ResourceKey { game_id: home.game_id, entity_id: home.home }, LABOR)
            .production_rate,
    );
    assert_eq!(labor_rate, 84_000_000);
    let labor_limit = 6000 * RESOURCE_PRECISION;
    let mut today = crate::days::day_of(game, unit, 360);
    for day in 1_u64..10 {
        start_cheat_block_timestamp(d.games, today.end - 1);
        assert!(operator.grant_labor(home, day, d.actor).is_err());
        start_cheat_block_timestamp(d.games, today.end);
        let labor_before = balance(d, home, LABOR);
        let produced = Into::<u64, u128>::into(today.end - today.start) * labor_rate.into();
        let accrued = core::cmp::min(labor_limit, labor_before + produced);
        let expected_grant = core::cmp::min(expected_amount * RESOURCE_PRECISION, labor_limit - accrued);
        let next = operator.grant_labor(home, day, d.actor).unwrap();
        assert_eq!(next.amount, expected_grant);
        assert_eq!(balance(d, home, LABOR), accrued + expected_grant);
        assert_eq!(next.essence, expected_essence * RESOURCE_PRECISION);
        assert_eq!(
            balance(d, home, ESSENCE),
            essence_before + Into::<u64, u128>::into(day + 1) * expected_essence * RESOURCE_PRECISION,
        );
        assert_eq!(operator.grant_labor(home, day, d.actor).unwrap(), next);
        today = crate::days::day_of(game, unit, today.end);
    }
    assert_eq!(today.end, game.end_at);
    start_cheat_block_timestamp(d.games, game.end_at);
    assert!(operator.grant_labor(home, 10, d.actor).is_err());
    assert_eq!(operator.grant_labor(home, 0, d.actor).unwrap(), grant);
}

#[test]
#[feature("safe_dispatcher")]
fn a_normal_campaign_home_claims_one_thousand_labor_and_essence_on_each_game_day() {
    claims_each_game_day(crate::settlement::CAMPAIGN_NORMAL, 1000, 1000);
}

#[test]
#[feature("safe_dispatcher")]
fn a_golden_campaign_home_claims_labor_and_essence_once_together() {
    claims_each_game_day(crate::settlement::CAMPAIGN_GOLDEN, 2000, 2000);
}

#[test]
#[feature("safe_dispatcher")]
fn campaign_homes_share_the_campaign_but_never_a_canonical_claim() {
    let (d, game_id) = super::registrar::setup_open_frontier_preset("devcon", 3);
    let other = super::bind_authority(d);
    set_operator(d, authority());
    register(d, game_id, ticket(crate::settlement::CAMPAIGN_NORMAL));
    register(other, game_id, ticket(crate::settlement::CAMPAIGN_NORMAL));
    let mut spy = spy_events();
    let first = found(d, game_id);
    let second = found(other, game_id);
    assert!(first.home != second.home);
    let mut homes = 0;
    for (_, event) in spy.get_events().emitted_by(d.games).events {
        if event.keys.len() >= 3 && *event.keys.at(event.keys.len() - 1) == 'CampaignHome' {
            let home = *event.data.at(2);
            assert!(home == first.home.into() || home == second.home.into());
            assert_eq!(event.data.span(), array![2, game_id.into(), home, 2, 'devcon-2026', 1].span());
            homes += 1;
        }
    }
    assert_eq!(homes, 2);
    for home in array![first, second] {
        let realm_id: u32 = interact_with_state(
            d.games,
            || {
                let state = crate::state::read();
                assert_eq!(state.settlements.campaign_homes.read((game_id, home.home)), Some(('devcon-2026', 1)));
                crate::logic::structures::record(ResourceKey { game_id, entity_id: home.home }).metadata.realm_id.into()
            },
        );
        assert_eq!(ledger(d).settled_realm(game_id, realm_id).unwrap(), 0);
    }
}

#[feature("safe_dispatcher")]
fn refuses_a_second_source(held_first: bool) {
    let (d, game_id) = super::registrar::setup_open_frontier_preset("devcon", 3);
    set_operator(d, authority());
    let held = EntryEntitlement { realm_id: 711, metadata_1: 0, metadata_2: 0, metadata_3: 0, pass_kind: 2 };
    let campaign = ticket(crate::settlement::CAMPAIGN_GOLDEN);
    let (first, second) = if held_first {
        (held, campaign)
    } else {
        (campaign, held)
    };
    register(d, game_id, first);
    let key = EntryKey { game_id, owner: d.actor };
    assert!(ledger(d).register_entitlement(key, second).is_err());
    let mut retry = spy_events();
    ledger(d).register_entitlement(key, first).unwrap();
    assert_eq!(retry.get_events().emitted_by(d.games).events.len(), 0);
    assert!(
        !super::resource_commands::execute_in_game(
            d,
            game_id,
            crate::commands::Command::SettleSeason(
                crate::realms::SettleSeason { selected_realm: Some(711), aspect: None },
            ),
            360,
        ),
    );
    let home = found(d, game_id);
    start_cheat_caller_address(d.games, authority());
    assert!(ledger(d).register_entitlement(key, second).is_err());
    ledger(d).register_entitlement(key, first).unwrap();
    assert_eq!(ledger(d).entry_entitlement(key).unwrap(), Some(first));
    start_cheat_block_timestamp(d.games, 360);
    let grant = IHomeGrantsSafeDispatcher { contract_address: d.games }.grant_labor(home, 0, d.actor).unwrap();
    assert_eq!(grant.amount, if held_first {
        1000 * RESOURCE_PRECISION
    } else {
        2000 * RESOURCE_PRECISION
    });
    assert_eq!(grant.essence, if held_first {
        0
    } else {
        2000 * RESOURCE_PRECISION
    });
}

#[test]
#[feature("safe_dispatcher")]
fn a_held_realm_cannot_gain_a_campaign_reward_before_or_after_settlement() {
    refuses_a_second_source(true);
}

#[test]
#[feature("safe_dispatcher")]
fn an_interrupted_campaign_entry_cannot_switch_to_an_nft_and_can_resume() {
    refuses_a_second_source(false);
}

#[test]
#[feature("safe_dispatcher")]
fn campaign_tier_and_id_are_fixed_and_malformed_tickets_do_not_lock_entry() {
    let (d, game_id) = super::registrar::setup_open_frontier_preset("devcon", 3);
    set_operator(d, authority());
    let key = EntryKey { game_id, owner: d.actor };
    let normal = ticket(crate::settlement::CAMPAIGN_NORMAL);
    start_cheat_caller_address(d.games, d.actor);
    assert!(ledger(d).register_entitlement(key, normal).is_err());
    start_cheat_caller_address(d.games, authority());
    for invalid in array![
        EntryEntitlement { realm_id: 711, ..normal }, EntryEntitlement { metadata_1: 0, ..normal },
        EntryEntitlement { metadata_2: 0, ..normal }, EntryEntitlement { metadata_2: 3, ..normal },
        EntryEntitlement { metadata_3: 1, ..normal },
    ] {
        assert!(ledger(d).register_entitlement(key, invalid).is_err());
        assert!(ledger(d).entry_entitlement(key).unwrap().is_none());
    }
    ledger(d).register_entitlement(key, normal).unwrap();
    assert!(ledger(d).register_entitlement(key, ticket(crate::settlement::CAMPAIGN_GOLDEN)).is_err());
    assert!(ledger(d).register_entitlement(key, EntryEntitlement { metadata_1: 'other', ..normal }).is_err());
    found(d, game_id);
}

#[test]
#[feature("safe_dispatcher")]
fn founded_free_homes_gain_one_campaign_source_without_changing_existing_claims() {
    for (tier, amount) in array![
        (crate::settlement::CAMPAIGN_NORMAL, 1000_u128), (crate::settlement::CAMPAIGN_GOLDEN, 2000_u128),
    ] {
        let (d, home) = campaign_home("devcon", crate::settlement::CAMPAIGN_NORMAL);
        let operator = IHomeGrantsSafeDispatcher { contract_address: d.games };
        let previous = operator.grant_labor(home, 0, d.actor).unwrap();
        let other = super::bind_authority(d);
        let free = found(other, home.game_id);
        let key = EntryKey { game_id: home.game_id, owner: other.actor };
        let resource = ResourceKey { game_id: free.game_id, entity_id: free.home };
        let before = interact_with_state(d.games, || crate::logic::structures::record(resource));
        let labor = balance(d, free, LABOR);
        let essence = balance(d, free, ESSENCE);
        start_cheat_caller_address(d.games, authority());
        assert!(operator.grant_labor(free, 0, other.actor).is_err());
        assert!(ledger(d).register_entitlement(key, EntryEntitlement { metadata_2: 3, ..ticket(tier) }).is_err());
        assert!(ledger(d).entry_entitlement(key).unwrap().is_none());
        let mut events = spy_events();
        ledger(d).register_entitlement(key, ticket(tier)).unwrap();
        let emitted = events.get_events().emitted_by(d.games);
        assert_eq!(emitted.events.len(), 2);
        let (_, campaign) = emitted.events.at(0);
        assert_eq!(*campaign.keys.at(campaign.keys.len() - 1), 'CampaignHome');
        assert_eq!(
            campaign.data.span(),
            array![2, free.game_id.into(), free.home.into(), 2, 'devcon-2026', tier.into()].span(),
        );
        let (_, entitlement) = emitted.events.at(1);
        assert_eq!(*entitlement.keys.at(entitlement.keys.len() - 1), 'EntryEntitlement');
        assert_eq!(ledger(d).entry_entitlement(key).unwrap(), Some(ticket(tier)));
        assert_eq!(interact_with_state(d.games, || crate::logic::structures::record(resource)), before);
        assert_eq!(balance(d, free, LABOR), labor);
        assert_eq!(balance(d, free, ESSENCE), essence);
        assert_eq!(operator.labor_grant(home, 0).unwrap(), Some(previous));
        let grant = operator.grant_labor(free, 0, other.actor).unwrap();
        assert_eq!(grant.amount, amount * RESOURCE_PRECISION);
        assert_eq!(grant.essence, amount * RESOURCE_PRECISION);
        let mut retry = spy_events();
        ledger(d).register_entitlement(key, ticket(tier)).unwrap();
        assert_eq!(operator.grant_labor(free, 0, other.actor).unwrap(), grant);
        assert_eq!(operator.grant_labor(home, 0, d.actor).unwrap(), previous);
        assert_eq!(retry.get_events().emitted_by(d.games).events.len(), 0);
        assert_eq!(balance(d, free, LABOR), labor + grant.amount);
        assert_eq!(balance(d, free, ESSENCE), essence + grant.essence);
        assert!(ledger(d).register_entitlement(key, EntryEntitlement { metadata_1: 'other', ..ticket(tier) }).is_err());
    }
}

#[feature("safe_dispatcher")]
fn full_labor_store_still_claims_essence(tier: u8, expected_essence: u128) {
    let (d, home) = campaign_home("devcon", tier);
    interact_with_state(
        d.games,
        || {
            crate::state::write()
                .resources
                .weights
                .write((home.game_id, home.home), crate::resources::Weight { capacity: 0, weight: 0 });
        },
    );
    let before = balance(d, home, ESSENCE);
    let operator = IHomeGrantsSafeDispatcher { contract_address: d.games };
    let grant = operator.grant_labor(home, 0, d.actor).unwrap();
    assert_eq!(grant.amount, 0);
    assert_eq!(grant.essence, expected_essence * RESOURCE_PRECISION);
    assert_eq!(balance(d, home, ESSENCE), before + grant.essence);
    assert_eq!(operator.grant_labor(home, 0, d.actor).unwrap(), grant);
    assert_eq!(balance(d, home, ESSENCE), before + grant.essence);
}

#[test]
#[feature("safe_dispatcher")]
fn a_regular_claim_records_essence_even_when_the_labor_store_is_full() {
    full_labor_store_still_claims_essence(crate::settlement::CAMPAIGN_NORMAL, 1000);
}

#[test]
#[feature("safe_dispatcher")]
fn a_golden_claim_records_essence_even_when_the_labor_store_is_full() {
    full_labor_store_still_claims_essence(crate::settlement::CAMPAIGN_GOLDEN, 2000);
}

#[test]
#[feature("safe_dispatcher")]
fn the_normal_speed_preset_does_not_pay_devcon_essence() {
    let (d, home) = campaign_home("frontier", crate::settlement::CAMPAIGN_GOLDEN);
    let grant = IHomeGrantsSafeDispatcher { contract_address: d.games }.grant_labor(home, 0, d.actor).unwrap();
    assert_eq!(grant.amount, 1000 * RESOURCE_PRECISION);
    assert_eq!(grant.essence, 0);
}

#[test]
#[feature("safe_dispatcher")]
fn campaign_entries_refuse_games_without_open_frontier_homes() {
    // The prepared Eternum game uses season-pass entry and has no Frontier home grant.
    let d = setup(true);
    set_operator(d, authority());
    start_cheat_caller_address(d.games, authority());
    assert!(ledger(d).register_entitlement(EntryKey { game_id: 1, owner: d.actor }, ticket(1)).is_err());
}


#[test]
#[feature("safe_dispatcher")]
fn partial_seasons_grant_once_per_actual_day_and_stop_at_the_end() {
    for hours in array![81_u64, 84, 85] {
        let (d, game_id) = super::registrar::setup_open_frontier_duration("devcon", hours * 3600);
        set_operator(d, authority());
        register(d, game_id, ticket(crate::settlement::CAMPAIGN_NORMAL));
        let home = found(d, game_id);
        let operator = IHomeGrantsSafeDispatcher { contract_address: d.games };
        let game = crate::game::IGameDispatcherTrait::game(
            crate::game::IGameDispatcher { contract_address: d.games }, game_id,
        );
        let last = crate::days::day_of(game, 7200, game.end_at - 1);
        assert_eq!(last.index, if hours == 81 {
            9
        } else {
            10
        });
        start_cheat_caller_address(d.games, authority());
        start_cheat_block_timestamp(d.games, last.start);
        let grant = operator.grant_labor(home, last.index, d.actor).unwrap();
        assert_eq!(grant.essence, 1000 * RESOURCE_PRECISION);
        let essence = balance(d, home, ESSENCE);
        start_cheat_block_timestamp(d.games, game.end_at - 1);
        assert_eq!(operator.grant_labor(home, last.index, d.actor).unwrap(), grant);
        assert!(operator.grant_labor(home, last.index + 1, d.actor).is_err());
        assert_eq!(balance(d, home, ESSENCE), essence);
        start_cheat_block_timestamp(d.games, game.end_at);
        assert!(operator.grant_labor(home, last.index + 1, d.actor).is_err());
    }
}

#[test]
#[should_panic(expected: "season does not end on a tick")]
fn a_partial_season_still_requires_an_aligned_end() {
    super::registrar::setup_open_frontier_duration("devcon", 85 * 3600 + 1);
}

#[test]
#[feature("safe_dispatcher")]
fn a_late_held_realm_keeps_the_home_and_grants_only_today_without_essence() {
    let (d, game_id) = super::registrar::setup_open_frontier_preset("devcon", 3);
    let other = super::bind_authority(d);
    set_operator(d, authority());
    let game = crate::game::IGameDispatcherTrait::game(
        crate::game::IGameDispatcher { contract_address: d.games }, game_id,
    );
    let boundary = crate::days::day_of(game, 7200, 360).end;
    let home = found_at(d, game_id, boundary - 1);
    let second = found_at(other, game_id, boundary - 1);
    start_cheat_block_timestamp(d.games, boundary);
    let key = ResourceKey { game_id, entity_id: home.home };
    let before = interact_with_state(d.games, || crate::logic::structures::record(key));
    let realm_id = if before.metadata.realm_id == 711 {
        712
    } else {
        711
    };
    let held = EntryEntitlement { realm_id, metadata_1: 0, metadata_2: 0, metadata_3: 0, pass_kind: 2 };
    let labor = balance(d, home, LABOR);
    let essence = balance(d, home, ESSENCE);
    register(d, game_id, held);
    assert_eq!(ledger(d).settled_realm(game_id, realm_id.try_into().unwrap()).unwrap(), home.home);
    assert_eq!(interact_with_state(d.games, || crate::logic::structures::record(key)), before);
    let operator = IHomeGrantsSafeDispatcher { contract_address: d.games };
    assert!(operator.labor_grant(home, 0).unwrap().is_none());
    assert_eq!(balance(d, home, LABOR), labor);
    assert_eq!(balance(d, home, ESSENCE), essence);
    assert!(ledger(d).register_entitlement(EntryKey { game_id, owner: other.actor }, held).is_err());
    assert!(ledger(d).entry_entitlement(EntryKey { game_id, owner: other.actor }).unwrap().is_none());
    assert!(operator.grant_labor(second, 1, other.actor).is_err());
    let grant = operator.grant_labor(home, 1, d.actor).unwrap();
    assert_eq!(grant.amount, 1000 * RESOURCE_PRECISION);
    assert_eq!(grant.essence, 0);
    let mut retry = spy_events();
    register(d, game_id, held);
    assert_eq!(operator.grant_labor(home, 1, d.actor).unwrap(), grant);
    assert_eq!(retry.get_events().emitted_by(d.games).events.len(), 0);
    assert!(ledger(d).register_entitlement(EntryKey { game_id, owner: d.actor }, ticket(1)).is_err());
}

#[test]
#[feature("safe_dispatcher")]
fn flyer_recovery_grants_missed_days_once_and_leaves_today_to_the_normal_claim() {
    for (tier, amount) in array![(1_u8, 1000_u128), (2_u8, 2000_u128)] {
        let (d, game_id) = super::registrar::setup_open_frontier_preset("devcon", 3);
        set_operator(d, authority());
        let game = crate::game::IGameDispatcherTrait::game(
            crate::game::IGameDispatcher { contract_address: d.games }, game_id,
        );
        let boundary = crate::days::day_of(game, 7200, 360).end;
        let home = found_at(d, game_id, boundary - 1);
        let labor = balance(d, home, LABOR);
        let essence = balance(d, home, ESSENCE);
        let resource = ResourceKey { game_id, entity_id: home.home };
        let before = interact_with_state(d.games, || crate::logic::structures::record(resource));
        let production = interact_with_state(d.games, || crate::logic::resources::production(resource, LABOR));
        start_cheat_block_timestamp(d.games, boundary);
        let recovery = EntryEntitlement { metadata_3: 'devcon-recovery', ..ticket(tier) };
        register(d, game_id, recovery);
        let operator = IHomeGrantsSafeDispatcher { contract_address: d.games };
        let grant = operator.labor_grant(home, 0).unwrap().unwrap();
        assert_eq!(grant.amount, amount * RESOURCE_PRECISION);
        assert_eq!(grant.essence, amount * RESOURCE_PRECISION);
        assert_eq!(balance(d, home, LABOR), labor + production.production_rate.into() + grant.amount);
        assert_eq!(balance(d, home, ESSENCE), essence + grant.essence);
        assert_eq!(interact_with_state(d.games, || crate::logic::structures::record(resource)), before);
        assert!(operator.labor_grant(home, 1).unwrap().is_none());
        let mut retry = spy_events();
        register(d, game_id, recovery);
        assert_eq!(retry.get_events().emitted_by(d.games).events.len(), 0);
        let today = operator.grant_labor(home, 1, d.actor).unwrap();
        assert_eq!(today.essence, amount * RESOURCE_PRECISION);
        assert_eq!(balance(d, home, ESSENCE), essence + 2 * amount * RESOURCE_PRECISION);
    }
}

#[test]
#[feature("safe_dispatcher")]
fn recovery_resumes_a_drawn_ticket_without_repaying_claimed_days_and_obeys_storage_limits() {
    let (d, game_id) = super::registrar::setup_open_frontier_preset("devcon", 3);
    set_operator(d, authority());
    let home = found(d, game_id);
    register(d, game_id, ticket(2));
    let operator = IHomeGrantsSafeDispatcher { contract_address: d.games };
    let original = operator.grant_labor(home, 0, d.actor).unwrap();
    let game = crate::game::IGameDispatcherTrait::game(
        crate::game::IGameDispatcher { contract_address: d.games }, game_id,
    );
    let tomorrow = crate::days::day_of(game, 7200, 360).end;
    let day_two = crate::days::day_of(game, 7200, tomorrow).end;
    start_cheat_block_timestamp(d.games, day_two);
    let before = balance(d, home, ESSENCE);
    register(d, game_id, EntryEntitlement { metadata_3: 'devcon-recovery', ..ticket(2) });
    assert_eq!(operator.labor_grant(home, 0).unwrap(), Some(original));
    let recovered = operator.labor_grant(home, 1).unwrap().unwrap();
    assert_eq!(recovered.amount, 0);
    assert_eq!(recovered.essence, 2000 * RESOURCE_PRECISION);
    assert_eq!(balance(d, home, LABOR), 6000 * RESOURCE_PRECISION);
    assert_eq!(balance(d, home, ESSENCE), before + recovered.essence);
    assert!(operator.labor_grant(home, 2).unwrap().is_none());
}

#[test]
#[feature("safe_dispatcher")]
fn recovery_requires_a_founded_devcon_home_and_pays_nothing_for_today() {
    let (d, game_id) = super::registrar::setup_open_frontier_preset("devcon", 3);
    set_operator(d, authority());
    start_cheat_caller_address(d.games, authority());
    let key = EntryKey { game_id, owner: d.actor };
    let recovery = EntryEntitlement { metadata_3: 'devcon-recovery', ..ticket(1) };
    assert!(ledger(d).register_entitlement(key, recovery).is_err());
    let home = found(d, game_id);
    let labor = balance(d, home, LABOR);
    let essence = balance(d, home, ESSENCE);
    start_cheat_caller_address(d.games, authority());
    assert!(ledger(d).register_entitlement(key, EntryEntitlement { metadata_1: 'other', ..recovery }).is_err());
    register(d, game_id, recovery);
    assert_eq!(balance(d, home, LABOR), labor);
    assert_eq!(balance(d, home, ESSENCE), essence);
    assert!(IHomeGrantsSafeDispatcher { contract_address: d.games }.labor_grant(home, 0).unwrap().is_none());
}

#[test]
#[feature("safe_dispatcher")]
fn an_ordinary_late_ticket_does_not_compensate_previous_days() {
    let (d, game_id) = super::registrar::setup_open_frontier_preset("devcon", 3);
    set_operator(d, authority());
    let home = found(d, game_id);
    let game = crate::game::IGameDispatcherTrait::game(
        crate::game::IGameDispatcher { contract_address: d.games }, game_id,
    );
    start_cheat_block_timestamp(d.games, crate::days::day_of(game, 7200, 360).end);
    let labor = balance(d, home, LABOR);
    let essence = balance(d, home, ESSENCE);
    register(d, game_id, ticket(2));
    let operator = IHomeGrantsSafeDispatcher { contract_address: d.games };
    assert!(operator.labor_grant(home, 0).unwrap().is_none());
    assert!(operator.labor_grant(home, 1).unwrap().is_none());
    assert_eq!(balance(d, home, LABOR), labor);
    assert_eq!(balance(d, home, ESSENCE), essence);
}

fn golden_upgrade() -> EntryEntitlement {
    EntryEntitlement { metadata_3: 'devcon-upgrade', ..ticket(crate::settlement::CAMPAIGN_GOLDEN) }
}

#[test_case(false)]
#[test_case(true)]
#[feature("safe_dispatcher")]
fn golden_upgrade_preserves_home_and_paid_claims_then_grants_prospectively(recovered: bool) {
    let (d, home) = campaign_home("devcon", crate::settlement::CAMPAIGN_NORMAL);
    if recovered {
        register(d, home.game_id, EntryEntitlement { metadata_3: 'devcon-recovery', ..ticket(1) });
    }
    let operator = IHomeGrantsSafeDispatcher { contract_address: d.games };
    let paid = operator.grant_labor(home, 0, d.actor).unwrap();
    assert_eq!(paid.amount, 1000 * RESOURCE_PRECISION);
    assert_eq!(paid.essence, 1000 * RESOURCE_PRECISION);
    let key = ResourceKey { game_id: home.game_id, entity_id: home.home };
    let before = interact_with_state(d.games, || crate::logic::structures::record(key));
    let labor = balance(d, home, LABOR);
    let essence = balance(d, home, ESSENCE);
    let mut events = spy_events();
    register(d, home.game_id, golden_upgrade());
    let emitted = events.get_events().emitted_by(d.games);
    assert_eq!(emitted.events.len(), 2);
    let (_, campaign) = emitted.events.at(0);
    assert_eq!(*campaign.keys.at(campaign.keys.len() - 1), 'CampaignHome');
    assert_eq!(campaign.data.span(), array![2, home.game_id.into(), home.home.into(), 2, 'devcon-2026', 2].span());
    assert_eq!(interact_with_state(d.games, || crate::logic::structures::record(key)), before);
    assert_eq!(balance(d, home, LABOR), labor);
    assert_eq!(balance(d, home, ESSENCE), essence);
    assert_eq!(operator.grant_labor(home, 0, d.actor).unwrap(), paid);
    let mut retry = spy_events();
    register(d, home.game_id, golden_upgrade());
    assert_eq!(retry.get_events().emitted_by(d.games).events.len(), 0);
    let entry = EntryKey { game_id: home.game_id, owner: d.actor };
    assert!(ledger(d).register_entitlement(entry, ticket(1)).is_err());
    assert!(
        ledger(d).register_entitlement(entry, EntryEntitlement { metadata_3: 'devcon-recovery', ..ticket(2) }).is_err(),
    );
    let game = crate::game::IGameDispatcherTrait::game(
        crate::game::IGameDispatcher { contract_address: d.games }, home.game_id,
    );
    let first_day = crate::days::day_of(game, 7200, 360);
    start_cheat_block_timestamp(d.games, first_day.end);
    let next = operator.grant_labor(home, 1, d.actor).unwrap();
    // The first day produces 1,814.4 on top of 3,000 stored; the golden claim fills the 6,000 limit.
    assert_eq!(next.amount, 11856 * RESOURCE_PRECISION / 10);
    assert_eq!(next.essence, 2000 * RESOURCE_PRECISION);
    assert_eq!(balance(d, home, LABOR), 6000 * RESOURCE_PRECISION);
    assert_eq!(balance(d, home, ESSENCE), essence + next.essence);
    assert_eq!(operator.grant_labor(home, 1, d.actor).unwrap(), next);
    assert_eq!(operator.labor_grant(home, 0).unwrap(), Some(paid));
    let second_day = crate::days::day_of(game, 7200, first_day.end);
    start_cheat_block_timestamp(d.games, second_day.end);
    let full = operator.grant_labor(home, 2, d.actor).unwrap();
    assert_eq!(full.amount, 0);
    assert_eq!(full.essence, 2000 * RESOURCE_PRECISION);
    assert_eq!(balance(d, home, LABOR), 6000 * RESOURCE_PRECISION);
    assert_eq!(balance(d, home, ESSENCE), essence + next.essence + full.essence);
    assert_eq!(operator.grant_labor(home, 2, d.actor).unwrap(), full);
}

#[test]
#[feature("safe_dispatcher")]
fn golden_upgrade_changes_an_unclaimed_day_without_recovering_missed_days() {
    let (d, home) = campaign_home("devcon", crate::settlement::CAMPAIGN_NORMAL);
    let game = crate::game::IGameDispatcherTrait::game(
        crate::game::IGameDispatcher { contract_address: d.games }, home.game_id,
    );
    start_cheat_block_timestamp(d.games, crate::days::day_of(game, 7200, 360).end);
    let labor = balance(d, home, LABOR);
    let essence = balance(d, home, ESSENCE);
    register(d, home.game_id, golden_upgrade());
    assert_eq!(balance(d, home, LABOR), labor);
    assert_eq!(balance(d, home, ESSENCE), essence);
    let operator = IHomeGrantsSafeDispatcher { contract_address: d.games };
    assert!(operator.labor_grant(home, 0).unwrap().is_none());
    assert!(
        ledger(d)
            .register_entitlement(
                EntryKey { game_id: home.game_id, owner: d.actor },
                EntryEntitlement { metadata_3: 'devcon-recovery', ..ticket(2) },
            )
            .is_err(),
    );
    assert!(operator.labor_grant(home, 0).unwrap().is_none());
    let today = operator.grant_labor(home, 1, d.actor).unwrap();
    assert_eq!(today.essence, 2000 * RESOURCE_PRECISION);
    assert_eq!(balance(d, home, ESSENCE), essence + today.essence);
}

#[test]
#[feature("safe_dispatcher")]
fn separate_regular_homes_can_both_upgrade_to_golden_and_claim_the_unpaid_day() {
    let (d, game_id) = super::registrar::setup_open_frontier_preset("devcon", 3);
    let other = super::bind_authority(d);
    set_operator(d, authority());
    for player in array![d, other] {
        register(player, game_id, ticket(1));
        let home = found(player, game_id);
        register(player, game_id, golden_upgrade());
        let operator = IHomeGrantsSafeDispatcher { contract_address: d.games };
        let grant = operator.grant_labor(home, 0, player.actor).unwrap();
        assert_eq!(grant.amount, 2000 * RESOURCE_PRECISION);
        assert_eq!(grant.essence, 2000 * RESOURCE_PRECISION);
        assert_eq!(
            ledger(d).entry_entitlement(EntryKey { game_id, owner: player.actor }).unwrap(), Some(golden_upgrade()),
        );
    }
}

#[test]
#[feature("safe_dispatcher")]
fn golden_upgrade_refuses_unfounded_free_held_wrong_campaign_and_closed_homes() {
    for case in 0_u8..9 {
        let (d, game_id) = super::registrar::setup_open_frontier_preset("devcon", 3);
        set_operator(d, authority());
        let entry = EntryKey { game_id, owner: d.actor };
        start_cheat_caller_address(d.games, authority());
        assert!(ledger(d).register_entitlement(entry, golden_upgrade()).is_err());
        if case == 1 {
            found(d, game_id);
        } else {
            let source = if case == 2 {
                EntryEntitlement { realm_id: 711, pass_kind: 2, metadata_1: 0, metadata_2: 0, metadata_3: 0 }
            } else if case == 3 {
                EntryEntitlement { metadata_1: 'other', ..ticket(1) }
            } else {
                ticket(1)
            };
            register(d, game_id, source);
            if case != 0 {
                found(d, game_id);
            }
        }
        start_cheat_caller_address(d.games, authority());
        if case == 4 {
            let game = crate::game::IGameDispatcherTrait::game(
                crate::game::IGameDispatcher { contract_address: d.games }, game_id,
            );
            start_cheat_block_timestamp(d.games, game.end_at);
        }
        if case == 5 {
            start_cheat_caller_address(d.games, d.actor);
        }
        if case == 8 {
            interact_with_state(
                d.games,
                || {
                    let home = crate::entity_ids::home_for_actor(game_id, d.actor);
                    crate::state::write().structures.structures.entry((game_id, home)).owner.write(authority());
                },
            );
        }
        let upgrade = if case == 6 {
            EntryEntitlement { metadata_1: 'other', ..golden_upgrade() }
        } else if case == 7 {
            EntryEntitlement { realm_id: 711, ..golden_upgrade() }
        } else {
            golden_upgrade()
        };
        let previous = ledger(d).entry_entitlement(entry).unwrap();
        assert!(ledger(d).register_entitlement(entry, upgrade).is_err());
        assert_eq!(ledger(d).entry_entitlement(entry).unwrap(), previous);
    }
}
