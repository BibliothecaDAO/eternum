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
pub const VITRIOL_LOSS_PER_TICK: u16 = 100;
pub const PASS_STAMINA: u16 = 40;
pub const POWER_DAMAGE_PERCENT: u16 = 20;
pub const GIANTS_REDUCTION_PERCENT: u16 = 15;
pub const PROTECTION_REDUCTION_PERCENT: u16 = 25;
pub const REFLECTION_WELL_PERCENT: u8 = 80;
pub const DETECTION_EMPTY_REVEAL_LIMIT: u8 = 4;
pub const BRILLIANCE_PAY_PERCENT: u16 = 125;
pub const RAGE_PAY_PERCENT: u16 = 125;
pub const ANGER_ATTACK_STAMINA: u16 = 20;
pub const TITANS_STAMINA: u16 = 60;
pub const ENLIGHTENMENT_REGEN_BPS: u16 = 13334;
pub const FOX_REVEAL_DISCOUNT_PERCENT: u16 = 20;
pub const SKILL_DAMAGE_PERCENT: u16 = 30;
pub const SKILL_BELOW_STAMINA: u16 = 10;
pub const FURY_REFUND_PERCENT: u16 = 50;
pub const PERFECTION_PAY_PERCENT: u16 = 150;
pub const PERFECTION_LOSS_PERCENT: u16 = 15;
pub const TWINS_DAMAGE_PERCENT: u16 = 30;
pub const REROLLED: u16 = 4096;

#[inline(never)]
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

pub fn skill_multiplier(oaths: u16, bar_after_cost: u64) -> Fixed {
    if held(oaths, SKILL) && bar_after_cost < SKILL_BELOW_STAMINA.into() {
        FixedTrait::new((100 + SKILL_DAMAGE_PERCENT).into(), false) / FixedTrait::new(100, false)
    } else {
        FixedTrait::ONE()
    }
}

pub fn twin_damage(
    oaths: u16,
    companion: crate::troops::Troops,
    defender: crate::troops::Troops,
    context: crate::combat::CombatContext,
    stamina: crate::rules::TroopStaminaConfig,
    damage: crate::rules::TroopDamageConfig,
    tick_seconds: u64,
    cooldown_seconds: u32,
) -> u128 {
    if !held(oaths, TWINS) {
        return 0;
    }
    let mut twin = companion;
    let mut target = defender;
    let (dealt, _, _, _) = crate::combat::TroopsTrait::damage_with_context(
        ref twin,
        ref target,
        crate::combat::CombatContext { attacker_oaths: 0, ..context },
        crate::rules::TroopStaminaConfig { stamina_attack_req: 0, ..stamina },
        damage,
        tick_seconds,
        cooldown_seconds,
    );
    dealt * TWINS_DAMAGE_PERCENT.into() / 100 / crate::rules::RESOURCE_PRECISION * crate::rules::RESOURCE_PRECISION
}

pub fn fury_refund(oaths: u16, cost: u16) -> u64 {
    if held(oaths, FURY) {
        (cost * FURY_REFUND_PERCENT / 100).into()
    } else {
        0
    }
}

pub fn deep_loss_per_tick(oaths: u16, base: u128) -> u128 {
    if held(oaths, VITRIOL) {
        VITRIOL_LOSS_PER_TICK.into() * crate::rules::RESOURCE_PRECISION
    } else {
        base
    }
}

pub fn empty_reveal_limit(oaths: u16, base: u8) -> u8 {
    if held(oaths, DETECTION) {
        core::cmp::min(base, DETECTION_EMPTY_REVEAL_LIMIT)
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

pub fn clean_win(before: u128, after: u128) -> bool {
    (before - after) * 100 < before * PERFECTION_LOSS_PERCENT.into()
}

pub fn site_pay(oaths: u16, amount: u128, clean: bool) -> u128 {
    let amount = if held(oaths, RAGE) {
        amount * RAGE_PAY_PERCENT.into() / 100
    } else {
        amount
    };
    if clean && held(oaths, PERFECTION) {
        amount * PERFECTION_PAY_PERCENT.into() / 100
    } else {
        amount
    }
}

pub fn choice_stamina(oath: Option<u8>) -> u64 {
    match oath {
        Option::None => PASS_STAMINA.into(),
        Option::Some(oath) => if oath == TITANS {
            TITANS_STAMINA.into()
        } else {
            0
        },
    }
}

pub fn attack_stamina(oaths: u16, base: u16) -> u16 {
    if held(oaths, ANGER) {
        core::cmp::min(base, ANGER_ATTACK_STAMINA)
    } else {
        base
    }
}

pub fn stamina_bonus(oaths: u16) -> u64 {
    if held(oaths, TITANS) {
        TITANS_STAMINA.into()
    } else {
        0
    }
}

pub fn regen_bps(oaths: u16) -> u32 {
    if held(oaths, ENLIGHTENMENT) {
        ENLIGHTENMENT_REGEN_BPS.into()
    } else {
        10000
    }
}

pub fn explore_stamina(oaths: u16, base: u16) -> u16 {
    if held(oaths, FOX) {
        base * (100 - FOX_REVEAL_DISCOUNT_PERCENT) / 100
    } else {
        base
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ChooseOath {
    pub explorer_id: u64,
    pub expected_pick: u16,
    pub oath: Option<u8>,
    pub replace: Option<u8>,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RerollOath {
    pub explorer_id: u64,
    pub expected_pick: u16,
    pub index: u8,
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
    fn reroll_oath(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: RerollOath,
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

#[inline(never)]
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

fn card_scale(index: u8) -> u16 {
    match index {
        0 => 1,
        1 => 16,
        2 => 256,
        _ => panic!("missing oath card"),
    }
}

pub fn card(pick: u16, index: u8) -> u8 {
    assert!(pick != 0, "missing oath card");
    (pick / card_scale(index) % 16 + 1).try_into().unwrap()
}

fn draw_one(choices: u16, seed: u256, index: u8) -> u8 {
    let random: u256 = core::poseidon::poseidon_hash_span(
        array!['oath', seed.low.into(), seed.high.into(), index.into()].span(),
    )
        .into();
    let mut skip: u8 = (random % count(choices).into()).try_into().unwrap();
    let mut drawn = 0;
    for oath in 1_u8..17 {
        if held(choices, oath) {
            if skip == 0 {
                drawn = oath;
                break;
            }
            skip -= 1;
        }
    }
    drawn
}

pub fn draw(oaths: u16, seed: u256) -> u16 {
    let mut choices = 65535 ^ oaths;
    let mut pick = 0;
    let mut drawn: u16 = 0;
    for index in 0_u8..3 {
        if choices == 0 && index == 0 {
            return 0;
        }
        if choices != 0 {
            let oath = draw_one(choices, seed, index);
            drawn = (oath - 1).into();
            choices -= bit(oath);
        }
        pick += drawn * card_scale(index);
    }
    pick
}

pub fn reroll(progress: ArmyProgress, command: RerollOath, seed: u256) -> ArmyProgress {
    let pick = progress.oath_pick;
    assert!(pick != 0 && pick == command.expected_pick, "oath pick changed");
    let scale = card_scale(command.index);
    assert!(pick < REROLLED, "oath pick already rerolled");
    let shown = bit(card(pick, 0)) | bit(card(pick, 1)) | bit(card(pick, 2));
    let choices = 65535 ^ (progress.oaths | shown);
    assert!(choices != 0, "no oath left to reroll");
    let old: u16 = (card(pick, command.index) - 1).into();
    let new: u16 = (draw_one(choices, seed, command.index) - 1).into();
    ArmyProgress { oath_pick: pick - old * scale + new * scale + REROLLED, ..progress }
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
