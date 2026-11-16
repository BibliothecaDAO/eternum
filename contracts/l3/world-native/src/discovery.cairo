use eternum_cubit::f128::types::fixed::FixedTrait;
use crate::random::lottery;
use crate::rules::MapConfig;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum Discovery {
    None,
    Mine,
    Hyperstructure,
    BitcoinMine,
    Camp,
    Rift,
    Ruin: crate::army_relics::ArmyRelic,
    Beasts,
    Shrine,
    Well,
    Spire,
    Chest,
}

// One reveal in two hundred, in basis points, when spire discovery is on.
pub const SPIRE_FIND_BPS: u128 = 50;


pub fn surface(config: MapConfig, seed: u256, distance: u128, hyperstructures: u32, mode_rules: u32) -> Discovery {
    if mode_rules & crate::rules::DISCOVER_SPIRES != 0 && lottery(seed, 3, SPIRE_FIND_BPS, 10000 - SPIRE_FIND_BPS) {
        return Discovery::Spire;
    }
    if mode_rules & crate::rules::DISCOVER_HYPERSTRUCTURES != 0 {
        let hyper_success = hyperstructure_weight(config, distance, hyperstructures);
        let hyper_total: u128 = config.hyps_win_prob.into() + config.hyps_fail_prob.into();
        if lottery(seed, 1, hyper_success, hyper_total - hyper_success) {
            return Discovery::Hyperstructure;
        }
    }
    if lottery(seed, 2, config.shards_mines_win_probability.into(), config.shards_mines_fail_probability.into()) {
        return Discovery::Mine;
    }
    if mode_rules & crate::rules::DISCOVER_CAMPS != 0
        && lottery(seed, 7, config.camp_win_probability.into(), config.camp_fail_probability.into()) {
        return Discovery::Camp;
    }
    Discovery::None
}

pub fn ethereal(config: MapConfig, enabled: bool, spire_adjacent: bool, seed: u256) -> Discovery {
    if enabled
        && !spire_adjacent
        && lottery(seed, 10, config.bitcoin_mine_win_probability.into(), config.bitcoin_mine_fail_probability.into()) {
        Discovery::BitcoinMine
    } else {
        Discovery::None
    }
}

fn hyperstructure_weight(config: MapConfig, distance: u128, hyperstructures: u32) -> u128 {
    let initial = FixedTrait::new(config.hyps_win_prob.into(), false);
    let radius = FixedTrait::new(config.hyps_fail_prob_increase_p_hex.into(), false) / FixedTrait::new(10000, false);
    let weighted = (initial * radius.pow(FixedTrait::new_unscaled(distance, false))).mag;
    let penalty: u128 = hyperstructures.into() * config.hyps_fail_prob_increase_p_fnd.into();
    weighted - core::cmp::min(weighted, penalty)
}

pub fn validate_frontier(rules: crate::expeditions::FrontierDiscoveryRules, find_percent: u16) {
    // The floor must find a guarded site even when a draw has no ruin reward.
    let guarded: u32 = Into::<u16, u32>::into(rules.beasts_bps) + rules.camp_bps.into() + rules.rift_bps.into();
    assert!(guarded != 0 && rules.empty_reveal_limit != 0, "empty discovery floor");
    assert!(
        Into::<u32, u128>::into(guarded + rules.ruin_bps.into() + rules.shrine_bps.into() + rules.well_bps.into())
            * find_percent.into() <= 1000000,
        "discovery odds exceed 100 percent",
    );
}

// One categorical draw per reveal. After `empty_reveal_limit` empty reveals in a row the draw covers only the kinds
// still allowed. Each ruin carries its relic from discovery until the winning army clears it.
pub fn frontier(
    rules: crate::expeditions::FrontierDiscoveryRules,
    find_percent: u16,
    empty_reveals: u8,
    ruin: Option<crate::army_relics::ArmyRelic>,
    seed: u256,
) -> Discovery {
    let camp: u128 = rules.camp_bps.into();
    let rift: u128 = rules.rift_bps.into();
    let shrine: u128 = rules.shrine_bps.into();
    let well: u128 = rules.well_bps.into();
    let (ruin_kind, ruin_weight): (Discovery, u128) = match ruin {
        Some(reward) => (Discovery::Ruin(reward), rules.ruin_bps.into()),
        None => (Discovery::None, 0),
    };
    let kinds = array![
        (Discovery::Beasts, rules.beasts_bps.into()), (Discovery::Camp, camp), (Discovery::Rift, rift),
        (ruin_kind, ruin_weight), (Discovery::Shrine, shrine), (Discovery::Well, well),
    ];
    let mut total: u128 = 0;
    for (_, weight) in kinds.span() {
        total += *weight * find_percent.into() / 100;
    }
    let floor = empty_reveals >= rules.empty_reveal_limit;
    let mut draw = crate::random::range(seed, 29, if floor {
        total
    } else {
        10000
    });
    for (kind, base) in kinds {
        let weight = base * find_percent.into() / 100;
        if draw < weight {
            return kind;
        }
        draw -= weight;
    }
    Discovery::None
}

pub fn tile_occupier(discovery: Discovery) -> Option<u8> {
    match discovery {
        Discovery::Spire => Some(crate::taxonomy::DORMANT_SPIRE_OCCUPIER),
        Discovery::Chest => Some(crate::taxonomy::CHEST_OCCUPIER),
        _ => None,
    }
}


#[starknet::interface]
pub trait IExpeditionReveal<T> {
    fn reveal_expedition_tile(
        ref self: T, key: crate::map::TileKey, explorer_id: u64, seed: u256, context: crate::commands::ActionContext,
    ) -> Discovery;
}
