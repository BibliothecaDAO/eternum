use snforge_std::signature::KeyPairTrait;
use snforge_std::signature::stark_curve::{StarkCurveKeyPair, StarkCurveKeyPairImpl, StarkCurveSignerImpl};
use snforge_std::{start_cheat_block_timestamp, start_cheat_caller_address, start_cheat_chain_id};
use starknet::storage::StorageMapReadAccess;
use world_test_support::tests::state::ResourceObservationTrait;
use crate::commands::Command;
use crate::deposits::{DepositSource, LordsDeposit, SpendLords, authorization_hash, deposit_hash};
use crate::entry::{
    ILedgerOperatorDispatcher, ILedgerOperatorDispatcherTrait, ILedgerOperatorSafeDispatcher,
    ILedgerOperatorSafeDispatcherTrait,
};
use crate::registrar::{CreateGameParams, IRegistrarDispatcherTrait};
use crate::resources::{IResourceOperationsDispatcher, IResourceOperationsDispatcherTrait, ResourceKey, ResourceSlot};
use crate::stamina::StaminaSourceTrait;
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
    let (d, game_id, army) = super::registrar::setup_frontier_chests();
    let realm = GameState { contract_address: d.games }.resolved_explorer(army).unwrap().owner;
    let other_game = super::registrar::registry(d)
        .create_game(
            CreateGameParams {
                name: 'other-deposits',
                dev_mode_on: true,
                end_grace_seconds: 0,
                duration_seconds: 2 * super::registrar::BAG_SECONDS,
                ..super::registrar::params(false),
            },
        );
    assert!(other_game != game_id);
    super::play_fixture::reserve_fixture_homes(d.games, other_game, d.actor);
    assert!(
        super::registrar::execute_in_game(
            d,
            other_game,
            crate::commands::Command::SettleSeason(
                crate::realms::SettleSeason { selected_realm: Some(1), aspect: None },
            ),
            350,
        ),
    );
    let source = DepositSource {
        chain: 'SN_TEST', ledger: 'ledger'.try_into().unwrap(), signer: key().public_key, epoch: 0,
    };
    let entry = ILedgerOperatorDispatcher { contract_address: d.games };
    let safe = ILedgerOperatorSafeDispatcher { contract_address: d.games };
    super::entry::set_operator(d, super::authority());
    start_cheat_caller_address(d.games, super::authority());
    start_cheat_chain_id(d.games, 'shard');
    start_cheat_block_timestamp(d.games, 362);
    entry.configure_deposits(game_id, source);
    entry.configure_deposits(other_game, source);
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
    assert_eq!(safe.deliver_deposit(other_game, payment, r, s, false).unwrap_err(), signature_error);
    assert!(entry.deposit_receipt(other_game, payment.id).is_none());
    assert_eq!(entry.spend_lords(other_game, d.actor), SpendLords { available: 0, consumed: 0, swept: 0 });
    let (other_r, other_s) = sign(source, d.games, other_game, payment, false);
    entry.deliver_deposit(other_game, payment, other_r, other_s, false);
    entry.deliver_deposit(other_game, payment, other_r, other_s, false);
    assert_eq!(entry.spend_lords(other_game, d.actor), SpendLords { available: 40, consumed: 0, swept: 0 });
    assert_eq!(entry.spend_lords(game_id, d.actor), SpendLords { available: 40, consumed: 0, swept: 0 });
    assert_eq!(
        entry.deposit_receipt(other_game, payment.id).unwrap().commitment,
        deposit_hash(source, 'shard', d.games, other_game, payment),
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
    entry.configure_deposits(game_id, rotated);
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
fn purchased_refill_changes_stamina_without_reward_issuance_or_withdrawable_resources() {
    assert_purchased_refill_isolated(false);
}

#[test]
fn purchased_refill_remains_isolated_with_per_depth_ruins() {
    assert_purchased_refill_isolated(true);
}

fn assert_purchased_refill_isolated(per_depth_ruins: bool) {
    let (d, game_id, key_army) = super::registrar::setup_frontier_chests();
    if per_depth_ruins {
        super::registrar::apply_ruin_depth_release(d, game_id);
    }
    let army = GameState { contract_address: d.games }.resolved_explorer(key_army).unwrap();
    let mut tired = army.troops;
    let mut bar = tired.stamina.inline();
    bar.amount = 40;
    tired.stamina = crate::troops::StaminaSource::Inline(bar);
    let tired = tired;
    snforge_std::interact_with_state(
        d.games,
        || {
            let record = crate::state::read().troops.explorers.read((game_id, key_army.explorer_id));
            crate::logic::army_slot_storage::persist(key_army, record, tired);
        },
    );
    let entry = ILedgerOperatorDispatcher { contract_address: d.games };
    let source = DepositSource {
        chain: 'SN_TEST', ledger: 'ledger'.try_into().unwrap(), signer: key().public_key, epoch: 0,
    };
    super::entry::set_operator(d, super::authority());
    start_cheat_caller_address(d.games, super::authority());
    start_cheat_chain_id(d.games, 'shard');
    start_cheat_block_timestamp(d.games, 362);
    entry.configure_deposits(game_id, source);
    let payment = LordsDeposit {
        id: 1,
        account: d.actor,
        realms_id: 'identity',
        home: army.owner,
        payer: 'payer'.try_into().unwrap(),
        amount: 50,
        paid_at: 362,
    };
    let (r, s) = sign(source, d.games, game_id, payment, false);
    entry.deliver_deposit(game_id, payment, r, s, false);
    snforge_std::stop_cheat_caller_address(d.games);
    let relics = crate::relics::IRelicsDispatcher { contract_address: d.games };
    let before = crate::relics::IRelicsDispatcherTrait::lords_budget(relics, game_id);
    assert!(
        super::registrar::execute_in_game(
            d,
            game_id,
            Command::RefillStamina(crate::relics::RefillStamina { explorer_id: key_army.explorer_id, amount: 30 }),
            362,
        ),
    );
    assert_eq!(
        GameState { contract_address: d.games }.resolved_explorer(key_army).unwrap().troops.stamina.inline().amount, 70,
    );
    assert_eq!(entry.spend_lords(game_id, d.actor), SpendLords { available: 20, consumed: 30, swept: 0 });
    assert_eq!(crate::relics::IRelicsDispatcherTrait::lords_budget(relics, game_id), before);
    assert_eq!(
        IResourceOperationsDispatcher { contract_address: d.games }
            .resource_balance(ResourceSlot { game_id, entity_id: army.owner, resource_type: crate::resources::LORDS }),
        0,
    );
    assert!(
        !super::registrar::execute_in_game(
            d,
            game_id,
            Command::WithdrawLords(crate::relics::WithdrawLords { structure_id: army.owner, amount: 1 }),
            362,
        ),
    );
    assert_eq!(entry.spend_lords(game_id, d.actor).available, 20);
}

#[test]
#[feature("safe_dispatcher")]
fn principal_only_sweep_needs_no_published_reward_budget() {
    let (d, game_id, key_army) = super::registrar::setup_unfunded_frontier_chests();
    let realm = GameState { contract_address: d.games }.resolved_explorer(key_army).unwrap().owner;
    let entry = ILedgerOperatorDispatcher { contract_address: d.games };
    let safe = ILedgerOperatorSafeDispatcher { contract_address: d.games };
    let source = DepositSource {
        chain: 'SN_TEST', ledger: 'ledger'.try_into().unwrap(), signer: key().public_key, epoch: 0,
    };
    super::entry::set_operator(d, super::authority());
    start_cheat_caller_address(d.games, super::authority());
    start_cheat_chain_id(d.games, 'shard');
    start_cheat_block_timestamp(d.games, 362);
    entry.configure_deposits(game_id, source);
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
    assert!(safe.publish_frontier_pool(game_id, 100, 0).is_err());
    start_cheat_caller_address(d.games, d.actor);
    assert!(safe.sweep_lords(game_id, realm).is_err());
    start_cheat_caller_address(d.games, super::authority());
    entry.sweep_lords(game_id, realm);
    entry.sweep_lords(game_id, realm);
    assert_eq!(entry.spend_lords(game_id, d.actor), SpendLords { available: 0, consumed: 0, swept: 40 });
    assert_eq!(entry.principal_withdrawal(game_id, d.actor).unwrap().amount, 40);
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::lords_budget::budget(game_id)).is_none());
}

#[test]
#[feature("safe_dispatcher")]
fn mixed_sweep_keeps_both_balances_game_pinned_until_applied() {
    let (d, game_id, key_army) = super::registrar::setup_frontier_chests();
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
            362,
            crate::commands::resource_context(context),
        );
    let entry = ILedgerOperatorDispatcher { contract_address: d.games };
    let source = DepositSource {
        chain: 'SN_TEST', ledger: 'ledger'.try_into().unwrap(), signer: key().public_key, epoch: 0,
    };
    start_cheat_caller_address(d.games, super::authority());
    start_cheat_chain_id(d.games, 'shard');
    start_cheat_block_timestamp(d.games, 362);
    entry.configure_deposits(game_id, source);
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
            crate::logic::release::Release {
                classes: games_storage::release::LogicClasses {
                    prizes: super::declare_logic("ChangedSweepPrizesFixture"), ..original.classes,
                },
                ..original,
            },
        );
    assert_eq!(releases.current_release(), 2);
    assert_eq!(releases.game_release(game_id), 1);
    assert_eq!(releases.release(2).classes.bridge, original.classes.bridge);
    assert_eq!(
        resources.resource_balance(ResourceSlot { game_id, entity_id: home, resource_type: crate::resources::LORDS }),
        30 * crate::rules::RESOURCE_PRECISION,
    );
    assert_eq!(entry.spend_lords(game_id, d.actor), SpendLords { available: 40, consumed: 0, swept: 0 });
    assert!(entry.principal_withdrawal(game_id, d.actor).is_none());
    let budget = snforge_std::interact_with_state(d.games, || crate::logic::lords_budget::budget(game_id));
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
    assert_eq!(snforge_std::interact_with_state(d.games, || crate::logic::lords_budget::budget(game_id)), budget);
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
    assert_eq!(snforge_std::interact_with_state(d.games, || crate::logic::lords_budget::budget(game_id)), budget);
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
fn season_one_rejects_lords_commands_and_cannot_configure_deposits() {
    let (d, game_id) = super::registrar::setup_open_frontier_preset("season-one", 1);
    let (release, preset) = super::play_fixture::pins(d.games, game_id);
    super::play_fixture::caller(d.games, d.actor, 360);
    for command in array![
        Command::OpenRelicChest(
            crate::relics::OpenChest { explorer_id: 1, coord: crate::troops::Coord { alt: false, x: 0, y: 0 } },
        ),
        Command::RefillStamina(crate::relics::RefillStamina { explorer_id: 1, amount: 1 }),
        Command::WithdrawLords(crate::relics::WithdrawLords { structure_id: 1, amount: 1 }),
    ] {
        super::assert_entry_refusal(
            d, game_id, release, preset, super::play_fixture::encode(command), "command disabled",
        );
    }
    start_cheat_caller_address(d.games, super::authority());
    let source = DepositSource {
        chain: 'SN_TEST', ledger: 'ledger'.try_into().unwrap(), signer: key().public_key, epoch: 0,
    };
    assert!(ILedgerOperatorSafeDispatcher { contract_address: d.games }.configure_deposits(game_id, source).is_err());
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::deposits::source(game_id)).is_none());
}
