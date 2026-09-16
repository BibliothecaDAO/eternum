use eternum_cubit::f128::types::fixed::FixedTrait;
use crate::random::lottery;
use crate::rules::MapConfig;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum Discovery {
    None,
    Mine,
    Hyperstructure,
    BitcoinMine,
}

pub fn surface(
    config: MapConfig, seed: u256, timestamp: u64, distance: u128, hyperstructures: u32, reserved: bool,
) -> Discovery {
    if reserved {
        return Discovery::None;
    }
    let hyper_success = hyperstructure_weight(config, distance, hyperstructures);
    let hyper_total: u128 = config.hyps_win_prob.into() + config.hyps_fail_prob.into();
    if lottery(seed, 1, hyper_success, hyper_total - hyper_success, timestamp) {
        return Discovery::Hyperstructure;
    }
    if lottery(
        seed, 2, config.shards_mines_win_probability.into(), config.shards_mines_fail_probability.into(), timestamp,
    ) {
        return Discovery::Mine;
    }
    // The pinned season rules skip camps before rolling and retain the agent lottery.
    if lottery(seed, 3, config.agent_discovery_prob.into(), config.agent_discovery_fail_prob.into(), timestamp) {
        panic!("unsupported agent discovery");
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
