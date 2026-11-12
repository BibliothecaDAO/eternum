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
    Ruin: crate::army_relics::RuinReward,
    Beasts,
    Shrine,
    Well,
    Spire,
    Chest,
}

// One reveal in two hundred, in basis points, when spire discovery is on.
pub const SPIRE_FIND_BPS: u128 = 50;

pub const FRONTIER_CHEST_FIND_BPS: u128 = 5;

pub fn frontier_chest(seed: u256) -> bool {
    crate::random::range(seed, 0x46524f4e544945525f4348455354, 10000) < FRONTIER_CHEST_FIND_BPS
}

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

// All Scouting tiers on one kind double its base rate: reserve the largest increase among the three choices.
pub fn validate_frontier(rules: crate::expeditions::FrontierDiscoveryRules) {
    // The floor must find something on a depth whose daily ruin is already taken.
    let guarded: u32 = Into::<u16, u32>::into(rules.beasts_bps) + rules.camp_bps.into() + rules.rift_bps.into();
    assert!(guarded != 0 && rules.empty_reveal_limit != 0, "empty discovery floor");
    let sanctuaries: u32 = Into::<u16, u32>::into(rules.shrine_bps) + rules.well_bps.into();
    let reserve: u32 = core::cmp::max(sanctuaries, core::cmp::max(rules.camp_bps, rules.rift_bps).into());
    assert!(
        guarded + rules.ruin_bps.into() + reserve + rules.shrine_bps.into() + rules.well_bps.into() <= 10000,
        "discovery odds exceed 100 percent",
    );
}

pub fn maximum_race_chance(rules: crate::expeditions::FrontierDiscoveryRules, find_percent: u16) -> u128 {
    let sites = crate::rules::BOON_MAX_STEPS * crate::rules::PATHS_SITE_STEP_BPS;
    let sanctuaries = crate::rules::BOON_MAX_STEPS * crate::rules::PATHS_SANCTUARY_STEP_BPS;
    modified_weight(rules.beasts_bps, 0, find_percent)
        + modified_weight(rules.camp_bps, sites, find_percent)
        + modified_weight(rules.rift_bps, sites, find_percent)
        + modified_weight(rules.ruin_bps, 0, find_percent)
        + modified_weight(rules.shrine_bps, sanctuaries, find_percent)
        + modified_weight(rules.well_bps, sanctuaries, find_percent)
}

fn modified_weight(base: u16, bonus_bps: u32, percent: u16) -> u128 {
    Into::<u16, u128>::into(base) * (10000 + Into::<u32, u128>::into(bonus_bps)) * percent.into() / 1000000
}

// One categorical draw per reveal. After `empty_reveal_limit` empty reveals in a row the draw covers only the kinds
// still allowed. Ruins remain eligible until the realm clears one at that depth today; discovery never reserves their
// payout.
pub fn frontier(
    rules: crate::expeditions::FrontierDiscoveryRules,
    camp_bonus_bps: u32,
    rift_bonus_bps: u32,
    sanctuaries_bonus_bps: u32,
    find_percent: u16,
    empty_reveals: u8,
    ruin: Option<crate::army_relics::RuinReward>,
    seed: u256,
) -> Discovery {
    let camp = modified_weight(rules.camp_bps, camp_bonus_bps, find_percent);
    let rift = modified_weight(rules.rift_bps, rift_bonus_bps, find_percent);
    let shrine = modified_weight(rules.shrine_bps, sanctuaries_bonus_bps, find_percent);
    let well = modified_weight(rules.well_bps, sanctuaries_bonus_bps, find_percent);
    let (ruin_kind, ruin_weight): (Discovery, u128) = match ruin {
        Some(reward) => (Discovery::Ruin(reward), modified_weight(rules.ruin_bps, 0, find_percent)),
        None => (Discovery::None, 0),
    };
    let kinds = array![
        (Discovery::Beasts, modified_weight(rules.beasts_bps, 0, find_percent)), (Discovery::Camp, camp),
        (Discovery::Rift, rift), (ruin_kind, ruin_weight), (Discovery::Shrine, shrine), (Discovery::Well, well),
    ];
    let mut total: u128 = 0;
    for (_, weight) in kinds.span() {
        total += *weight;
    }
    assert!(total <= 10000, "discovery odds exceed 100 percent");
    let floor = empty_reveals >= rules.empty_reveal_limit;
    let mut draw = crate::random::range(seed, 29, if floor {
        total
    } else {
        10000
    });
    for (kind, weight) in kinds {
        if draw < weight {
            return kind;
        }
        draw -= weight;
    }
    Discovery::None
}

pub fn tile_occupier(discovery: Discovery) -> Option<u8> {
    match discovery {
        Discovery::Shrine => Some(crate::taxonomy::SHRINE_OCCUPIER),
        Discovery::Well => Some(crate::taxonomy::WELL_OCCUPIER),
        Discovery::Spire => Some(crate::taxonomy::DORMANT_SPIRE_OCCUPIER),
        Discovery::Chest => Some(crate::taxonomy::CHEST_OCCUPIER),
        _ => None,
    }
}

#[starknet::interface]
pub trait IDiscoveryRoll<T> {
    fn roll_expedition_discovery(
        ref self: T, key: crate::map::TileKey, explorer_id: u64, seed: u256, context: crate::commands::ActionContext,
    ) -> Discovery;
}
