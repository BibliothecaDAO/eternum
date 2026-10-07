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
    FallenRealm,
    Chest,
    Shrine,
    Well,
}

pub fn surface(
    config: MapConfig, seed: u256, timestamp: u64, distance: u128, hyperstructures: u32, mode_rules: u32,
) -> Discovery {
    if mode_rules & crate::rules::DISCOVER_HYPERSTRUCTURES != 0 {
        let hyper_success = hyperstructure_weight(config, distance, hyperstructures);
        let hyper_total: u128 = config.hyps_win_prob.into() + config.hyps_fail_prob.into();
        if lottery(seed, 1, hyper_success, hyper_total - hyper_success, timestamp) {
            return Discovery::Hyperstructure;
        }
    }
    if lottery(
        seed, 2, config.shards_mines_win_probability.into(), config.shards_mines_fail_probability.into(), timestamp,
    ) {
        return Discovery::Mine;
    }
    if mode_rules & crate::rules::DISCOVER_CAMPS != 0
        && lottery(seed, 7, config.camp_win_probability.into(), config.camp_fail_probability.into(), timestamp) {
        return Discovery::Camp;
    }
    Discovery::None
}

pub fn ethereal(config: MapConfig, enabled: bool, spire_adjacent: bool, seed: u256, timestamp: u64) -> Discovery {
    if enabled
        && !spire_adjacent
        && lottery(
            seed,
            10,
            config.bitcoin_mine_win_probability.into(),
            config.bitcoin_mine_fail_probability.into(),
            timestamp,
        ) {
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

pub fn validate_frontier(rules: crate::expeditions::FrontierDiscoveryRules) {
    let sites: u32 = Into::<u16, u32>::into(rules.camp_bps) + rules.rift_bps.into() + rules.fallen_realm_bps.into();
    assert!(sites != 0 && rules.empty_reveal_limit != 0, "empty discovery floor");
    // Every Scouting tier on one kind doubles its rate: the larger of camp and rift is the most it can add.
    let scouting_reserve: u32 = core::cmp::max(rules.camp_bps, rules.rift_bps).into();
    assert!(
        sites
            + scouting_reserve
            + rules.loose_chest_bps.into()
            + rules.shrine_bps.into()
            + rules.well_bps.into() <= 10000,
        "discovery odds exceed 100 percent",
    );
}

/// A reveal's draw. Scouting raises camp and rift by its bonuses, in basis points of each base rate.
pub fn frontier(
    rules: crate::expeditions::FrontierDiscoveryRules,
    camp_bonus_bps: u32,
    rift_bonus_bps: u32,
    empty_reveals: u8,
    seed: u256,
    timestamp: u64,
) -> Discovery {
    let camp: u128 = Into::<u16, u128>::into(rules.camp_bps) * (10000 + camp_bonus_bps.into()) / 10000;
    let rift: u128 = Into::<u16, u128>::into(rules.rift_bps) * (10000 + rift_bonus_bps.into()) / 10000;
    let fallen: u128 = rules.fallen_realm_bps.into();
    let shrine: u128 = rules.shrine_bps.into();
    let well: u128 = rules.well_bps.into();
    let floor = empty_reveals >= rules.empty_reveal_limit;
    let mut draw = crate::random::range(
        seed, Into::<u64, u128>::into(timestamp) + 29, if floor {
            camp + rift + fallen + shrine + well
        } else {
            10000
        },
    );
    if !floor {
        let chest: u128 = rules.loose_chest_bps.into();
        if draw < chest {
            return Discovery::Chest;
        }
        draw -= chest;
    }
    if draw < camp {
        return Discovery::Camp;
    }
    if draw < camp + rift {
        return Discovery::Mine;
    }
    if draw < camp + rift + fallen {
        return Discovery::FallenRealm;
    }
    if draw < camp + rift + fallen + shrine {
        return Discovery::Shrine;
    }
    if draw < camp + rift + fallen + shrine + well {
        return Discovery::Well;
    }
    Discovery::None
}

pub fn tile_occupier(discovery: Discovery) -> Option<u8> {
    match discovery {
        Discovery::Chest => Some(crate::taxonomy::CHEST_OCCUPIER),
        Discovery::Shrine => Some(crate::taxonomy::SHRINE_OCCUPIER),
        Discovery::Well => Some(crate::taxonomy::WELL_OCCUPIER),
        _ => None,
    }
}
