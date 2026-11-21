use starknet::storage::StorageMapReadAccess;
use crate::fragments::BuyStamina;
use crate::stamina::StaminaSourceTrait;
use crate::troops::{ExplorerRecordTrait, StaminaSource};
use super::play_fixture::FIXTURE_START;

fn earn(d: super::Deployment, game_id: u32, amount: u128) {
    snforge_std::interact_with_state(d.games, || crate::logic::fragments::add(game_id, d.actor, amount));
}

fn balance(d: super::Deployment, game_id: u32) -> u128 {
    snforge_std::interact_with_state(d.games, || crate::logic::fragments::balance(game_id, d.actor))
}

fn set_stamina(d: super::Deployment, key: crate::troops::ExplorerKey, deficit: u64) -> u64 {
    snforge_std::interact_with_state(
        d.games,
        || {
            let original = crate::logic::troops::explorer(key).unwrap();
            let mut army = crate::logic::army_slot_storage::resolve(key, original, None);
            let rules = crate::commands::load_context(key.game_id, 0, FIXTURE_START + 10).rules.unbox();
            let maximum = crate::progression::stamina_max(
                crate::logic::progression::require(key), army.troops.category, rules.troop_stamina_config,
            );
            let mut bar = army.troops.stamina.inline();
            bar.amount = maximum - deficit;
            bar.settled_at = (FIXTURE_START + 10).try_into().unwrap();
            bar.remainder = 0;
            army.troops.stamina = StaminaSource::Inline(bar);
            crate::logic::army_slot_storage::persist(key, original.into_record(), army.troops);
            maximum
        },
    )
}

fn stamina(d: super::Deployment, key: crate::troops::ExplorerKey) -> u64 {
    snforge_std::interact_with_state(
        d.games,
        || {
            crate::logic::army_slot_storage::resolve(key, crate::logic::troops::explorer(key).unwrap(), None)
                .troops
                .stamina
                .inline()
                .amount
        },
    )
}

fn buy_stamina(d: super::Deployment, key: crate::troops::ExplorerKey, fragments: u64) -> bool {
    super::resource_commands::execute_in_game(
        d,
        key.game_id,
        crate::commands::Command::BuyStamina(BuyStamina { explorer_id: key.explorer_id, fragments }),
        FIXTURE_START + 10,
    )
}

#[test]
fn a_seal_costs_one_thousand_fragments_and_is_bought_once() {
    let (d, game_id, _) = super::registrar::setup_frontier_relics();
    let buy = crate::commands::Command::BuySeal(());
    earn(d, game_id, 999);
    assert!(!super::resource_commands::execute_in_game(d, game_id, buy, FIXTURE_START + 10));
    earn(d, game_id, 1001);
    assert!(super::resource_commands::execute_in_game(d, game_id, buy, FIXTURE_START + 10));
    assert_eq!(balance(d, game_id), 1000);
    assert!(
        snforge_std::interact_with_state(
            d.games, || crate::state::read().entry.seals.read((game_id, d.actor)).is_some(),
        ),
    );
    assert!(!super::resource_commands::execute_in_game(d, game_id, buy, FIXTURE_START + 10));
    assert_eq!(balance(d, game_id), 1000);
}

#[test]
fn a_fragment_refills_two_points_above_the_deep_never_past_the_bar_and_none_in_the_deep() {
    let (d, game_id, key) = super::registrar::setup_frontier_relics();
    earn(d, game_id, 100);
    let maximum = set_stamina(d, key, 7);
    assert!(!buy_stamina(d, key, 5));
    assert!(!buy_stamina(d, key, 0));
    assert!(buy_stamina(d, key, 3));
    assert_eq!(stamina(d, key), maximum - 1);
    assert_eq!(balance(d, game_id), 97);
    assert!(buy_stamina(d, key, 1));
    assert_eq!(stamina(d, key), maximum);
    assert_eq!(balance(d, game_id), 96);
    assert!(!buy_stamina(d, key, 1));
    set_stamina(d, key, 20);
    super::progression::place_army_at_depth(d, key, 3);
    assert!(!buy_stamina(d, key, 1));
    assert_eq!(balance(d, game_id), 96);
}
