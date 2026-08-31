#[starknet::component]
pub mod FactoryComponent {
    use ammv2::packages::core::utils::math;
    use core::num::traits::Zero;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ClassHash, ContractAddress, SyscallResultTrait, get_contract_address};

    #[storage]
    pub struct Storage {
        pub fee_to: ContractAddress,
        pub fee_amount: u256,
        pub pair_class_hash: ClassHash,
        pub pair_default_admin: ContractAddress,
        pub pair_upgrader: ContractAddress,
        pub num_of_pairs: u64,
        pub all_pairs: Map<u64, ContractAddress>,
        pub pair: Map<(ContractAddress, ContractAddress), ContractAddress>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        PairCreated: PairCreated,
        FeeToChanged: FeeToChanged,
        FeeAmountChanged: FeeAmountChanged,
        PairDefaultAdminChanged: PairDefaultAdminChanged,
        PairUpgraderChanged: PairUpgraderChanged,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PairCreated {
        #[key]
        pub token0: ContractAddress,
        #[key]
        pub token1: ContractAddress,
        pub pair: ContractAddress,
        pub total_pairs: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct FeeToChanged {
        pub old_fee_to: ContractAddress,
        pub new_fee_to: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct FeeAmountChanged {
        pub old_fee_amount: u256,
        pub new_fee_amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PairDefaultAdminChanged {
        pub old_pair_default_admin: ContractAddress,
        pub new_pair_default_admin: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PairUpgraderChanged {
        pub old_pair_upgrader: ContractAddress,
        pub new_pair_upgrader: ContractAddress,
    }

    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn initializer(
            ref self: ComponentState<TContractState>,
            pair_class_hash: ClassHash,
            pair_default_admin: ContractAddress,
            pair_upgrader: ContractAddress,
        ) {
            assert!(
                !pair_default_admin.is_zero(), "RealmsSwap::Factory::constructor::pair default admin can not be zero",
            );
            assert!(!pair_upgrader.is_zero(), "RealmsSwap::Factory::constructor::pair upgrader can not be zero");
            let pair_class_hash_felt: felt252 = pair_class_hash.into();
            assert!(
                pair_class_hash_felt != 0, "RealmsSwap::Factory::constructor::pair contract class hash can not be zero",
            );

            math::assert_valid_fee_amount(math::DEFAULT_fee_amount);
            self.pair_class_hash.write(pair_class_hash);
            self.fee_amount.write(math::DEFAULT_fee_amount);
            self.pair_default_admin.write(pair_default_admin);
            self.pair_upgrader.write(pair_upgrader);
        }

        fn get_pair(
            self: @ComponentState<TContractState>, token0: ContractAddress, token1: ContractAddress,
        ) -> ContractAddress {
            let pair = self.pair.read((token0, token1));
            if pair.is_zero() {
                self.pair.read((token1, token0))
            } else {
                pair
            }
        }

        fn get_all_pairs(self: @ComponentState<TContractState>) -> Array<ContractAddress> {
            let mut pairs = array![];
            let num_pairs = self.num_of_pairs.read();
            let mut index = 0_u64;
            while index < num_pairs {
                pairs.append(self.all_pairs.read(index));
                index += 1;
            }
            pairs
        }

        fn get_num_of_pairs(self: @ComponentState<TContractState>) -> u64 {
            self.num_of_pairs.read()
        }

        fn get_fee_to(self: @ComponentState<TContractState>) -> ContractAddress {
            self.fee_to.read()
        }

        fn get_fee_amount(self: @ComponentState<TContractState>) -> u256 {
            self.fee_amount.read()
        }

        fn get_pair_default_admin(self: @ComponentState<TContractState>) -> ContractAddress {
            self.pair_default_admin.read()
        }

        fn get_pair_upgrader(self: @ComponentState<TContractState>) -> ContractAddress {
            self.pair_upgrader.read()
        }

        fn get_pair_contract_class_hash(self: @ComponentState<TContractState>) -> ClassHash {
            self.pair_class_hash.read()
        }

        fn create_pair(
            ref self: ComponentState<TContractState>, token_a: ContractAddress, token_b: ContractAddress,
        ) -> ContractAddress {
            assert!(
                !token_a.is_zero() && !token_b.is_zero(),
                "RealmsSwap::Factory::create_pair::tokenA and tokenB must be non zero",
            );
            assert!(token_a != token_b, "RealmsSwap::Factory::create_pair::tokenA and tokenB must be different");

            let existing_pair = self.get_pair(token_a, token_b);
            assert!(
                existing_pair.is_zero(), "RealmsSwap::Factory::create_pair::pair already exists for tokenA and tokenB",
            );

            let (token0, token1) = math::sort_tokens(token_a, token_b);
            let pair_class_hash = self.pair_class_hash.read();
            let pair_default_admin = self.pair_default_admin.read();
            let pair_upgrader = self.pair_upgrader.read();
            let salt = math::pair_salt(token0, token1);

            let mut constructor_calldata = array![];
            constructor_calldata.append(token0.into());
            constructor_calldata.append(token1.into());
            constructor_calldata.append(get_contract_address().into());
            constructor_calldata.append(pair_default_admin.into());
            constructor_calldata.append(pair_upgrader.into());

            let (pair, _) = starknet::syscalls::deploy_syscall(
                pair_class_hash, salt, constructor_calldata.span(), false,
            )
                .unwrap_syscall();

            self.pair.write((token0, token1), pair);

            let pair_index = self.num_of_pairs.read();
            let total_pairs = pair_index + 1;
            self.all_pairs.write(pair_index, pair);
            self.num_of_pairs.write(total_pairs);

            self.emit(PairCreated { token0, token1, pair, total_pairs });

            pair
        }

        fn set_fee_to(ref self: ComponentState<TContractState>, new_fee_to: ContractAddress) {
            let old_fee_to = self.fee_to.read();
            self.fee_to.write(new_fee_to);
            self.emit(FeeToChanged { old_fee_to, new_fee_to });
        }

        fn set_fee_amount(ref self: ComponentState<TContractState>, new_fee_amount: u256) {
            math::assert_valid_fee_amount(new_fee_amount);
            let old_fee_amount = self.fee_amount.read();
            self.fee_amount.write(new_fee_amount);
            self.emit(FeeAmountChanged { old_fee_amount, new_fee_amount });
        }

        fn set_pair_default_admin(ref self: ComponentState<TContractState>, new_pair_default_admin: ContractAddress) {
            assert!(
                !new_pair_default_admin.is_zero(),
                "RealmsSwap::Factory::set_pair_default_admin::new_pair_default_admin must be non zero",
            );
            let old_pair_default_admin = self.pair_default_admin.read();
            self.pair_default_admin.write(new_pair_default_admin);
            self.emit(PairDefaultAdminChanged { old_pair_default_admin, new_pair_default_admin });
        }

        fn set_pair_upgrader(ref self: ComponentState<TContractState>, new_pair_upgrader: ContractAddress) {
            assert!(
                !new_pair_upgrader.is_zero(),
                "RealmsSwap::Factory::set_pair_upgrader::new_pair_upgrader must be non zero",
            );
            let old_pair_upgrader = self.pair_upgrader.read();
            self.pair_upgrader.write(new_pair_upgrader);
            self.emit(PairUpgraderChanged { old_pair_upgrader, new_pair_upgrader });
        }
    }
}
