use crate::troops::ExplorerKey;

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ArmyProgressionRules {
    pub reveal_xp: u32,
    pub clear_xp: u32,
    pub level_step_xp: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum Attribute {
    Battle,
    Logistics,
    Scouting,
    Support,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum OfferSource {
    Level,
    Relic,
    Shrine,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct AttributeOffer {
    pub id: u32,
    pub source: OfferSource,
    pub amount: u8,
    pub choices: Span<Attribute>,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ArmyProgress {
    pub level: u16,
    pub xp: u32,
    pub battle: u8,
    pub logistics: u8,
    pub scouting: u8,
    pub support: u8,
    pub pending: Option<AttributeOffer>,
}

// The public fact stays expanded; storage reads two words instead of walking nested fields.
#[derive(Copy, Drop, Serde, Debug, PartialEq, Default, starknet::Store)]
pub struct PackedArmyProgress {
    pub levels: u128,
    pub pending: u128,
}

pub impl ProgressPacking of starknet::storage_access::StorePacking<ArmyProgress, PackedArmyProgress> {
    #[inline(never)]
    fn pack(value: ArmyProgress) -> PackedArmyProgress {
        assert!(value.level != 0, "invalid army level");
        PackedArmyProgress {
            levels: value.level.into()
                + Into::<u32, u128>::into(value.xp) * 0x10000
                + Into::<u8, u128>::into(value.battle) * 0x1000000000000
                + Into::<u8, u128>::into(value.logistics) * 0x100000000000000
                + Into::<u8, u128>::into(value.scouting) * 0x10000000000000000
                + Into::<u8, u128>::into(value.support) * 0x1000000000000000000,
            pending: match value.pending {
                Some(offer) => OfferPacking::pack(offer) + 1,
                None => 0,
            },
        }
    }
    #[inline(never)]
    fn unpack(value: PackedArmyProgress) -> ArmyProgress {
        let level = (value.levels % 0x10000).try_into().unwrap();
        assert!(level != 0, "missing army progress");
        ArmyProgress {
            level,
            xp: (value.levels / 0x10000 % 0x100000000).try_into().unwrap(),
            battle: (value.levels / 0x1000000000000 % 256).try_into().unwrap(),
            logistics: (value.levels / 0x100000000000000 % 256).try_into().unwrap(),
            scouting: (value.levels / 0x10000000000000000 % 256).try_into().unwrap(),
            support: (value.levels / 0x1000000000000000000).try_into().unwrap(),
            pending: if value.pending == 0 {
                None
            } else {
                Some(OfferPacking::unpack(value.pending - 1))
            },
        }
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ChooseAttribute {
    pub explorer_id: u32,
    pub offer_id: u32,
    pub attribute: Attribute,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct AttributeChosen {
    pub explorer_id: u32,
    pub offer_id: u32,
    pub source: OfferSource,
    pub attribute: Attribute,
    pub applied: u8,
    pub lost: u8,
}

#[derive(Copy, Drop, Serde)]
pub enum XpAward {
    Reveal,
    Clear,
}

#[starknet::interface]
pub trait IArmyProgression<T> {
    fn army_progress(self: @T, key: ExplorerKey) -> Option<ArmyProgress>;
    fn army_progression_rules(self: @T, game_id: u32) -> Option<ArmyProgressionRules>;
    fn grant_army_xp(ref self: T, key: ExplorerKey, award: XpAward, context: crate::commands::ActionContext);
    fn choose_attribute(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: ChooseAttribute,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> ((), crate::ownership::StoryCursor);
}

pub fn initial() -> ArmyProgress {
    ArmyProgress { level: 1, xp: 0, battle: 1, logistics: 1, scouting: 1, support: 1, pending: None }
}

pub fn attribute_level(progress: ArmyProgress, attribute: Attribute) -> u8 {
    match attribute {
        Attribute::Battle => progress.battle,
        Attribute::Logistics => progress.logistics,
        Attribute::Scouting => progress.scouting,
        Attribute::Support => progress.support,
    }
}

pub fn eligible(progress: ArmyProgress) -> Span<Attribute> {
    let mut choices = array![];
    for attribute in array![Attribute::Battle, Attribute::Logistics, Attribute::Scouting, Attribute::Support] {
        if attribute_level(progress, attribute) < crate::rules::ATTRIBUTE_CAP {
            choices.append(attribute);
        }
    }
    choices.span()
}

pub fn draw_choices(progress: ArmyProgress, seed: u256, salt: u128) -> Span<Attribute> {
    let mut available = eligible(progress);
    let count = core::cmp::min(3, available.len());
    let mut chosen = array![];
    for draw in 0..count {
        let index: u32 = crate::random::range(seed, salt + draw.into(), available.len().into()).try_into().unwrap();
        chosen.append(*available.at(index));
        let mut remaining = array![];
        for other in 0..available.len() {
            if other != index {
                remaining.append(*available.at(other));
            }
        }
        available = remaining.span();
    }
    chosen.span()
}

pub fn advance_level(ref progress: ArmyProgress, rules: ArmyProgressionRules) -> bool {
    assert!(rules.level_step_xp != 0, "empty level threshold");
    if progress.pending.is_some() || eligible(progress).is_empty() {
        return false;
    }
    let threshold = rules.level_step_xp * progress.level.into();
    if progress.xp < threshold {
        return false;
    }
    progress.xp -= threshold;
    progress.level += 1;
    true
}

pub fn apply_choice(ref progress: ArmyProgress, command: ChooseAttribute) -> AttributeChosen {
    let offer = progress.pending.expect('no pending attribute offer');
    assert!(command.offer_id == offer.id, "stale attribute offer");
    let mut offered = false;
    for attribute in offer.choices {
        offered = offered || *attribute == command.attribute;
    }
    assert!(offered, "attribute was not offered");
    let before = attribute_level(progress, command.attribute);
    let applied = core::cmp::min(offer.amount, crate::rules::ATTRIBUTE_CAP - before);
    let after = before + applied;
    match command.attribute {
        Attribute::Battle => progress.battle = after,
        Attribute::Logistics => progress.logistics = after,
        Attribute::Scouting => progress.scouting = after,
        Attribute::Support => progress.support = after,
    }
    progress.pending = None;
    AttributeChosen {
        explorer_id: command.explorer_id,
        offer_id: offer.id,
        source: offer.source,
        attribute: command.attribute,
        applied,
        lost: offer.amount - applied,
    }
}

// Three ordered choices fit in one word; the public offer remains a Span.
pub impl OfferPacking of starknet::storage_access::StorePacking<AttributeOffer, u128> {
    #[inline(never)]
    fn pack(value: AttributeOffer) -> u128 {
        let offer = value;
        assert!(offer.choices.len() <= 3, "too many attribute choices");
        let source = match offer.source {
            OfferSource::Level => 0_u128,
            OfferSource::Relic => 1,
            OfferSource::Shrine => 2,
        };
        let mut packed = offer.id.into()
            + source * 0x100000000
            + Into::<u8, u128>::into(offer.amount) * 0x10000000000
            + Into::<u32, u128>::into(offer.choices.len()) * 0x1000000000000;
        let mut scale = 0x100000000000000_u128;
        for attribute in offer.choices {
            let index = match *attribute {
                Attribute::Battle => 0_u128,
                Attribute::Logistics => 1,
                Attribute::Scouting => 2,
                Attribute::Support => 3,
            };
            packed += index * scale;
            scale *= 256;
        }
        packed
    }

    #[inline(never)]
    fn unpack(value: u128) -> AttributeOffer {
        let packed = value;
        let source = match packed / 0x100000000 % 256 {
            0 => OfferSource::Level,
            1 => OfferSource::Relic,
            2 => OfferSource::Shrine,
            _ => panic!("invalid offer source"),
        };
        let count: u32 = (packed / 0x1000000000000 % 256).try_into().unwrap();
        assert!(count <= 3, "invalid choice count");
        let mut choices = array![];
        let mut indices = packed / 0x100000000000000;
        for _ in 0..count {
            choices
                .append(
                    match indices % 256 {
                        0 => Attribute::Battle,
                        1 => Attribute::Logistics,
                        2 => Attribute::Scouting,
                        3 => Attribute::Support,
                        _ => panic!("invalid attribute"),
                    },
                );
            indices /= 256;
        }
        AttributeOffer {
            id: (packed % 0x100000000).try_into().unwrap(),
            source,
            amount: (packed / 0x10000000000 % 256).try_into().unwrap(),
            choices: choices.span(),
        }
    }
}


pub fn stamina_max(
    progress: ArmyProgress, category: crate::troops::TroopType, rules: crate::rules::TroopStaminaConfig,
) -> u64 {
    crate::stamina::StaminaImpl::max(category, crate::troops::TroopTier::T1, rules)
        + Into::<u8, u64>::into(progress.logistics - 1) * crate::rules::ATTRIBUTE_STAMINA.into()
}

pub fn relic_levels(quality: u8) -> u8 {
    assert!(quality <= 3, "invalid chest quality");
    quality + 1
}
