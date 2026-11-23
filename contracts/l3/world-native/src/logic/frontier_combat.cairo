use crate::combat::CombatContext;
use crate::commands::ExecutionContext;
use crate::resources::ResourceKey;
use crate::structures::Structure;
use crate::troops::{Coord, ExplorerKey, ExplorerTroops};

#[inline(always)]
pub fn at_range(combat: CombatContext, _attacker: Coord, _defender: Coord) -> CombatContext {
    combat
}

#[inline(always)]
pub fn capture(
    explorer_key: ExplorerKey,
    _explorer: ExplorerTroops,
    key: ResourceKey,
    _target: Structure,
    relic_slot: Option<u8>,
    clean: bool,
    context: ExecutionContext,
) {
    crate::relics::ICaptureRewardsDispatcherTrait::grant_capture_rewards(
        crate::relics::ICaptureRewardsLibraryDispatcher {
            class_hash: crate::logic::release::class_of(key.game_id, crate::slots::RELICS),
        },
        key,
        explorer_key.explorer_id,
        relic_slot,
        clean,
        crate::commands::action_context(context),
    );
}
