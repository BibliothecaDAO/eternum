use starknet::storage::StorageMapReadAccess;
use crate::entry::{ILedgerOperatorSafeDispatcher, ILedgerOperatorSafeDispatcherTrait};
use crate::resources::{IResourceOperationsDispatcher, IResourceOperationsDispatcherTrait, ResourceKey};

#[test]
#[feature("safe_dispatcher")]
fn automatic_sweep_returns_earned_lords_once_without_a_budget() {
    let (d, game_id, _) = super::registrar::setup_frontier_relics();
    let realm = ResourceKey { game_id, entity_id: 1 };
    let context = snforge_std::interact_with_state(d.games, || crate::commands::load_context(game_id, 0, 360));
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    snforge_std::start_cheat_caller_address(d.games, d.games);
    resources
        .grant_resource(
            realm,
            crate::resources::LORDS,
            40 * crate::rules::RESOURCE_PRECISION,
            360,
            crate::commands::resource_context(context),
        );
    snforge_std::stop_cheat_caller_address(d.games);
    super::entry::set_operator(d, super::authority());
    let operator = ILedgerOperatorSafeDispatcher { contract_address: d.games };
    snforge_std::start_cheat_caller_address(d.games, super::authority());
    snforge_std::start_cheat_block_timestamp(d.games, context.game.unbox().end_at - 1);
    assert!(operator.sweep_lords(game_id, 1).is_err());
    snforge_std::start_cheat_block_timestamp(d.games, context.game.unbox().end_at);
    snforge_std::start_cheat_caller_address(d.games, d.actor);
    assert!(operator.sweep_lords(game_id, 1).is_err());
    snforge_std::start_cheat_caller_address(d.games, super::authority());
    snforge_std::start_cheat_transaction_hash(d.games, 88201);
    assert!(operator.sweep_lords(game_id, 1).is_ok());
    let withdrawal = snforge_std::interact_with_state(
        d.games, || crate::state::read().relics.lords_withdrawals.read(88201).unwrap(),
    );
    assert_eq!(
        (withdrawal.account, withdrawal.amount, withdrawal.prize_rank, withdrawal.prize_count), (d.actor, 40, 0, 0),
    );
    assert_eq!(
        snforge_std::interact_with_state(d.games, || crate::logic::resources::balance(realm, crate::resources::LORDS)),
        0,
    );
    snforge_std::start_cheat_transaction_hash(d.games, 88202);
    assert!(operator.sweep_lords(game_id, 1).is_ok());
    assert!(
        snforge_std::interact_with_state(
            d.games, || crate::state::read().relics.lords_withdrawals.read(88202).is_none(),
        ),
    );
    assert!(operator.sweep_lords(game_id, 99999).is_err());
}
