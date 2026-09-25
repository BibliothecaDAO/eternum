use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
use crate::progression::{ArmyProgress, ArmyProgressionRules, AttributeOffer, OfferSource, ProgressPacking, XpAward};
use crate::troops::ExplorerKey;

pub fn rules(game_id: u32) -> Option<ArmyProgressionRules> {
    crate::logic::preset_record::for_game(game_id).progression_rules.read()
}

#[inline(never)]
pub fn read(key: ExplorerKey) -> Option<ArmyProgress> {
    let packed = crate::state::read().troops.progress.read((key.game_id, key.explorer_id));
    if packed.levels == 0 {
        None
    } else {
        Some(ProgressPacking::unpack(packed))
    }
}

#[inline(never)]
pub fn require(key: ExplorerKey) -> ArmyProgress {
    read(key).expect('missing army progress')
}

pub fn create(key: ExplorerKey) {
    assert!(read(key).is_none(), "army progress already exists");
    rules(key.game_id).expect('missing progression rules');
    write(key, crate::progression::initial());
}

#[inline(never)]
pub fn write(key: ExplorerKey, progress: ArmyProgress) {
    crate::state::write().troops.progress.write((key.game_id, key.explorer_id), ProgressPacking::pack(progress));
    let mut keys = array![];
    key.serialize(ref keys);
    let mut values = array![];
    progress.serialize(ref values);
    crate::logic::troops::TroopState::emit(
        crate::logic::troops::TroopState::Event::RowSet(
            crate::events::RowSet { version: 1, model: 'ArmyProgress', keys: keys.span(), values: values.span() },
        ),
    );
}

pub fn destroy(key: ExplorerKey) {
    require(key);
    crate::state::write().troops.progress.write((key.game_id, key.explorer_id), Default::default());
    let mut keys = array![];
    key.serialize(ref keys);
    crate::logic::troops::TroopState::emit(
        crate::logic::troops::TroopState::Event::RowDeleted(
            crate::events::RowDeleted { version: 1, model: 'ArmyProgress', keys: keys.span() },
        ),
    );
}

pub fn issue_offer(
    key: ExplorerKey,
    ref progress: ArmyProgress,
    source: OfferSource,
    amount: u8,
    context: crate::commands::ExecutionContext,
) {
    assert_can_receive_offer(progress);
    let id = crate::state::read().troops.offer_ids.read((key.game_id, key.explorer_id)) + 1;
    crate::state::write().troops.offer_ids.write((key.game_id, key.explorer_id), id);
    let mut root = context.raw_root;
    let seed = crate::random::game_root(ref root, key.game_id, context.game.unbox().seed);
    let salt = Into::<u64, u128>::into(context.timestamp)
        + Into::<u32, u128>::into(key.explorer_id) * 0x100000000
        + id.into();
    let choices = crate::progression::draw_choices(progress, seed, salt);
    progress.pending = Some(AttributeOffer { id, source, amount, choices });
}

pub fn offer_earned_level(key: ExplorerKey, ref progress: ArmyProgress, context: crate::commands::ExecutionContext) {
    if crate::progression::advance_level(ref progress, rules(key.game_id).expect('missing progression rules')) {
        issue_offer(key, ref progress, OfferSource::Level, 1, context);
    }
}

pub fn award_xp(key: ExplorerKey, award: XpAward, context: crate::commands::ExecutionContext) {
    let rules = rules(key.game_id).expect('missing progression rules');
    let mut progress = require(key);
    progress.xp += match award {
        XpAward::Reveal => rules.reveal_xp,
        XpAward::Clear => rules.clear_xp,
    };
    offer_earned_level(key, ref progress, context);
    write(key, progress);
}

pub fn assert_can_receive_offer(progress: ArmyProgress) {
    assert!(progress.pending.is_none(), "attribute offer pending");
    assert!(!crate::progression::eligible(progress).is_empty(), "all attributes are maxed");
}

pub fn grant_relic(key: ExplorerKey, quality: u8, context: crate::commands::ExecutionContext) {
    let mut progress = require(key);
    issue_offer(key, ref progress, OfferSource::Relic, crate::progression::relic_levels(quality), context);
    write(key, progress);
}
