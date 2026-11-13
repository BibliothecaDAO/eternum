#[starknet::interface]
pub trait IEventTransactions<T> {
    fn emit_many(ref self: T, count: u32) -> u32;
    fn emit_nested(ref self: T, count: u32);
}

#[starknet::contract]
pub mod EventTransactions {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use super::{IEventTransactionsDispatcher, IEventTransactionsDispatcherTrait};

    #[storage]
    struct Storage {
        count: u32,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Count: Count,
    }

    #[derive(Drop, starknet::Event)]
    struct Count {
        value: u32,
    }

    #[abi(embed_v0)]
    impl Events of super::IEventTransactions<ContractState> {
        fn emit_many(ref self: ContractState, count: u32) -> u32 {
            let mut total = self.count.read();
            for _ in 0..count {
                total += 1;
                self.emit(Count { value: total });
            }
            self.count.write(total);
            total
        }

        fn emit_nested(ref self: ContractState, count: u32) {
            let dispatcher = IEventTransactionsDispatcher { contract_address: starknet::get_contract_address() };
            dispatcher.emit_many(count);
            dispatcher.emit_many(count);
        }
    }
}
