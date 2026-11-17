use crate::troops::ExplorerKey;

pub fn offer(key: ExplorerKey, seed: u256) {
    let army = crate::logic::troops::explorer(key).expect('missing oath army');
    if crate::logic::expeditions::depth_at(key.game_id, army.coord) >= 3 {
        return;
    }
    let mut progress = crate::logic::progression::require(key);
    if progress.oath_pick != 0 {
        return;
    }
    progress.oath_pick = crate::oaths::draw(progress.oaths, seed);
    crate::logic::progression::write(key, progress);
}

pub fn choose(
    game_id: u32,
    actor: starknet::ContractAddress,
    command: crate::oaths::ChooseOath,
    context: crate::commands::ActionContext,
) {
    let execution = crate::commands::execution_context(game_id, context);
    crate::game::assert_playing(execution.game.unbox(), context.timestamp);
    assert!(execution.rules.unbox().day_unit_seconds != 0, "oaths require a day game");
    let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
    let army = crate::logic::troops::command_explorer(key, Some(actor), context.timestamp, execution);
    assert!(army.troops.count != 0, "explorer is dead");
    let progress = crate::oaths::choose(crate::logic::progression::require(key), command);
    crate::logic::progression::write(key, progress);
}
