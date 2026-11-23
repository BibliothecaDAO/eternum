use starknet::ContractAddress;
use crate::exploration_rewards::ExtractedReward;
use crate::geometry::tile_key;
use crate::troops::{Coord, ExplorerKey, ExplorerTroops};

pub fn revealing_explorer(
    game_id: u32, actor: ContractAddress, explorer_id: u64, context: crate::commands::ExecutionContext,
) -> ExplorerTroops {
    crate::game::assert_playing(context.game.unbox(), context.timestamp);
    let explorer = crate::logic::troops::command_explorer(
        ExplorerKey { game_id, explorer_id }, Some(actor), context.timestamp, context,
    );
    assert!(!explorer.coord.alt, "extraction requires surface");
    assert!(explorer.troops.count != 0, "explorer is dead");
    let occupied = crate::logic::map::occupancy(tile_key(game_id, explorer.coord)).expect('missing army occupancy');
    assert!(occupied.entity_id == explorer_id, "explorer does not occupy tile");
    explorer
}

pub fn pay_reveal(
    game_id: u32,
    explorer_id: u64,
    explorer: ExplorerTroops,
    coord: Coord,
    reward: crate::resources::ResourceAmount,
    context: crate::commands::ExecutionContext,
) -> ExtractedReward {
    let receiver = crate::exploration_rewards::receiver(explorer_id, explorer.owner, reward.resource_type);
    crate::exploration_rewards::IExplorationGrantDispatcherTrait::grant_exploration_reward(
        crate::exploration_rewards::IExplorationGrantLibraryDispatcher {
            class_hash: crate::logic::release::class_of(game_id, crate::slots::RESOURCES),
        },
        crate::resources::ResourceKey { game_id, entity_id: receiver },
        reward.resource_type,
        reward.amount,
        context.timestamp,
        crate::commands::resource_context(context),
    );
    ExtractedReward { explorer_id, receiver, coord, resource_type: reward.resource_type, amount: reward.amount }
}

pub fn record_story(game_id: u32, actor: ContractAddress, timestamp: u64, paid: ExtractedReward) {
    crate::logic::stories::emit_entity_story(
        crate::resources::ResourceKey { game_id, entity_id: paid.explorer_id },
        actor,
        crate::ownership::Story::ExplorationReward(paid),
        timestamp,
    );
}
