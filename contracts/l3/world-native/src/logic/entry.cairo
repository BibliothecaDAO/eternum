use starknet::Event;
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};

pub fn assert_ledger_operator() {
    let operator = crate::state::read().entry.operator.read();
    assert!(operator != 0.try_into().unwrap() && starknet::get_caller_address() == operator, "only ledger operator");
}

#[starknet::component]
pub mod EntryAdministration {
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use crate::logic::release::ReleaseState;
    use crate::logic::release::ReleaseState::InternalTrait as LifeInternal;

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    pub struct Storage {
        #[flat]
        pub data: crate::state::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: crate::events::RowSet,
    }
    #[embeddable_as(LedgerOperatorImpl)]
    pub impl Administration<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::entry::ILedgerOperator<ComponentState<TContractState>> {
        fn deposit_source(
            self: @ComponentState<TContractState>, game_id: u32,
        ) -> Option<crate::deposits::DepositSource> {
            crate::logic::deposits::source(game_id)
        }
        fn deliver_deposit(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            deposit: crate::deposits::LordsDeposit,
            r: felt252,
            s: felt252,
            cancel: bool,
        ) {
            crate::logic::deposits::deliver(game_id, deposit, r, s, cancel)
        }
        fn deposit_receipt(
            self: @ComponentState<TContractState>, game_id: u32, id: u64,
        ) -> Option<crate::deposits::DepositReceipt> {
            crate::logic::deposits::receipt(game_id, id)
        }
        fn spend_lords(
            self: @ComponentState<TContractState>, game_id: u32, account: ContractAddress,
        ) -> crate::deposits::SpendLords {
            crate::logic::deposits::balance(game_id, account)
        }
        fn principal_withdrawal(
            self: @ComponentState<TContractState>, game_id: u32, account: ContractAddress,
        ) -> Option<crate::deposits::PrincipalWithdrawal> {
            crate::logic::deposits::withdrawal(game_id, account)
        }
        fn ledger_operator(self: @ComponentState<TContractState>) -> ContractAddress {
            self.data.entry.operator.read()
        }
        fn set_ledger_operator(ref self: ComponentState<TContractState>, operator: ContractAddress) {
            get_dep_component!(@self, Life).assert_authority();
            self.data.entry.operator.write(operator);
        }

        fn frontier_prize(self: @ComponentState<TContractState>, game_id: u32) -> crate::entry::FrontierPrize {
            crate::entry::FrontierPrize {
                pool: self.data.entry.prize_pool.read(game_id),
                issued: self.data.entry.prize_issued.read(game_id),
                count: self.data.entry.prize_count.read(game_id),
            }
        }

        fn sweep_lords(ref self: ComponentState<TContractState>, game_id: u32, structure_id: u64) {
            super::assert_ledger_operator();
            crate::relics::ILordsDispatcherTrait::sweep_lords(
                crate::relics::ILordsLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(game_id, crate::slots::PRIZES),
                },
                game_id,
                structure_id,
            );
        }
    }
    #[embeddable_as(HomeGrantsImpl)]
    pub impl HomeGrants<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::entry::IHomeGrants<ComponentState<TContractState>> {
        fn grant_seal(ref self: ComponentState<TContractState>, game_id: u32, account: ContractAddress) {
            super::assert_ledger_operator();
            super::grant_seal(game_id, account)
        }
        fn credit_fragments(
            ref self: ComponentState<TContractState>, game_id: u32, credit: crate::fragments::FragmentCredit,
        ) {
            super::assert_ledger_operator();
            crate::logic::fragments::credit(game_id, credit)
        }
    }
    #[embeddable_as(ResourceContextImpl)]
    pub impl ResourceContextView<
        TContractState, +HasComponent<TContractState>, +Drop<TContractState>,
    > of crate::entry::IResourceContext<ComponentState<TContractState>> {
        fn resource_context(self: @ComponentState<TContractState>, game_id: u32) -> crate::commands::ResourceContext {
            super::grant_resource_context()
        }
    }
}

pub fn grant_seal(game_id: u32, account: starknet::ContractAddress) {
    assert!(account != 0.try_into().unwrap(), "invalid seal account");
    let game = crate::logic::game::game(game_id);
    let timestamp = starknet::get_block_timestamp();
    assert!(game.end_at == 0 || timestamp < game.end_at, "game ended");
    if crate::state::read().entry.seals.read((game_id, account)).is_some() {
        return;
    }
    crate::state::write().entry.seals.write((game_id, account), Some(timestamp));
    crate::logic::map::MapState::emit(
        crate::logic::map::MapState::Event::RowSet(
            crate::events::RowSet {
                version: 1,
                model: 'Seal',
                keys: array![game_id.into(), account.into()].span(),
                values: array![timestamp.into()].span(),
            },
        ),
    );
}

pub fn record_labor_grant(day: u64, grant: crate::entry::LaborGrant) {
    crate::state::write()
        .entry
        .home_labor_grants
        .write((grant.game_id, grant.home, day), Some((grant.account, grant.amount, grant.essence)));
    let event = EntryAdministration::Event::RowSet(
        crate::events::RowSet {
            version: 1,
            model: 'LaborGrant',
            keys: array![grant.game_id.into(), grant.home.into(), day.into()].span(),
            values: array![grant.account.into(), grant.amount.into(), grant.essence.into()].span(),
        },
    );
    let mut keys = array![selector!("AdministrationEvent")];
    let mut data = array![];
    event.append_keys_and_data(ref keys, ref data);
    starknet::syscalls::emit_event_syscall(keys.span(), data.span()).unwrap();
}

#[inline(never)]
fn grant_resource_context() -> crate::commands::ResourceContext {
    crate::commands::ResourceContext {
        troop_capacity: crate::balance::rules::CAPACITY_CONFIG.troop_capacity,
        spire_fee: crate::balance::rules::SPIRE_TRAVEL_ESSENCE_COST,
        delivery_tick: crate::balance::rules::TICK_CONFIG.delivery_tick_in_seconds,
    }
}
