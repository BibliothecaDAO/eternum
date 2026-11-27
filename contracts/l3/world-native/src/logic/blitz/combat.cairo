use crate::combat::CombatContext;
use crate::commands::ExecutionContext;
use crate::resources::ResourceKey;
use crate::structures::Structure;
use crate::troops::{Coord, ExplorerKey, ExplorerTroops};

#[inline(always)]
pub fn at_range(combat: CombatContext, attacker: Coord, defender: Coord) -> CombatContext {
    CombatContext { attack_distance: crate::geometry::distance(attacker, defender).try_into().unwrap(), ..combat }
}

#[inline(always)]
pub fn capture(
    _explorer_key: ExplorerKey,
    explorer: ExplorerTroops,
    key: ResourceKey,
    target: Structure,
    _clean: bool,
    context: ExecutionContext,
) {
    super::capture::capture(key, explorer.owner, target, context.timestamp);
}
