use starknet::ContractAddress;
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::fragments::FragmentCredit;
use crate::stamina::{StaminaSourceTrait, StaminaTrait};

pub fn balance(game_id: u32, account: ContractAddress) -> u128 {
    crate::state::read().entry.fragments.read((game_id, account))
}

pub fn add(game_id: u32, account: ContractAddress, amount: u128) {
    write(game_id, account, balance(game_id, account) + amount);
}

pub fn credit(game_id: u32, credit: FragmentCredit) {
    assert!(credit.id != 0 && credit.amount != 0, "empty fragment credit");
    assert!(credit.account != 0.try_into().unwrap(), "invalid fragment account");
    let receipt = (credit.account, credit.amount);
    if let Some(previous) = crate::state::read().entry.fragment_credits.read((game_id, credit.id)) {
        assert!(previous == receipt, "fragment credit differs");
        return;
    }
    let game = crate::logic::game::game(game_id);
    assert!(game.end_at == 0 || starknet::get_block_timestamp() < game.end_at, "game ended");
    crate::state::write().entry.fragment_credits.write((game_id, credit.id), Some(receipt));
    emit('FragmentCredit', array![game_id.into(), credit.id], array![credit.account.into(), credit.amount.into()]);
    add(game_id, credit.account, credit.amount);
}

pub fn buy_seal(game_id: u32, actor: ContractAddress, context: crate::commands::ActionContext) {
    let execution = crate::commands::execution_context(game_id, context);
    crate::game::assert_playing(execution.game.unbox(), context.timestamp);
    assert!(crate::state::read().entry.seals.read((game_id, actor)).is_none(), "seal already held");
    spend(game_id, actor, crate::fragments::SEAL_FRAGMENTS.into());
    crate::logic::entry::grant_seal(game_id, actor);
}

pub fn buy_stamina(
    game_id: u32,
    actor: ContractAddress,
    command: crate::fragments::BuyStamina,
    context: crate::commands::ActionContext,
) {
    let execution = crate::commands::execution_context(game_id, context);
    crate::game::assert_playing(execution.game.unbox(), context.timestamp);
    let key = crate::troops::ExplorerKey { game_id, explorer_id: command.explorer_id };
    let army = crate::logic::troops::command_explorer(key, Some(actor), context.timestamp, execution);
    assert!(army.troops.count != 0, "explorer is dead");
    assert!(crate::logic::expeditions::depth_at(game_id, army.coord) < 3, "no stamina is sold in the Deep");
    let maximum = crate::progression::stamina_max(
        crate::logic::progression::require(key), army.troops.category, execution.rules.unbox().troop_stamina_config,
    );
    let mut stamina = army.troops.stamina.inline();
    assert!(
        command.fragments != 0
            && maximum > stamina.amount
            && command.fragments <= crate::fragments::stamina_fragments(maximum - stamina.amount),
        "stamina over its bar",
    );
    spend(game_id, actor, command.fragments.into());
    stamina.amount += command.fragments * crate::fragments::STAMINA_PER_FRAGMENT.into();
    stamina.clamp(maximum);
    crate::logic::army_slot_storage::persist(
        key,
        crate::troops::ExplorerRecordTrait::into_record(crate::logic::troops::explorer(key).expect('missing explorer')),
        crate::troops::Troops { stamina: crate::troops::StaminaSource::Inline(stamina), ..army.troops },
    );
}

pub fn spend(game_id: u32, account: ContractAddress, amount: u128) {
    let available = balance(game_id, account);
    assert!(available >= amount, "not enough fragments");
    write(game_id, account, available - amount);
}

fn write(game_id: u32, account: ContractAddress, value: u128) {
    crate::state::write().entry.fragments.write((game_id, account), value);
    emit('Fragments', array![game_id.into(), account.into()], array![value.into()]);
}

fn emit(model: felt252, keys: Array<felt252>, values: Array<felt252>) {
    crate::logic::map::MapState::emit(
        crate::logic::map::MapState::Event::RowSet(
            crate::events::RowSet { version: 1, model, keys: keys.span(), values: values.span() },
        ),
    );
}
