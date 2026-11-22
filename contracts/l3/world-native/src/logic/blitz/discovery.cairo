use starknet::storage::{StoragePathEntry, StoragePointerReadAccess};
use crate::discovery::Discovery;
use crate::game::{PointActivity, PointsAwarded};
use crate::map::TileKey;
use crate::resources::ResourceKey;
use crate::troops::Coord;

pub fn reveal(
    key: TileKey, explorer_id: u64, seed: u256, context: crate::commands::ActionContext,
) -> (Discovery, PointsAwarded) {
    let execution = crate::commands::execution_context(key.game_id, context);
    crate::logic::map::MapState::reveal(key, crate::logic::map::biome(key, crate::commands::biome_context(execution)));
    let home = crate::state::read().troops.explorers.entry((key.game_id, explorer_id)).owner.read();
    let points = crate::logic::blitz::points::award(
        key.game_id,
        crate::logic::structures::owner(ResourceKey { game_id: key.game_id, entity_id: home }),
        PointActivity::Exploration,
        crate::balance::exploration::EXPLORE_POINTS,
    );
    let found = if key.alt {
        Discovery::None
    } else {
        surface(context.rules.map_config, context.rules.mode_rules, seed)
    };
    if found != Discovery::None {
        crate::structures::IStructureOperationsDispatcherTrait::create_discovery(
            crate::structures::IStructureOperationsLibraryDispatcher {
                class_hash: crate::logic::release::class_of(key.game_id, crate::slots::STRUCTURES),
            },
            key.game_id,
            home,
            Coord { alt: key.alt, x: key.col, y: key.row },
            found,
            seed,
            context.timestamp,
            context,
        );
    }
    (found, points)
}

pub fn surface(config: crate::rules::MapConfig, mode_rules: u32, seed: u256) -> Discovery {
    if crate::random::lottery(
        seed, 2, config.shards_mines_win_probability.into(), config.shards_mines_fail_probability.into(),
    ) {
        return Discovery::Mine;
    }
    if mode_rules & crate::rules::DISCOVER_CAMPS != 0
        && crate::random::lottery(seed, 7, config.camp_win_probability.into(), config.camp_fail_probability.into()) {
        return Discovery::Camp;
    }
    Discovery::None
}
