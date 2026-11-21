use crate::stamina::{StaminaSourceTrait, StaminaTrait};
use crate::troops::ExplorerKey;

pub fn offer(key: ExplorerKey, coord: crate::troops::Coord, seed: u256) {
    if crate::logic::expeditions::depth_at(key.game_id, coord) >= 3 {
        return;
    }
    let mask = crate::balance::rules::SWITCHES.command_mask;
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
    let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
    let army = crate::logic::troops::command_explorer(key, Some(actor), context.timestamp, execution);
    assert!(army.troops.count != 0, "explorer is dead");
    let progress = crate::oaths::choose(crate::logic::progression::require(key), command);
    let gain = crate::oaths::choice_stamina(command.oath);
    grant_choice_stamina(key, army, progress, execution.rules.unbox().troop_stamina_config, gain);
    if command.oath.is_some() {
        crate::logic::quest_progress::oath_taken(
            crate::resources::ResourceKey { game_id, entity_id: army.owner }, context.timestamp,
        );
    }
    crate::logic::progression::write(key, progress);
}

pub fn reroll(
    game_id: u32,
    actor: starknet::ContractAddress,
    command: crate::oaths::RerollOath,
    context: crate::commands::ActionContext,
) {
    let execution = crate::commands::execution_context(game_id, context);
    crate::game::assert_playing(execution.game.unbox(), context.timestamp);
    let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
    let army = crate::logic::troops::command_explorer(key, Some(actor), context.timestamp, execution);
    assert!(army.troops.count != 0, "explorer is dead");
    assert!(crate::logic::expeditions::depth_at(game_id, army.coord) < 3, "no oath is rerolled in the Deep");
    let mut root = context.raw_root;
    let progress = crate::oaths::reroll(
        crate::logic::progression::require(key), command, crate::random::game_root(ref root, game_id),
    );
    crate::logic::fragments::spend(game_id, actor, crate::fragments::OATH_REROLL_FRAGMENTS.into());
    crate::logic::progression::write(key, progress);
}

fn grant_choice_stamina(
    key: ExplorerKey,
    army: crate::troops::ExplorerTroops,
    progress: crate::progression::ArmyProgress,
    rules: crate::rules::TroopStaminaConfig,
    gain: u64,
) {
    let maximum = crate::progression::stamina_max(progress, army.troops.category, rules);
    let mut stamina = army.troops.stamina.inline();
    stamina.amount += gain;
    stamina.clamp(maximum);
    crate::logic::army_slot_storage::persist(
        key,
        crate::troops::ExplorerRecordTrait::into_record(crate::logic::troops::explorer(key).expect('missing explorer')),
        crate::troops::Troops { stamina: crate::troops::StaminaSource::Inline(stamina), ..army.troops },
    );
}

pub fn refill_at_well(key: ExplorerKey, ref troops: crate::troops::Troops, rules: crate::rules::TroopStaminaConfig) {
    let progress = crate::logic::progression::require(key);
    let maximum = crate::progression::stamina_max(progress, troops.category, rules);
    let mut stamina = troops.stamina.inline();
    stamina.amount += crate::oaths::well_stamina(progress.oaths, maximum);
    stamina.clamp(maximum);
    troops.stamina = crate::troops::StaminaSource::Inline(stamina);
}
