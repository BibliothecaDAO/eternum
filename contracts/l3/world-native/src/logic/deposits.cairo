use starknet::ContractAddress;
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::deposits::{DepositReceipt, DepositSource, LordsDeposit, PrincipalWithdrawal, SpendLords};

pub fn source(game_id: u32) -> Option<DepositSource> {
    crate::state::read()
        .entry
        .deposit_sources
        .read(game_id)
        .map(|value| {
            let (chain, ledger, signer, epoch) = value;
            DepositSource { chain, ledger, signer, epoch }
        })
}

pub fn configure(game_id: u32, value: DepositSource) {
    crate::logic::release::assert_authority();
    assert!(value.chain != 0 && value.ledger != 0.try_into().unwrap() && value.signer != 0, "invalid deposit source");
    if let Some(previous) = source(game_id) {
        assert!(previous.chain == value.chain && previous.ledger == value.ledger, "deposit source is immutable");
        assert!(value.epoch >= previous.epoch, "deposit signer epoch regressed");
        assert!(value.epoch != previous.epoch || value.signer == previous.signer, "deposit signer epoch reused");
    }
    crate::logic::game::game(game_id);
    assert!(crate::logic::game::rules(game_id).day_unit_seconds != 0, "deposits require Frontier");
    crate::state::write()
        .entry
        .deposit_sources
        .write(game_id, Some((value.chain, value.ledger, value.signer, value.epoch)));
    let mut values = array![];
    value.serialize(ref values);
    emit('DepositSource', array![game_id.into()], values);
}

pub fn balance(game_id: u32, account: ContractAddress) -> SpendLords {
    let (available, consumed, swept) = crate::state::read().entry.spend_lords.read((game_id, account));
    SpendLords { available, consumed, swept }
}

pub fn receipt(game_id: u32, id: u64) -> Option<DepositReceipt> {
    crate::state::read()
        .entry
        .deposit_receipts
        .read((game_id, id))
        .map(
            |value| {
                let (commitment, account, amount, cancelled) = value;
                DepositReceipt { commitment, account, amount, cancelled }
            },
        )
}

/// A signed, immutable L2 receipt is either delivered once or cancelled forever, never both.
pub fn deliver(game_id: u32, deposit: LordsDeposit, r: felt252, s: felt252, cancel: bool) {
    crate::logic::entry::assert_ledger_operator();
    let source = source(game_id).expect('deposits not configured');
    assert!(deposit.id != 0 && deposit.amount != 0, "empty deposit");
    assert!(deposit.account != 0.try_into().unwrap(), "empty deposit beneficiary");
    let commitment = crate::deposits::deposit_hash(
        source, starknet::get_tx_info().unbox().chain_id, starknet::get_contract_address(), game_id, deposit,
    );
    assert!(
        core::ecdsa::check_ecdsa_signature(
            crate::deposits::authorization_hash(commitment, source.epoch, cancel), source.signer, r, s,
        ),
        "invalid deposit signature",
    );
    if let Some(previous) = receipt(game_id, deposit.id) {
        assert!(previous.commitment == commitment && previous.cancelled == cancel, "deposit already resolved");
        return;
    }
    let game = crate::logic::game::game(game_id);
    if !cancel {
        assert!(deposit.paid_at >= game.start_main_at && deposit.paid_at < game.end_at, "deposit outside season");
        assert!(starknet::get_block_timestamp() < game.end_at, "deposit season ended");
        let home = crate::logic::structures::record(crate::resources::ResourceKey { game_id, entity_id: deposit.home });
        assert!(
            home.owner == deposit.account && home.base.category == crate::taxonomy::REALM_CATEGORY,
            "deposit home differs",
        );
        let mut value = balance(game_id, deposit.account);
        value.available += deposit.amount;
        write_balance(game_id, deposit.account, value);
    }
    let value = DepositReceipt { commitment, account: deposit.account, amount: deposit.amount, cancelled: cancel };
    crate::state::write()
        .entry
        .deposit_receipts
        .write((game_id, deposit.id), Some((commitment, deposit.account, deposit.amount, cancel)));
    let mut values = array![];
    value.serialize(ref values);
    emit('DepositReceipt', array![game_id.into(), deposit.id.into()], values);
}

pub fn withdrawal(game_id: u32, account: ContractAddress) -> Option<PrincipalWithdrawal> {
    crate::state::read()
        .entry
        .principal_withdrawals
        .read((game_id, account))
        .map(|amount| PrincipalWithdrawal { amount })
}

/// Called by the existing season-end sweep; the debit and its principal receipt commit together.
pub fn sweep(game_id: u32, account: ContractAddress) {
    let mut value = balance(game_id, account);
    if value.available == 0 {
        return;
    }
    let game = crate::state::read().games.games.entry(game_id);
    assert!(game.preset_id.read() != 0, "game does not exist");
    assert!(starknet::get_block_timestamp() >= game.end_at.read(), "season has not ended");
    assert!(withdrawal(game_id, account).is_none(), "principal already swept");
    let amount = value.available;
    value.available = 0;
    value.swept = amount;
    write_balance(game_id, account, value);
    crate::state::write().entry.principal_withdrawals.write((game_id, account), Some(amount));
    emit('PrincipalWithdrawal', array![game_id.into(), account.into()], array![amount.into()]);
}

fn write_balance(game_id: u32, account: ContractAddress, value: SpendLords) {
    crate::state::write().entry.spend_lords.write((game_id, account), (value.available, value.consumed, value.swept));
    let mut values = array![];
    value.serialize(ref values);
    emit('SpendLords', array![game_id.into(), account.into()], values);
}

fn emit(model: felt252, keys: Array<felt252>, values: Array<felt252>) {
    crate::logic::map::MapState::emit(
        crate::logic::map::MapState::Event::RowSet(
            crate::events::RowSet { version: 1, model, keys: keys.span(), values: values.span() },
        ),
    );
}
