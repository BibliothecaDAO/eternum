use starknet::storage::{StoragePathEntry, StoragePointerReadAccess};
use crate::map::TileKey;
use crate::troops::Coord;

pub fn reveal(
    key: TileKey, explorer_id: u64, seed: u256, context: crate::commands::ActionContext,
) -> crate::discovery::Discovery {
    let execution = crate::commands::execution_context(key.game_id, context);
    let biome = crate::commands::biome_context(execution);
    let already_revealed = crate::logic::map::tile(key)
        .map(|tile| tile.data / crate::map::BIOME_SCALE % crate::map::BYTE_RANGE != 0)
        .unwrap_or(false);
    assert!(!already_revealed, "expedition tile already revealed");
    crate::logic::map::MapState::reveal(key, crate::logic::map::biome(key, biome));
    let home = crate::state::read().troops.explorers.entry((key.game_id, explorer_id)).owner.read();
    let result = roll(key, explorer_id, seed, context);
    let guarded = match result {
        crate::discovery::Discovery::Camp | crate::discovery::Discovery::Rift | crate::discovery::Discovery::Ruin(_) |
        crate::discovery::Discovery::Beasts => true,
        _ => false,
    };
    if guarded {
        crate::structures::IStructureOperationsDispatcherTrait::create_discovery(
            crate::structures::IStructureOperationsLibraryDispatcher {
                class_hash: crate::logic::release::class_of(key.game_id, crate::slots::STRUCTURES),
            },
            key.game_id,
            home,
            Coord { alt: key.alt, x: key.col, y: key.row },
            result,
            seed,
            context.timestamp,
            context,
        );
    }
    if result == crate::discovery::Discovery::Shrine {
        crate::oaths::IOathsDispatcherTrait::offer_oaths(
            crate::oaths::IOathsLibraryDispatcher {
                class_hash: crate::logic::release::class_of(key.game_id, crate::slots::RELICS),
            },
            crate::troops::ExplorerKey { game_id: key.game_id, explorer_id },
            Coord { alt: key.alt, x: key.col, y: key.row },
            seed,
        );
    }
    result
}

#[cfg(feature: "blitz")]
pub fn lore_rules(learned: u64) -> crate::expeditions::FrontierDiscoveryRules {
    panic!("Blitz discovers no sites")
}

#[cfg(not(feature: "blitz"))]
pub fn lore_rules(learned: u64) -> crate::expeditions::FrontierDiscoveryRules {
    let mut rules = crate::balance::expeditions::FRONTIER_DISCOVERY;
    let lore = crate::research::tier(learned, crate::research::ROW_LORE);
    if lore < crate::research::LORE_SHRINES {
        rules.shrine_bps = 0;
    }
    if lore < crate::research::LORE_WELLS {
        rules.well_bps = 0;
    }
    rules
}

fn roll(
    key: TileKey, explorer_id: u64, seed: u256, context: crate::commands::ActionContext,
) -> crate::discovery::Discovery {
    let home = crate::state::read().troops.explorers.entry((key.game_id, explorer_id)).owner.read();
    assert!(home != 0, "missing exploring army");
    let home_key = crate::resources::ResourceKey { game_id: key.game_id, entity_id: home };
    let learned = crate::logic::research::require(home_key).learned;
    let rules = lore_rules(learned);
    let counter = crate::expeditions::ExpeditionDiscoveryKey {
        game_id: key.game_id,
        structure_id: home,
        epoch: crate::expeditions::region_day(
            crate::troops::Coord { alt: key.alt, x: key.col, y: key.row }, crate::logic::settlement::spacing(),
        ),
    };
    let depth = crate::logic::expeditions::depth_at(key.game_id, Coord { alt: key.alt, x: key.col, y: key.row });
    let triumph_find_percent = if depth < 3 {
        crate::logic::triumphs::effects(home_key, context.timestamp).find_percent
    } else {
        100
    };
    let find_percent = crate::oaths::find_percent(
        crate::logic::progression::require(crate::troops::ExplorerKey { game_id: key.game_id, explorer_id }).oaths,
        triumph_find_percent,
    );
    let day = crate::logic::expeditions::discovery(counter)
        .unwrap_or(crate::expeditions::ExpeditionDiscovery { empty_reveals: 0, ruin_cleared: false });
    let ruin = Some(crate::army_relics::draw(crate::logic::expeditions::depth_rules(depth).chest, seed));
    let result = if crate::logic::spires::discover_on_reveal(
        crate::spires::ExpeditionSpireKey { game_id: key.game_id, structure_id: home, epoch: counter.epoch, depth },
        Coord { alt: key.alt, x: key.col, y: key.row },
        learned,
        find_percent,
        seed,
    ) {
        crate::discovery::Discovery::Spire
    } else {
        crate::discovery::frontier(rules, find_percent, day.empty_reveals, ruin, seed)
    };
    crate::logic::expeditions::record_discovery(counter, result);
    occupy_discovery(key, home, result, seed);
    crate::logic::quest_progress::revealed(home_key, 1, context.timestamp);
    crate::logic::quest_progress::discovered(home_key, result, context.timestamp);
    result
}

fn occupy_discovery(key: TileKey, home: u64, result: crate::discovery::Discovery, seed: u256) {
    if let Some(category) = crate::discovery::tile_occupier(result) {
        let id = crate::entity_ids::allocate_home(key.game_id, home);

        let category = if result == crate::discovery::Discovery::Spire {
            crate::taxonomy::SPIRE_OCCUPIER
        } else {
            category
        };
        crate::logic::map::MapState::occupy(key, id, category, false);
    }
}
