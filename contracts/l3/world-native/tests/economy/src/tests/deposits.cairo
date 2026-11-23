use snforge_std::signature::KeyPairTrait;
use snforge_std::signature::stark_curve::{StarkCurveKeyPair, StarkCurveKeyPairImpl, StarkCurveSignerImpl};
use snforge_std::{start_cheat_block_timestamp, start_cheat_caller_address, start_cheat_chain_id};
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use world_test_support::tests::state::ResourceObservationTrait;
use crate::commands::Command;
use crate::deposits::{DepositSource, LordsDeposit, SpendLords, authorization_hash, deposit_hash};
use crate::entry::{
    ILedgerOperatorDispatcher, ILedgerOperatorDispatcherTrait, ILedgerOperatorSafeDispatcher,
    ILedgerOperatorSafeDispatcherTrait,
};
use crate::registrar::{CreateGameParams, IRegistrarDispatcherTrait};
use crate::resources::{IResourceOperationsDispatcher, IResourceOperationsDispatcherTrait, ResourceKey, ResourceSlot};
use super::play_fixture::{FIXTURE_START, IPlayFixtureSafeDispatcherTrait};
use super::{GameState, IReleasesDispatcher, IReleasesDispatcherTrait, TroopObservationTrait};

fn key() -> StarkCurveKeyPair {
    KeyPairTrait::from_secret_key(0xc0519)
}
fn sign(
    source: DepositSource, games: starknet::ContractAddress, game: u32, deposit: LordsDeposit, cancel: bool,
) -> (felt252, felt252) {
    key().sign(authorization_hash(deposit_hash(source, 'shard', games, game, deposit), source.epoch, cancel)).unwrap()
}

#[test]
#[feature("safe_dispatcher")]
fn credit_cancel_rotation_and_season_sweep_have_one_irreversible_outcome() {
    let (d, game_id, army) = super::registrar::setup_frontier_relics();
    let realm = GameState { contract_address: d.games }.resolved_explorer(army).unwrap().owner;
    let other_game = super::play_fixture::create_game(d.games, super::play_fixture::fixture_params('other-deposits'));
    assert!(other_game != game_id);
    let other_home = super::play_fixture::settled_home(d, other_game, d.actor, 1, FIXTURE_START);
    let source = DepositSource {
        chain: 'SN_TEST', ledger: 'ledger'.try_into().unwrap(), signer: key().public_key, epoch: 0,
    };
    let entry = ILedgerOperatorDispatcher { contract_address: d.games };
    let safe = ILedgerOperatorSafeDispatcher { contract_address: d.games };
    super::entry::set_operator(d, super::authority());
    start_cheat_caller_address(d.games, super::authority());
    start_cheat_chain_id(d.games, 'shard');
    start_cheat_block_timestamp(d.games, FIXTURE_START + 362);
    seed_deposit_source(d.games, game_id, source);
    seed_deposit_source(d.games, other_game, source);
    let payment = LordsDeposit {
        id: 1,
        account: d.actor,
        realms_id: 'identity',
        home: realm,
        payer: 'payer'.try_into().unwrap(),
        amount: 40,
        paid_at: 362,
    };
    let (r, s) = sign(source, d.games, game_id, payment, false);
    entry.deliver_deposit(game_id, payment, r, s, false);
    entry.deliver_deposit(game_id, payment, r, s, false);
    assert_eq!(entry.spend_lords(game_id, d.actor), SpendLords { available: 40, consumed: 0, swept: 0 });
    assert!(safe.deliver_deposit(game_id, LordsDeposit { amount: 41, ..payment }, r, s, false).is_err());
    let mut signature_error = array![core::byte_array::BYTE_ARRAY_MAGIC];
    let signature_message: ByteArray = "invalid deposit signature";
    signature_message.serialize(ref signature_error);
    signature_error.append('ENTRYPOINT_FAILED');
    signature_error.append('ENTRYPOINT_FAILED');
    let other_payment = LordsDeposit { home: other_home.entity_id, ..payment };
    let (cross_r, cross_s) = sign(source, d.games, game_id, other_payment, false);
    assert_eq!(safe.deliver_deposit(other_game, other_payment, cross_r, cross_s, false).unwrap_err(), signature_error);
    assert!(entry.deposit_receipt(other_game, other_payment.id).is_none());
    assert_eq!(entry.spend_lords(other_game, d.actor), SpendLords { available: 0, consumed: 0, swept: 0 });
    let (other_r, other_s) = sign(source, d.games, other_game, other_payment, false);
    entry.deliver_deposit(other_game, other_payment, other_r, other_s, false);
    entry.deliver_deposit(other_game, other_payment, other_r, other_s, false);
    assert_eq!(entry.spend_lords(other_game, d.actor), SpendLords { available: 40, consumed: 0, swept: 0 });
    assert_eq!(entry.spend_lords(game_id, d.actor), SpendLords { available: 40, consumed: 0, swept: 0 });
    assert_eq!(
        entry.deposit_receipt(other_game, other_payment.id).unwrap().commitment,
        deposit_hash(source, 'shard', d.games, other_game, other_payment),
    );
    let (r, s) = sign(source, d.games, game_id, payment, true);
    assert!(safe.deliver_deposit(game_id, payment, r, s, true).is_err());
    let cancelled = LordsDeposit { id: 2, ..payment };
    let (r, s) = sign(source, d.games, game_id, cancelled, true);
    entry.deliver_deposit(game_id, cancelled, r, s, true);
    let (r, s) = sign(source, d.games, game_id, cancelled, false);
    assert!(safe.deliver_deposit(game_id, cancelled, r, s, false).is_err());
    assert!(entry.deposit_receipt(game_id, 2).unwrap().cancelled);
    let pending = LordsDeposit { id: 3, ..payment };
    let (old_r, old_s) = sign(source, d.games, game_id, pending, false);
    let rotated = DepositSource { epoch: 1, ..source };
    seed_deposit_source(d.games, game_id, rotated);
    assert!(safe.deliver_deposit(game_id, pending, old_r, old_s, false).is_err());
    let (r, s) = sign(rotated, d.games, game_id, pending, false);
    entry.deliver_deposit(game_id, pending, r, s, false);
    assert!(safe.sweep_lords(game_id, realm).is_err());
    let end = super::context(d.games, game_id).game.unbox().end_at;
    start_cheat_block_timestamp(d.games, end);
    entry.sweep_lords(game_id, realm);
    let swept = SpendLords { available: 0, consumed: 0, swept: 80 };
    assert_eq!(entry.spend_lords(game_id, d.actor), swept);
    assert_eq!(entry.principal_withdrawal(game_id, d.actor).unwrap().amount, 80);
    entry.sweep_lords(game_id, realm);
    assert_eq!(entry.spend_lords(game_id, d.actor), swept);
    let late = LordsDeposit { id: 4, ..payment };
    let (r, s) = sign(rotated, d.games, game_id, late, false);
    assert!(safe.deliver_deposit(game_id, late, r, s, false).is_err());
    let (r, s) = sign(rotated, d.games, game_id, late, true);
    entry.deliver_deposit(game_id, late, r, s, true);
    assert_eq!(entry.spend_lords(game_id, d.actor), swept);
    assert_eq!(entry.spend_lords(other_game, d.actor), SpendLords { available: 40, consumed: 0, swept: 0 });
}
#[test]
#[feature("safe_dispatcher")]
fn principal_only_sweep_returns_deposits_once_after_the_season_end() {
    let (d, game_id, key_army) = super::registrar::setup_frontier_relics();
    let realm = GameState { contract_address: d.games }.resolved_explorer(key_army).unwrap().owner;
    let entry = ILedgerOperatorDispatcher { contract_address: d.games };
    let safe = ILedgerOperatorSafeDispatcher { contract_address: d.games };
    let source = DepositSource {
        chain: 'SN_TEST', ledger: 'ledger'.try_into().unwrap(), signer: key().public_key, epoch: 0,
    };
    super::entry::set_operator(d, super::authority());
    start_cheat_caller_address(d.games, super::authority());
    start_cheat_chain_id(d.games, 'shard');
    start_cheat_block_timestamp(d.games, FIXTURE_START + 362);
    seed_deposit_source(d.games, game_id, source);
    let payment = LordsDeposit {
        id: 1,
        account: d.actor,
        realms_id: 'identity',
        home: realm,
        payer: 'payer'.try_into().unwrap(),
        amount: 40,
        paid_at: 362,
    };
    let (r, s) = sign(source, d.games, game_id, payment, false);
    entry.deliver_deposit(game_id, payment, r, s, false);
    assert!(safe.sweep_lords(game_id, realm).is_err());
    let end = super::context(d.games, game_id).game.unbox().end_at;
    start_cheat_block_timestamp(d.games, end + 1000000);
    start_cheat_caller_address(d.games, d.actor);
    assert!(safe.sweep_lords(game_id, realm).is_err());
    start_cheat_caller_address(d.games, super::authority());
    entry.sweep_lords(game_id, realm);
    entry.sweep_lords(game_id, realm);
    assert_eq!(entry.spend_lords(game_id, d.actor), SpendLords { available: 0, consumed: 0, swept: 40 });
    assert_eq!(entry.principal_withdrawal(game_id, d.actor).unwrap().amount, 40);
}

#[test]
#[feature("safe_dispatcher")]
fn mixed_sweep_keeps_both_balances_game_pinned_until_applied() {
    let (d, game_id, key_army) = super::registrar::setup_frontier_relics();
    let home = GameState { contract_address: d.games }.resolved_explorer(key_army).unwrap().owner;
    let realm = ResourceKey { game_id, entity_id: home };
    let context = snforge_std::interact_with_state(d.games, || crate::commands::load_context(game_id, 0, 362));
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, d.games);
    resources
        .grant_resource(
            realm,
            crate::resources::LORDS,
            30 * crate::rules::RESOURCE_PRECISION,
            FIXTURE_START + 362,
            crate::commands::resource_context(context),
        );
    let entry = ILedgerOperatorDispatcher { contract_address: d.games };
    let source = DepositSource {
        chain: 'SN_TEST', ledger: 'ledger'.try_into().unwrap(), signer: key().public_key, epoch: 0,
    };
    super::entry::set_operator(d, super::authority());
    start_cheat_caller_address(d.games, super::authority());
    start_cheat_chain_id(d.games, 'shard');
    start_cheat_block_timestamp(d.games, FIXTURE_START + 362);
    seed_deposit_source(d.games, game_id, source);
    let payment = LordsDeposit {
        id: 1,
        account: d.actor,
        realms_id: 'identity',
        home,
        payer: 'payer'.try_into().unwrap(),
        amount: 40,
        paid_at: 362,
    };
    let (r, s) = sign(source, d.games, game_id, payment, false);
    entry.deliver_deposit(game_id, payment, r, s, false);
    let releases = IReleasesDispatcher { contract_address: d.games };
    let original = releases.release(1);
    releases
        .register_release(
            2,
            crate::logic::release::Release { previous: 1, ..original },
            world_test_support::tests::releases::with_class(
                releases.release_classes(1), crate::slots::PRIZES, super::declare_logic("ChangedSweepFixture"),
            ),
        );
    releases.open_release(2);
    assert_eq!(releases.open_release_of(crate::game::FRONTIER), 2);
    assert_eq!(releases.game_release(game_id), 1);
    assert_eq!(
        *releases.release_classes(2)[crate::slots::BRIDGE.into()],
        *releases.release_classes(1)[crate::slots::BRIDGE.into()],
    );
    assert_eq!(
        resources.resource_balance(ResourceSlot { game_id, entity_id: home, resource_type: crate::resources::LORDS }),
        30 * crate::rules::RESOURCE_PRECISION,
    );
    assert_eq!(entry.spend_lords(game_id, d.actor), SpendLords { available: 40, consumed: 0, swept: 0 });
    assert!(entry.principal_withdrawal(game_id, d.actor).is_none());
    start_cheat_block_timestamp(d.games, context.game.unbox().end_at);
    snforge_std::start_cheat_transaction_hash(d.games, 88203);
    entry.sweep_lords(game_id, home);
    assert_eq!(
        resources.resource_balance(ResourceSlot { game_id, entity_id: home, resource_type: crate::resources::LORDS }),
        0,
    );
    assert_eq!(entry.spend_lords(game_id, d.actor), SpendLords { available: 0, consumed: 0, swept: 40 });
    assert_eq!(entry.principal_withdrawal(game_id, d.actor).unwrap().amount, 40);
    let earned = snforge_std::interact_with_state(
        d.games, || crate::state::read().relics.lords_withdrawals.read(88203).unwrap(),
    );
    assert_eq!((earned.account, earned.amount, earned.prize_rank), (d.actor, 30, 0));
    snforge_std::start_cheat_transaction_hash(d.games, 88204);
    entry.sweep_lords(game_id, home);
    assert!(
        snforge_std::interact_with_state(
            d.games, || crate::state::read().relics.lords_withdrawals.read(88204).is_none(),
        ),
    );
    releases.apply_release(game_id, 2);
    assert_eq!(releases.game_release(game_id), 2);
    snforge_std::start_cheat_transaction_hash(d.games, 88205);
    let safe = ILedgerOperatorSafeDispatcher { contract_address: d.games };
    // Pinned sweep library, administration library, then the Games contract each frame the failure.
    assert_eq!(
        safe.sweep_lords(game_id, home).unwrap_err(),
        array!['sweep release 2', 'ENTRYPOINT_FAILED', 'ENTRYPOINT_FAILED', 'ENTRYPOINT_FAILED'],
    );
    assert_eq!(
        resources.resource_balance(ResourceSlot { game_id, entity_id: home, resource_type: crate::resources::LORDS }),
        0,
    );
    assert_eq!(entry.spend_lords(game_id, d.actor), SpendLords { available: 0, consumed: 0, swept: 40 });
    assert_eq!(entry.principal_withdrawal(game_id, d.actor).unwrap().amount, 40);
    assert!(
        snforge_std::interact_with_state(
            d.games, || crate::state::read().relics.lords_withdrawals.read(88205).is_none(),
        ),
    );
}

#[test]
#[feature("safe_dispatcher")]
fn retired_bridge_command_ids_decode_to_no_command() {
    let (d, game_id) = super::registrar::setup_open_frontier();
    let release = super::play_fixture::pins(d.games, game_id);
    super::play_fixture::caller(d.games, d.actor, FIXTURE_START);
    for retired in array![62_felt252, 63] {
        let before = super::play_fixture::gameplay_snapshot(d.games);
        let result = super::play_fixture::IPlayFixtureSafeDispatcher { contract_address: d.games }
            .play_with_root(game_id, release, array![retired, 1, 1].span(), 123);
        assert!(result.is_err());
        assert_eq!(super::play_fixture::gameplay_snapshot(d.games), before);
    }
}

fn seed_deposit_source(games: starknet::ContractAddress, game_id: u32, source: DepositSource) {
    snforge_std::interact_with_state(
        games,
        || {
            crate::state::write()
                .entry
                .deposit_sources
                .write(game_id, Some((source.chain, source.ledger, source.signer, source.epoch)));
        },
    );
}

#[test_case(0)]
#[test_case(1)]
#[feature("safe_dispatcher")]
fn unknown_command_tags_refuse_before_a_roll(offset: u32) {
    let index: felt252 = (crate::command_routes::COMMAND_ROUTES.span().len() + offset).into();
    let (d, game_id) = super::registrar::setup_open_frontier();
    let release = super::play_fixture::pins(d.games, game_id);
    super::play_fixture::caller(d.games, d.actor, FIXTURE_START);
    let before = super::play_fixture::gameplay_snapshot(d.games);
    let result = super::play_fixture::IPlayFixtureSafeDispatcher { contract_address: d.games }
        .play_with_root(game_id, release, array![index, 1, 1].span(), 123);
    assert!(result.is_err());
    assert_eq!(super::play_fixture::gameplay_snapshot(d.games), before);
}

#[test]
#[feature("safe_dispatcher")]
fn automatic_returns_keep_the_games_bridge_until_its_release_is_applied() {
    let (d, game_id, key_army) = super::registrar::setup_frontier_relics();
    let home = GameState { contract_address: d.games }.resolved_explorer(key_army).unwrap().owner;
    super::entry::set_operator(d, super::authority());
    let releases = IReleasesDispatcher { contract_address: d.games };
    let original = releases.release(1);
    start_cheat_caller_address(d.games, super::authority());
    releases
        .register_release(
            2,
            crate::logic::release::Release { previous: 1, ..original },
            world_test_support::tests::releases::with_class(
                releases.release_classes(1), crate::slots::BRIDGE, super::declare_logic("ChangedSweepFixture"),
            ),
        );
    releases.open_release(2);
    assert_eq!(releases.open_release_of(crate::game::FRONTIER), 2);
    assert_eq!(releases.game_release(game_id), 1);
    let entry = ILedgerOperatorSafeDispatcher { contract_address: d.games };
    assert_eq!(entry.deposit_source(game_id).unwrap(), None);
    assert_eq!(entry.spend_lords(game_id, d.actor).unwrap(), SpendLords { available: 0, consumed: 0, swept: 0 });
    let end = snforge_std::interact_with_state(d.games, || crate::logic::game::game(game_id).end_at);
    start_cheat_block_timestamp(d.games, end);
    assert!(entry.sweep_lords(game_id, home).is_ok());
    releases.apply_release(game_id, 2);
    assert_eq!(releases.game_release(game_id), 2);
    assert_eq!(
        entry.sweep_lords(game_id, home).unwrap_err(),
        array!['sweep release 2', 'ENTRYPOINT_FAILED', 'ENTRYPOINT_FAILED'],
    );
}
