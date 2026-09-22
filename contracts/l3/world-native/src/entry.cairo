use starknet::ContractAddress;

#[starknet::interface]
pub trait ILedgerOperator<T> {
    fn ledger_operator(self: @T) -> ContractAddress;
    fn set_ledger_operator(ref self: T, operator: ContractAddress);
}

#[starknet::component]
pub mod EntryAdministration {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_contract_address};
    use crate::events::RowSet;
    use crate::lifecycle::Lifecycle;
    use crate::lifecycle::Lifecycle::InternalTrait as LifeInternal;

    #[storage]
    pub struct Storage {
        #[flat]
        pub data: games_storage::entry::EntryAdministrationStorage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
    }
    #[embeddable_as(LedgerOperatorImpl)]
    pub impl Administration<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: Lifecycle::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of super::ILedgerOperator<ComponentState<TContractState>> {
        fn ledger_operator(self: @ComponentState<TContractState>) -> ContractAddress {
            self.data.operator.read()
        }
        fn set_ledger_operator(ref self: ComponentState<TContractState>, operator: ContractAddress) {
            get_dep_component!(@self, Life).assert_authority();
            self.data.operator.write(operator);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'LedgerOperator',
                        keys: array![get_contract_address().into()].span(),
                        values: array![operator.into()].span(),
                    },
                );
        }
    }
}
