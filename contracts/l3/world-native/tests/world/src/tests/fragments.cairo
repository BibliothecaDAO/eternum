use starknet::storage::StorageMapReadAccess;
use crate::fragments::{BuyStamina, FragmentCredit};
use crate::stamina::StaminaSourceTrait;
use crate::troops::{ExplorerRecordTrait, StaminaSource};
use super::entry::IHomeGrantsSafeDispatcherTrait;

#[feature("safe_dispatcher")]
fn credit(d: super::Deployment, game_id: u32, credit: FragmentCredit) -> bool {
    snforge_std::start_cheat_caller_address(d.games, super::authority());
    let credited = super::entry::IHomeGrantsSafeDispatcher { contract_address: d.games }
        .credit_fragments(game_id, credit)
        .is_ok();
    snforge_std::stop_cheat_caller_address(d.games);
    credited
}

fn purchase(d: super::Deployment, id: felt252, amount: u128) -> FragmentCredit {
    FragmentCredit { id, account: d.actor, source: crate::fragments::PURCHASE, amount }
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
            let rules = crate::commands::load_context(key.game_id, 0, 360).rules.unbox();
            let maximum = crate::progression::stamina_max(
                crate::logic::progression::require(key), army.troops.category, rules.troop_stamina_config,
            );
            let mut bar = army.troops.stamina.inline();
            bar.amount = maximum - deficit;
            bar.settled_at = 360;
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
        360,
    )
}

#[test]
#[feature("safe_dispatcher")]
fn only_the_ledger_operator_credits_fragments_once_for_each_credit_id() {
    let (d, game_id, _) = super::registrar::setup_frontier_relics();
    super::entry::set_operator(d, super::authority());
    snforge_std::start_cheat_caller_address(d.games, d.actor);
    assert!(
        super::entry::IHomeGrantsSafeDispatcher { contract_address: d.games }
            .credit_fragments(game_id, purchase(d, 'receipt-1', 100))
            .is_err(),
    );
    snforge_std::stop_cheat_caller_address(d.games);
    assert!(credit(d, game_id, purchase(d, 'receipt-1', 100)));
    assert!(credit(d, game_id, purchase(d, 'receipt-1', 100)));
    assert!(!credit(d, game_id, purchase(d, 'receipt-1', 500)));
    assert!(!credit(d, game_id, FragmentCredit { source: 3, ..purchase(d, 'receipt-2', 100) }));
    assert!(!credit(d, game_id, purchase(d, 'receipt-2', 0)));
    assert!(credit(d, game_id, FragmentCredit { source: crate::fragments::FRIEND, ..purchase(d, 'friend-1', 100) }));
    assert_eq!(balance(d, game_id), 200);
}

#[test]
fn a_seal_costs_one_thousand_fragments_and_is_bought_once() {
    let (d, game_id, _) = super::registrar::setup_frontier_relics();
    super::entry::set_operator(d, super::authority());
    let buy = crate::commands::Command::BuySeal(());
    assert!(credit(d, game_id, purchase(d, 'receipt-1', 999)));
    assert!(!super::resource_commands::execute_in_game(d, game_id, buy, 360));
    assert!(credit(d, game_id, purchase(d, 'receipt-2', 1001)));
    assert!(super::resource_commands::execute_in_game(d, game_id, buy, 360));
    assert_eq!(balance(d, game_id), 1000);
    assert!(
        snforge_std::interact_with_state(
            d.games, || crate::state::read().entry.seals.read((game_id, d.actor)).is_some(),
        ),
    );
    assert!(!super::resource_commands::execute_in_game(d, game_id, buy, 360));
    assert_eq!(balance(d, game_id), 1000);
}

#[test]
fn a_fragment_refills_two_points_above_the_deep_never_past_the_bar_and_none_in_the_deep() {
    let (d, game_id, key) = super::registrar::setup_frontier_relics();
    super::entry::set_operator(d, super::authority());
    assert!(credit(d, game_id, purchase(d, 'receipt-1', 100)));
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
