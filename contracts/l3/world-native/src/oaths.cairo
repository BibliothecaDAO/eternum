use eternum_cubit::f128::types::fixed::{Fixed, FixedTrait};
use crate::progression::ArmyProgress;

pub const GIANTS: u8 = 1;
pub const PERFECTION: u8 = 2;
pub const RAGE: u8 = 3;
pub const FOX: u8 = 4;
pub const TWINS: u8 = 5;
pub const FURY: u8 = 6;
pub const REFLECTION: u8 = 7;
pub const DETECTION: u8 = 8;
pub const SKILL: u8 = 9;
pub const BRILLIANCE: u8 = 10;
pub const PROTECTION: u8 = 11;
pub const POWER: u8 = 12;
pub const TITANS: u8 = 13;
pub const VITRIOL: u8 = 14;
pub const ANGER: u8 = 15;
pub const ENLIGHTENMENT: u8 = 16;
pub const RED: u16 = 11537;
pub const BLUE: u16 = 53288;
pub const GOLD: u16 = 710;
pub const VITRIOL_LOSS_PER_TICK: u16 = 100;
pub const PASS_STAMINA: u16 = 20;
pub const POWER_DAMAGE_PERCENT: u16 = 20;
pub const GIANTS_REDUCTION_PERCENT: u16 = 15;
pub const PROTECTION_REDUCTION_PERCENT: u16 = 25;
pub const REFLECTION_WELL_PERCENT: u8 = 80;
pub const DETECTION_FIND_PERCENT: u16 = 120;
pub const BRILLIANCE_PAY_PERCENT: u16 = 125;
pub const RAGE_PAY_PERCENT: u16 = 125;

pub fn damage_multiplier(attacker: u16, defender: u16, guarding: bool) -> Fixed {
    let mut multiplier = FixedTrait::ONE();
    if held(attacker, POWER) {
        multiplier *= FixedTrait::new((100 + POWER_DAMAGE_PERCENT).into(), false) / FixedTrait::new(100, false);
    }
    if held(defender, GIANTS) {
        multiplier *= FixedTrait::new((100 - GIANTS_REDUCTION_PERCENT).into(), false) / FixedTrait::new(100, false);
    }
    if guarding && held(defender, PROTECTION) {
        multiplier *= FixedTrait::new((100 - PROTECTION_REDUCTION_PERCENT).into(), false) / FixedTrait::new(100, false);
    }
    multiplier
}

pub fn deep_loss_per_tick(oaths: u16, base: u128) -> u128 {
    if held(oaths, VITRIOL) {
        VITRIOL_LOSS_PER_TICK.into() * crate::rules::RESOURCE_PRECISION
    } else {
        base
    }
}

pub fn find_percent(oaths: u16, base: u16) -> u16 {
    if held(oaths, DETECTION) {
        base * DETECTION_FIND_PERCENT / 100
    } else {
        base
    }
}

pub fn reveal_pay(oaths: u16, amount: u128) -> u128 {
    if held(oaths, BRILLIANCE) {
        amount * BRILLIANCE_PAY_PERCENT.into() / 100
    } else {
        amount
    }
}

pub fn site_pay(oaths: u16, amount: u128) -> u128 {
    if held(oaths, RAGE) {
        amount * RAGE_PAY_PERCENT.into() / 100
    } else {
        amount
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ChooseOath {
    pub explorer_id: u64,
    pub expected_pick: u16,
    pub oath: Option<u8>,
    pub replace: Option<u8>,
}

#[starknet::interface]
pub trait IOaths<T> {
    fn choose_oath(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: ChooseOath,
        context: crate::commands::ActionContext,
    );
    fn offer_oaths(ref self: T, key: crate::troops::ExplorerKey, coord: crate::troops::Coord, seed: u256);
}

pub fn bit(oath: u8) -> u16 {
    assert!(oath >= 1 && oath <= 16, "invalid oath");
    let mut value = 1;
    for _ in 1_u8..oath {
        value *= 2;
    }
    value
}

pub fn well_stamina(oaths: u16, maximum: u64) -> u64 {
    let percent = if held(oaths, REFLECTION) {
        REFLECTION_WELL_PERCENT
    } else {
        crate::rules::WELL_REFILL_PERCENT
    };
    maximum * percent.into() / 100
}

pub fn held(oaths: u16, oath: u8) -> bool {
    oaths & bit(oath) != 0
}

pub fn count(oaths: u16) -> u8 {
    let mut total = 0;
    for oath in 1_u8..17 {
        if held(oaths, oath) {
            total += 1;
        }
    }
    total
}

pub fn card(pick: u16, index: u8) -> u8 {
    assert!(pick != 0 && index < 3, "missing oath card");
    let scale = match index {
        0 => 1,
        1 => 16,
        _ => 256,
    };
    (pick / scale % 16 + 1).try_into().unwrap()
}

pub fn draw(oaths: u16, seed: u256) -> u16 {
    let mut choices = 65535 ^ oaths;
    let mut pick = 0;
    let mut scale = 1;
    let mut drawn: u16 = 0;
    for index in 0_u8..3 {
        let left = count(choices);
        if left == 0 && index == 0 {
            return 0;
        }
        if left != 0 {
            let random: u256 = core::poseidon::poseidon_hash_span(
                array!['oath', seed.low.into(), seed.high.into(), index.into()].span(),
            )
                .into();
            let mut skip: u8 = (random % left.into()).try_into().unwrap();
            for oath in 1_u8..17 {
                if held(choices, oath) {
                    if skip == 0 {
                        drawn = (oath - 1).into();
                        choices -= bit(oath);
                        break;
                    }
                    skip -= 1;
                }
            }
        }
        pick += drawn * scale;
        scale *= 16;
    }
    pick
}

pub fn choose(progress: ArmyProgress, command: ChooseOath) -> ArmyProgress {
    assert!(progress.oath_pick != 0 && progress.oath_pick == command.expected_pick, "oath pick changed");
    let mut oaths = progress.oaths;
    if let Some(oath) = command.oath {
        assert!(
            oath == card(progress.oath_pick, 0)
                || oath == card(progress.oath_pick, 1)
                || oath == card(progress.oath_pick, 2),
            "oath not offered",
        );
        assert!(!held(oaths, oath), "oath already held");
        if count(oaths) == progress.oath_slots {
            let replaced = command.replace.expect('choose oath to replace');
            assert!(held(oaths, replaced), "replacement not held");
            oaths -= bit(replaced);
        } else {
            assert!(command.replace.is_none(), "empty oath slot available");
        }
        oaths += bit(oath);
    } else {
        assert!(command.replace.is_none(), "decline cannot replace");
    }
    assert!(count(oaths) <= progress.oath_slots, "too many oaths");
    ArmyProgress { oaths, oath_pick: 0, ..progress }
}
