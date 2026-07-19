use cartridge_vrf::Source;

#[starknet::interface]
pub trait IAtomicVrfConsumer<TContractState> {
    fn consume_then_mutate(ref self: TContractState, source: Source) -> felt252;
    fn mutation_count(self: @TContractState) -> u64;
    fn last_random(self: @TContractState) -> felt252;
}

#[starknet::contract]
pub mod AtomicVrfConsumer {
    use cartridge_vrf::{IVrfProviderDispatcher, IVrfProviderDispatcherTrait, Source};
    use starknet::ContractAddress;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        provider: ContractAddress,
        mutation_count: u64,
        last_random: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState, provider: ContractAddress) {
        self.provider.write(provider);
    }

    #[abi(embed_v0)]
    impl AtomicVrfConsumerImpl of super::IAtomicVrfConsumer<ContractState> {
        fn consume_then_mutate(ref self: ContractState, source: Source) -> felt252 {
            let provider = IVrfProviderDispatcher { contract_address: self.provider.read() };
            let random = provider.consume_random(source);

            self.mutation_count.write(self.mutation_count.read() + 1);
            self.last_random.write(random);
            random
        }

        fn mutation_count(self: @ContractState) -> u64 {
            self.mutation_count.read()
        }

        fn last_random(self: @ContractState) -> felt252 {
            self.last_random.read()
        }
    }
}
