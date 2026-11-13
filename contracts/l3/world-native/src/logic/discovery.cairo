use starknet::storage::{StoragePathEntry, StoragePointerReadAccess};
use crate::map::TileKey;
use crate::troops::Coord;

pub fn roll(
    key: TileKey, explorer_id: u64, seed: u256, context: crate::commands::ActionContext,
) -> crate::discovery::Discovery {
    let context = crate::commands::execution_context(key.game_id, context);
    let mut rules = crate::logic::preset_record::for_game(key.game_id)
        .discovery_rules
        .read()
        .expect('missing discovery rules');
    let explorer_key = crate::troops::ExplorerKey { game_id: key.game_id, explorer_id };
    let home = crate::state::read().troops.explorers.entry((key.game_id, explorer_id)).owner.read();
    assert!(home != 0, "missing exploring army");
    let progress = crate::logic::progression::require(explorer_key);
    let home_key = crate::resources::ResourceKey { game_id: key.game_id, entity_id: home };
    let learned = crate::logic::research::require(home_key).learned;
    if crate::research::tier(learned, crate::research::ROW_SHRINE) == 0 {
        rules.shrine_bps = 0;
    }
    if crate::research::tier(learned, crate::research::ROW_WELL) == 0 {
        rules.well_bps = 0;
    }
    let counter = crate::expeditions::ExpeditionDiscoveryKey {
        game_id: key.game_id,
        structure_id: home,
        epoch: crate::expeditions::region_day(
            crate::troops::Coord { alt: key.alt, x: key.col, y: key.row },
            crate::logic::settlement::rules(key.game_id).spacing,
        ),
    };
    let depth = crate::logic::expeditions::depth_at(key.game_id, Coord { alt: key.alt, x: key.col, y: key.row });
    if crate::logic::spires::discover_on_reveal(
        crate::spires::ExpeditionSpireKey { game_id: key.game_id, structure_id: home, epoch: counter.epoch, depth },
        Coord { alt: key.alt, x: key.col, y: key.row },
        learned,
        context.rules.unbox().mode_rules,
        seed,
    ) {
        return crate::discovery::Discovery::Spire;
    }
    let day = crate::logic::expeditions::discovery(counter)
        .unwrap_or(crate::expeditions::ExpeditionDiscovery { empty_reveals: 0, ruin_cleared: false });
    let ruin = Some(crate::army_relics::draw(crate::logic::expeditions::depth_rules(key.game_id, depth).chest, seed));
    let category = crate::state::read().troops.explorers.entry((key.game_id, explorer_id)).troops.read().category;
    let (camp, rift, sanctuaries) = crate::progression::scouting_bonus(progress, category);
    let rate = crate::logic::triumphs::percent(
        home_key, Coord { alt: key.alt, x: key.col, y: key.row }, crate::rules::CLEAR_MIST_STAGE, context.timestamp,
    );
    let result = crate::discovery::frontier(rules, camp, rift, sanctuaries, rate, day.empty_reveals, ruin, seed);
    crate::logic::expeditions::record_discovery(counter, result);
    occupy_discovery(key, home, result, seed);
    result
}

fn occupy_discovery(key: TileKey, home: u64, result: crate::discovery::Discovery, seed: u256) {
    if let Some(category) = crate::discovery::tile_occupier(result) {
        let id = crate::entity_ids::allocate_home(key.game_id, home);
        if category == crate::taxonomy::SHRINE_OCCUPIER {
            let coord = Coord { alt: key.alt, x: key.col, y: key.row };
            crate::logic::shrines::discover(
                crate::resources::ResourceKey { game_id: key.game_id, entity_id: id },
                crate::logic::expeditions::depth_at(key.game_id, coord),
                seed,
            );
        }
        crate::logic::map::MapState::occupy(key, id, category, false);
    }
}
