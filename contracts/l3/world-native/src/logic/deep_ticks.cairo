use core::dict::Felt252Dict;
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::commands::ExecutionContext;
use crate::deep::{DeepShare, IDeepBanesDispatcherTrait};
use crate::logic::race::DeepRaceTrait;
use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};
use crate::troops::ExplorerKey;

#[derive(Copy, Drop)]
struct Guard {
    key: ExplorerKey,
    home: u64,
    loss: u128,
    end: u64,
}

#[derive(Copy, Drop)]
struct Site {
    kind: u8,
    aspect: u8,
    pay: u32,
    amount: u128,
    first: u32,
    last: u32,
}

#[derive(Copy, Drop)]
struct Held {
    sites: Span<Site>,
    guards: Span<Guard>,
    counts: Span<u128>,
    ticks: Span<u64>,
    glory: Span<u128>,
    contribution: Span<u128>,
    owed: Span<u128>,
    day_end: u64,
}

#[derive(Destruct)]
struct Payouts {
    race: crate::logic::race::DeepRace,
    altars: Felt252Dict<u32>,
    altar_threshold: u32,
    deaths: Array<u32>,
}

pub fn initialize(game_id: u32) {
    let state = crate::state::write();
    if state.deep.paid_tick.read(game_id).is_some() {
        return;
    }
    let tick = state.games.games.entry(game_id).start_main_at.read()
        / crate::balance::rules::TICK_CONFIG.armies_tick_in_seconds;
    save_cursor(game_id, tick);
}

#[cfg(feature: "blitz")]
pub fn settle(_game_id: u32, _context: ExecutionContext) {}

#[cfg(not(feature: "blitz"))]
pub fn settle(game_id: u32, context: ExecutionContext) {
    let game = context.game.unbox();
    if context.timestamp < game.start_main_at {
        return;
    }
    let interval = context.rules.unbox().tick_config.armies_tick_in_seconds;
    let end = crate::logic::race::result(game_id).map(|value| value.ended_at).unwrap_or(game.end_at);
    let last = core::cmp::min(context.timestamp, end) / interval;
    let cursor = crate::state::read().deep.paid_tick.read(game_id).expect('missing Deep cursor');
    if cursor < last && walk(game_id, cursor, last, context) < last {
        return;
    }
    crate::logic::race::finish_expired(game_id, context.timestamp);
    if crate::logic::race::result(game_id).is_none() && context.timestamp < game.end_at {
        roll_over(game_id, context);
    }
}

pub fn assert_caught_up(game_id: u32, context: ExecutionContext) {
    let interval = context.rules.unbox().tick_config.armies_tick_in_seconds;
    assert_paid_to(game_id, core::cmp::min(context.timestamp, context.game.unbox().end_at) / interval);
}

pub fn assert_paid_to(game_id: u32, tick: u64) {
    let cursor = crate::state::read().deep.paid_tick.read(game_id).expect('missing Deep cursor');
    assert!(cursor >= tick, "The Deep is catching up, try again in a moment");
}

fn walk(game_id: u32, cursor: u64, last: u64, context: ExecutionContext) -> u64 {
    let interval = context.rules.unbox().tick_config.armies_tick_in_seconds;
    let mut held = held(game_id, context);
    if held.guards.is_empty() {
        save_cursor(game_id, last);
        return last;
    }
    let mut payouts = payouts(game_id, (cursor + 1) * interval);
    let mut reached = cursor;
    let mut spent = 0;
    while reached < last {
        let boundary = (reached + 1) * interval;
        if boundary - 1 >= held.day_end {
            if reached > cursor {
                save_cursor(game_id, reached);
                write_payouts(game_id, ref payouts, held, reached * interval, context);
                return reached;
            }
            if !roll_over(game_id, context) {
                return reached;
            }
            save_cursor(game_id, last);
            return last;
        }
        let (drained, deaths) = drain(held, boundary, interval);
        let cost = alive_count(held.counts) + deaths.len().into() * crate::rules::DEEP_CATCH_UP_DEATH_TICKS;
        if reached > cursor && spent + cost > crate::rules::DEEP_CATCH_UP_GUARD_TICKS {
            break;
        }
        spent += cost;
        payouts.deaths.append_span(deaths);
        held = drained;
        reached += 1;
        if !alive(held.counts) {
            save_cursor(game_id, last);
            write_payouts(game_id, ref payouts, held, boundary, context);
            return last;
        }
        held = pay_sites(game_id, held, boundary, ref payouts);
        if payouts.race.finished() {
            break;
        }
    }
    save_cursor(game_id, reached);
    write_payouts(game_id, ref payouts, held, reached * interval, context);
    reached
}

fn held(game_id: u32, context: ExecutionContext) -> Held {
    let state = crate::state::read();
    let rules = crate::logic::deep_sites::rules();
    let unit = crate::balance::rules::SWITCHES.day_unit_seconds;
    let mut sites = array![];
    let mut guards = array![];
    let mut counts = array![];
    let mut ticks = array![];
    let mut zeros = array![];
    let mut day_end = 0;
    let open = crate::logic::deep_sites::open_by_kind(game_id);
    for index in 0..crate::logic::deep_sites::site_count() {
        let site_id = crate::logic::deep_sites::site_id(game_id, index);
        let site = crate::logic::deep_sites::site(ResourceKey { game_id, entity_id: site_id })
            .expect('missing Deep site');
        day_end = crate::days::day_at_index(context.game.unbox(), unit, site.day).end;
        let first = guards.len();
        for slot in 0..crate::rules::DEEP_GUARD_SLOTS {
            let explorer_id = state.deep.slots.read((game_id, site_id, slot));
            if explorer_id == 0 {
                continue;
            }
            let key = ExplorerKey { game_id, explorer_id };
            let army = crate::logic::troops::explorer(key).expect('missing Deep guard');
            assert!(army.troops.count != 0, "dead guard occupies Deep slot");
            let oaths = crate::logic::progression::require(key).oaths;
            guards
                .append(
                    Guard {
                        key,
                        home: army.owner,
                        loss: crate::oaths::deep_loss_per_tick(oaths, rules.loss_per_tick),
                        end: day_end,
                    },
                );
            counts.append(army.troops.count);
            ticks.append(state.deep.army_ticks.read((game_id, explorer_id)).expect('Deep army has no tick'));
            zeros.append(0);
        }
        if guards.len() == first {
            continue;
        }
        let holder: Guard = *guards.at(first);
        let aspect = crate::logic::aspects::home_aspect(ResourceKey { game_id, entity_id: holder.home });
        let (pay, amount) = if site.kind == crate::rules::DEEP_CORE {
            (0, rules.core_per_tick)
        } else if site.kind == crate::rules::DEEP_MINE {
            (0, rules.mine_per_tick)
        } else {
            (crate::deep::building_pay(rules.building_pay, *open.at(site.kind.into())), 0)
        };
        sites.append(Site { kind: site.kind, aspect, pay, amount, first, last: guards.len() });
    }
    let zeros = zeros.span();
    Held {
        sites: sites.span(),
        guards: guards.span(),
        counts: counts.span(),
        ticks: ticks.span(),
        glory: zeros,
        contribution: zeros,
        owed: zeros,
        day_end,
    }
}

fn payouts(game_id: u32, boundary: u64) -> Payouts {
    let altar_threshold = crate::logic::deep_sites::rules().altar_threshold;
    let mut altars: Felt252Dict<u32> = Default::default();
    for aspect in 1_u8..5 {
        altars.insert(aspect.into(), crate::state::read().banes.altar_bars.read((game_id, aspect)));
    }
    Payouts {
        race: crate::logic::race::DeepRaceTrait::load(game_id, boundary), altars, altar_threshold, deaths: array![],
    }
}

fn drain(held: Held, boundary: u64, interval: u64) -> (Held, Span<u32>) {
    let mut counts = array![];
    let mut ticks = array![];
    let mut deaths = array![];
    for index in 0..held.guards.len() {
        let guard = *held.guards.at(index);
        let before = *held.counts.at(index);
        let last_tick = *held.ticks.at(index);
        let tick = core::cmp::min(boundary, guard.end) / interval;
        if before == 0 || tick <= last_tick {
            counts.append(before);
            ticks.append(last_tick);
            continue;
        }
        let after = if tick == last_tick + 1 {
            if before > guard.loss {
                before - guard.loss
            } else {
                0
            }
        } else {
            crate::deep::troops_after_ticks(before, last_tick, tick, guard.loss)
        };
        if after == 0 {
            deaths.append(index);
        }
        counts.append(after);
        ticks.append(tick);
    }
    (Held { counts: counts.span(), ticks: ticks.span(), ..held }, deaths.span())
}

fn alive_count(counts: Span<u128>) -> u64 {
    let mut alive = 0;
    for count in counts {
        if *count != 0 {
            alive += 1;
        }
    }
    alive
}

fn alive(counts: Span<u128>) -> bool {
    for count in counts {
        if *count != 0 {
            return true;
        }
    }
    false
}

fn pay_sites(game_id: u32, held: Held, boundary: u64, ref payouts: Payouts) -> Held {
    let mut glory = array![];
    let mut contribution = array![];
    let mut owed = array![];
    for site in held.sites {
        let shares = shares(@held, *site);
        let (glories, contributions, payments) = if shares.is_empty() {
            (array![].span(), array![].span(), array![].span())
        } else if *site.kind == crate::rules::DEEP_CORE || *site.kind == crate::rules::DEEP_MINE {
            (array![].span(), array![].span(), crate::race::split_payment(*site.amount, shares))
        } else {
            let (glories, contributions) = payouts.race.pay(*site.kind, *site.aspect, shares, *site.pay, boundary);
            if *site.kind == crate::rules::DEEP_ALTAR {
                charge_altar(game_id, *site.aspect, *site.pay, boundary, ref payouts);
            }
            (glories, contributions, array![].span())
        };
        let mut share = 0;
        for index in *site.first..*site.last {
            let paid = *held.counts.at(index) != 0;
            glory.append(*held.glory.at(index) + share_of(glories, share, paid));
            contribution.append(*held.contribution.at(index) + share_of(contributions, share, paid));
            owed.append(*held.owed.at(index) + share_of(payments, share, paid));
            if paid {
                share += 1;
            }
        }
    }
    Held { glory: glory.span(), contribution: contribution.span(), owed: owed.span(), ..held }
}

fn share_of(amounts: Span<u128>, share: u32, paid: bool) -> u128 {
    if paid && share < amounts.len() {
        *amounts.at(share)
    } else {
        0
    }
}

fn shares(held: @Held, site: Site) -> Span<DeepShare> {
    let mut shares = array![];
    for index in site.first..site.last {
        let troops = *held.counts.at(index);
        if troops != 0 {
            shares.append(DeepShare { home: *held.guards.at(index).home, troops });
        }
    }
    shares.span()
}

fn charge_altar(game_id: u32, source: u8, amount: u32, boundary: u64, ref payouts: Payouts) {
    let threshold = payouts.altar_threshold;
    let charge = crate::deep::altar_charge(payouts.altars.get(source.into()), amount, threshold);
    let settled = if charge == threshold {
        bridge(game_id).settle_altar(game_id, source, charge, boundary, payouts.race.heights())
    } else {
        charge
    };
    payouts.altars.insert(source.into(), settled);
}

fn write_payouts(game_id: u32, ref payouts: Payouts, held: Held, boundary: u64, context: ExecutionContext) {
    for index in 0..held.guards.len() {
        payouts.race.credit((*held.guards.at(index)).home, *held.glory.at(index), *held.contribution.at(index));
    }
    payouts.race.flush();
    let heights = payouts.race.heights();
    for aspect in 1_u8..5 {
        let charge = payouts.altars.get(aspect.into());
        if charge != crate::state::read().banes.altar_bars.read((game_id, aspect)) {
            bridge(game_id).settle_altar(game_id, aspect, charge, boundary, heights);
        }
    }
    grant_resources(game_id, held, boundary, context);
    settle_guards(@payouts, held, boundary, context);
}

fn grant_resources(game_id: u32, held: Held, boundary: u64, context: ExecutionContext) {
    let mut owed: Felt252Dict<u128> = Default::default();
    let mut grants = array![];
    for site in held.sites {
        if *site.kind != crate::rules::DEEP_CORE && *site.kind != crate::rules::DEEP_MINE {
            continue;
        }
        let resource = if *site.kind == crate::rules::DEEP_CORE {
            crate::resources::ESSENCE
        } else {
            crate::resources::LABOR
        };
        for index in *site.first..*site.last {
            let amount = *held.owed.at(index);
            if amount == 0 {
                continue;
            }
            let home = (*held.guards.at(index)).home;
            let key: felt252 = home.into() * 256 + resource.into();
            if owed.get(key) == 0 {
                grants.append((home, resource));
            }
            owed.insert(key, owed.get(key) + amount);
        }
    }
    let resources = IResourceOperationsLibraryDispatcher {
        class_hash: crate::logic::release::class_of(game_id, crate::slots::RESOURCES),
    };
    let historical = ExecutionContext { timestamp: boundary - 1, ..context };
    for (home, resource) in grants.span() {
        let amount = owed.get((*home).into() * 256 + (*resource).into());
        resources
            .grant_resource(
                ResourceKey { game_id, entity_id: *home },
                *resource,
                amount,
                boundary,
                crate::commands::resource_context(historical),
            );
    }
}

fn settle_guards(payouts: @Payouts, held: Held, boundary: u64, context: ExecutionContext) {
    let context = ExecutionContext { timestamp: boundary, ..context };
    let deaths = payouts.deaths.span();
    let mut remaining = deaths.len();
    while remaining != 0 {
        remaining -= 1;
        settle_guard(held, *deaths.at(remaining), context);
    }
    for index in 0..held.guards.len() {
        if *held.counts.at(index) != 0 {
            settle_guard(held, index, context);
        }
    }
}

fn settle_guard(held: Held, index: u32, context: ExecutionContext) {
    let key = (*held.guards.at(index)).key;
    let army = crate::logic::troops::explorer(key).expect('missing Deep guard');
    let army = crate::logic::army_slots::resolve(key, army, None);
    let before = army.troops.count;
    let count = *held.counts.at(index);
    if count == before {
        return;
    }
    let army = crate::troops::ExplorerTroops { troops: crate::troops::Troops { count, ..army.troops }, ..army };
    crate::logic::deep_armies::drained(key, army, before, *held.ticks.at(index), context);
}

fn roll_over(game_id: u32, context: ExecutionContext) -> bool {
    crate::deep::IDeepSitesDispatcherTrait::rollover_deep(
        crate::logic::deep_sites::dispatcher(game_id), game_id, crate::commands::action_context(context),
    )
}

fn bridge(game_id: u32) -> crate::deep::IDeepBanesLibraryDispatcher {
    let state = crate::state::read();
    crate::deep::IDeepBanesLibraryDispatcher {
        class_hash: crate::logic::release::release_class(state.game_releases.read(game_id), crate::slots::BRIDGE),
    }
}

fn save_cursor(game_id: u32, tick: u64) {
    crate::state::write().deep.paid_tick.write(game_id, Some(tick));
    crate::logic::map::MapState::emit(
        crate::logic::map::MapState::Event::RowSet(
            crate::events::RowSet {
                version: 1, model: 'DeepTick', keys: array![game_id.into()].span(), values: array![tick.into()].span(),
            },
        ),
    );
}
