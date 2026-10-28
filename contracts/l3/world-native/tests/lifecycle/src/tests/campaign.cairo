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
    assert!(
        super::resource_commands::execute_in_game(
            d,
            game_id,
            crate::commands::Command::SettleSeason(crate::realms::SettleSeason { selected_realm: None }),
            360,
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
    let operator = ILedgerOperatorSafeDispatcher { contract_address: d.games };
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
    assert_eq!(crate::days::season_days(game.end_at - game.start_main_at, unit), 10);
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
            crate::commands::Command::SettleSeason(crate::realms::SettleSeason { selected_realm: Some(711) }),
            360,
        ),
    );
    let home = found(d, game_id);
    start_cheat_caller_address(d.games, authority());
    assert!(ledger(d).register_entitlement(key, second).is_err());
    ledger(d).register_entitlement(key, first).unwrap();
    assert_eq!(ledger(d).entry_entitlement(key).unwrap(), Some(first));
    start_cheat_block_timestamp(d.games, 360);
    let grant = ILedgerOperatorSafeDispatcher { contract_address: d.games }.grant_labor(home, 0, d.actor).unwrap();
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
fn a_free_home_cannot_become_a_campaign_home_after_founding() {
    let (d, home) = campaign_home("devcon", crate::settlement::CAMPAIGN_NORMAL);
    let other = super::bind_authority(d);
    let free = found(other, home.game_id);
    start_cheat_caller_address(d.games, authority());
    assert!(ledger(d).register_entitlement(EntryKey { game_id: home.game_id, owner: other.actor }, ticket(2)).is_err());
    assert!(ILedgerOperatorSafeDispatcher { contract_address: d.games }.grant_labor(free, 0, other.actor).is_err());
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
    let operator = ILedgerOperatorSafeDispatcher { contract_address: d.games };
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
    let grant = ILedgerOperatorSafeDispatcher { contract_address: d.games }.grant_labor(home, 0, d.actor).unwrap();
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
