use starknet::storage::StoragePointerReadAccess;
use crate::stamina::{StaminaSourceTrait, StaminaTrait};
use crate::troops::ExplorerKey;

pub fn offer(key: ExplorerKey, coord: crate::troops::Coord, seed: u256) {
    if crate::logic::expeditions::depth_at(key.game_id, coord) >= 3 {
        return;
    }
    let mask = crate::logic::preset_record::for_game(key.game_id).rules.command_mask.read();
    if !crate::rules::command_enabled(mask, crate::command_routes::CHOOSE_OATH.into()) {
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
    if command.oath.is_none() {
        grant_pass_stamina(key, army, progress, execution.rules.unbox().troop_stamina_config);
    }
    crate::logic::progression::write(key, progress);
}

fn grant_pass_stamina(
    key: ExplorerKey,
    army: crate::troops::ExplorerTroops,
    progress: crate::progression::ArmyProgress,
    rules: crate::rules::TroopStaminaConfig,
) {
    let maximum = crate::progression::stamina_max(progress, army.troops.category, rules);
    let mut stamina = army.troops.stamina.inline();
    stamina.amount += crate::oaths::PASS_STAMINA.into();
    stamina.clamp(maximum);
    crate::logic::army_slot_storage::persist(
        key,
        crate::troops::ExplorerRecordTrait::into_record(crate::logic::troops::explorer(key).expect('missing explorer')),
        crate::troops::Troops { stamina: crate::troops::StaminaSource::Inline(stamina), ..army.troops },
    );
}
