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
    if discover_chest(key, counter, seed, context) {
        return crate::discovery::Discovery::Chest;
    }
    let ruin = ruin_reward(key.game_id, counter, depth, seed, context);
    let (camp, rift, sanctuaries) = crate::progression::scouting_bonus(progress);
    let rate = crate::logic::triumphs::percent(
        home_key, Coord { alt: key.alt, x: key.col, y: key.row }, crate::rules::CLEAR_MIST_STAGE, context.timestamp,
    );
    let result = crate::discovery::frontier(rules, camp, rift, sanctuaries, rate, day.empty_reveals, ruin, seed);
    crate::logic::expeditions::record_discovery(counter, result);
    occupy_discovery(key, home, result, seed);
    result
}

fn discover_chest(
    key: TileKey,
    counter: crate::expeditions::ExpeditionDiscoveryKey,
    seed: u256,
    context: crate::commands::ExecutionContext,
) -> bool {
    if !key.alt
        && crate::rules::rule_enabled(context.rules.unbox(), crate::rules::DISCOVER_CHESTS)
        && crate::discovery::frontier_chest(seed) {
        let odds = crate::logic::expeditions::depth_rules_at(
            key.game_id, Coord { alt: key.alt, x: key.col, y: key.row },
        )
            .chest;
        let chest = crate::logic::lords_budget::candidate(key.game_id, odds, seed, context);
        if crate::logic::lords_budget::try_reserve(key.game_id, chest, context) {
            let id = crate::entity_ids::allocate_home(key.game_id, counter.structure_id);
            crate::logic::lords_budget::store_site_chest(
                crate::resources::ResourceKey { game_id: key.game_id, entity_id: id }, chest,
            );
            crate::logic::map::MapState::occupy(key, id, crate::taxonomy::CHEST_OCCUPIER, false);
            crate::logic::expeditions::record_discovery(counter, crate::discovery::Discovery::Chest);
            return true;
        }
    }
    false
}

fn ruin_reward(
    game_id: u32,
    counter: crate::expeditions::ExpeditionDiscoveryKey,
    depth: u8,
    seed: u256,
    context: crate::commands::ExecutionContext,
) -> Option<crate::army_relics::RuinReward> {
    if crate::logic::army_relics::enabled(game_id) {
        Some(
            crate::army_relics::RuinReward::Relic(
                crate::army_relics::draw(crate::logic::expeditions::depth_rules(game_id, depth).chest, seed),
            ),
        )
    } else if crate::logic::expeditions::ruin_cleared_at(counter, depth) {
        None
    } else {
        let odds = crate::logic::expeditions::depth_rules(game_id, depth).chest;
        Some(crate::army_relics::RuinReward::Chest(crate::logic::lords_budget::candidate(game_id, odds, seed, context)))
    }
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
