#[starknet::interface]
pub trait IEternumAMM<TState> {
    // --- Swaps ---
    fn swap_lords_for_token(
        ref self: TState, token: starknet::ContractAddress, lords_amount: u256, min_token_out: u256, deadline: u64,
    ) -> u256;

    fn swap_token_for_lords(
        ref self: TState, token: starknet::ContractAddress, token_amount: u256, min_lords_out: u256, deadline: u64,
    ) -> u256;

    fn swap_token_for_token(
        ref self: TState,
        token_in: starknet::ContractAddress,
        token_out: starknet::ContractAddress,
        amount_in: u256,
        min_amount_out: u256,
        deadline: u64,
    ) -> u256;

    // --- Liquidity ---
    fn add_liquidity(
        ref self: TState,
        token: starknet::ContractAddress,
        lords_amount: u256,
        token_amount: u256,
        lords_min: u256,
        token_min: u256,
        deadline: u64,
    ) -> (u256, u256, u256);

    fn remove_liquidity(
        ref self: TState,
        token: starknet::ContractAddress,
        lp_amount: u256,
        lords_min: u256,
        token_min: u256,
        deadline: u64,
    ) -> (u256, u256);

    // --- Admin ---
    fn create_pool(
        ref self: TState,
        token: starknet::ContractAddress,
        lp_fee_num: u256,
        lp_fee_denom: u256,
        protocol_fee_num: u256,
        protocol_fee_denom: u256,
    );

    fn set_pool_fee(
        ref self: TState,
        token: starknet::ContractAddress,
        lp_fee_num: u256,
        lp_fee_denom: u256,
        protocol_fee_num: u256,
        protocol_fee_denom: u256,
    );

    fn set_fee_recipient(ref self: TState, recipient: starknet::ContractAddress);

    fn set_paused(ref self: TState, paused: bool);

    // --- Views ---
    fn get_reserves(self: @TState, token: starknet::ContractAddress) -> (u256, u256);
    fn get_lp_token(self: @TState, token: starknet::ContractAddress) -> starknet::ContractAddress;
    fn get_lords_address(self: @TState) -> starknet::ContractAddress;
    fn get_fee_recipient(self: @TState) -> starknet::ContractAddress;
    fn is_paused(self: @TState) -> bool;
    fn quote_lords_for_token(self: @TState, token: starknet::ContractAddress, lords_amount: u256) -> u256;
    fn quote_token_for_lords(self: @TState, token: starknet::ContractAddress, token_amount: u256) -> u256;
}

#[starknet::contract]
pub mod EternumAMM {
    use core::num::traits::Zero;
    use eternum_amm::lp_token::{ILPTokenDispatcher, ILPTokenDispatcherTrait};
    use eternum_amm::math;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_introspection::src5::SRC5Component;
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin_upgrades::UpgradeableComponent;
    use openzeppelin_upgrades::interface::IUpgradeable;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::syscalls::deploy_syscall;
    use starknet::{
        ClassHash, ContractAddress, SyscallResultTrait, get_block_timestamp, get_caller_address, get_contract_address,
    };

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);

    #[abi(embed_v0)]
    impl OwnableMixinImpl = OwnableComponent::OwnableMixinImpl<ContractState>;

    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    // ============ Storage ============

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        // Core
        lords_address: ContractAddress,
        fee_recipient: ContractAddress,
        paused: bool,
        lp_token_class_hash: ClassHash,
        // Per-pool state
        pool_lords_reserve: Map<ContractAddress, u256>,
        pool_token_reserve: Map<ContractAddress, u256>,
        pool_lp_token: Map<ContractAddress, ContractAddress>,
        pool_exists: Map<ContractAddress, bool>,
        pool_lp_fee_num: Map<ContractAddress, u256>,
        pool_lp_fee_denom: Map<ContractAddress, u256>,
        pool_protocol_fee_num: Map<ContractAddress, u256>,
        pool_protocol_fee_denom: Map<ContractAddress, u256>,
        // Reentrancy
        reentrancy_locked: bool,
    }

    // ============ Events ============

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        PoolCreated: PoolCreated,
        LiquidityAdded: LiquidityAdded,
        LiquidityRemoved: LiquidityRemoved,
        Swap: Swap,
        PoolFeeChanged: PoolFeeChanged,
        FeeRecipientChanged: FeeRecipientChanged,
    }

    #[derive(Drop, starknet::Event)]
    struct PoolCreated {
        #[key]
        token: ContractAddress,
        lp_token: ContractAddress,
        lp_fee_num: u256,
        lp_fee_denom: u256,
        protocol_fee_num: u256,
        protocol_fee_denom: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct LiquidityAdded {
        #[key]
        token: ContractAddress,
        #[key]
        provider: ContractAddress,
        lords_amount: u256,
        token_amount: u256,
        lp_minted: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct LiquidityRemoved {
        #[key]
        token: ContractAddress,
        #[key]
        provider: ContractAddress,
        lords_amount: u256,
        token_amount: u256,
        lp_burned: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Swap {
        #[key]
        user: ContractAddress,
        token_in: ContractAddress,
        token_out: ContractAddress,
        amount_in: u256,
        amount_out: u256,
        protocol_fee: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct PoolFeeChanged {
        #[key]
        token: ContractAddress,
        lp_fee_num: u256,
        lp_fee_denom: u256,
        protocol_fee_num: u256,
        protocol_fee_denom: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct FeeRecipientChanged {
        old_recipient: ContractAddress,
        new_recipient: ContractAddress,
    }

    // ============ Constructor ============

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        lords_address: ContractAddress,
        fee_recipient: ContractAddress,
        lp_token_class_hash: ClassHash,
    ) {
        self.ownable.initializer(owner);
        self.lords_address.write(lords_address);
        self.fee_recipient.write(fee_recipient);
        self.lp_token_class_hash.write(lp_token_class_hash);
    }

    // ============ Upgradeable ============

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.ownable.assert_only_owner();
            self.upgradeable.upgrade(new_class_hash);
        }
    }

    // ============ Internal helpers ============

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _assert_not_paused(self: @ContractState) {
            assert!(!self.paused.read(), "AMM is paused");
        }

        fn _assert_pool_exists(self: @ContractState, token: ContractAddress) {
            assert!(self.pool_exists.read(token), "pool does not exist");
        }

        fn _assert_deadline(self: @ContractState, deadline: u64) {
            assert!(get_block_timestamp() <= deadline, "transaction expired");
        }

        fn _start_reentrancy_guard(ref self: ContractState) {
            assert!(!self.reentrancy_locked.read(), "reentrant call");
            self.reentrancy_locked.write(true);
        }

        fn _end_reentrancy_guard(ref self: ContractState) {
            self.reentrancy_locked.write(false);
        }

        /// Execute a swap within one pool. Updates reserves and returns (net_output, protocol_fee).
        /// Does NOT perform ERC20 transfers — caller is responsible.
        fn _swap_in_pool(
            ref self: ContractState, token: ContractAddress, lords_in: u256, token_in: u256, is_lords_input: bool,
        ) -> (u256, u256) {
            let lords_reserve = self.pool_lords_reserve.read(token);
            let token_reserve = self.pool_token_reserve.read(token);
            let lp_fee_num = self.pool_lp_fee_num.read(token);
            let lp_fee_denom = self.pool_lp_fee_denom.read(token);
            let protocol_fee_num = self.pool_protocol_fee_num.read(token);
            let protocol_fee_denom = self.pool_protocol_fee_denom.read(token);

            let (output, new_lords_reserve, new_token_reserve) = if is_lords_input {
                let token_out = math::get_input_price(lp_fee_num, lp_fee_denom, lords_in, lords_reserve, token_reserve);
                (token_out, lords_reserve + lords_in, token_reserve - token_out)
            } else {
                let lords_out = math::get_input_price(lp_fee_num, lp_fee_denom, token_in, token_reserve, lords_reserve);
                (lords_out, lords_reserve - lords_out, token_reserve + token_in)
            };

            // Compute protocol fee (taken from output)
            let protocol_fee = if protocol_fee_num > 0 && protocol_fee_denom > 0 {
                (output * protocol_fee_num) / protocol_fee_denom
            } else {
                0
            };

            let net_output = output - protocol_fee;

            // Update reserves — protocol fee leaves the pool entirely
            if is_lords_input {
                self.pool_lords_reserve.write(token, new_lords_reserve);
                self.pool_token_reserve.write(token, new_token_reserve - protocol_fee);
            } else {
                self.pool_lords_reserve.write(token, new_lords_reserve - protocol_fee);
                self.pool_token_reserve.write(token, new_token_reserve);
            }

            (net_output, protocol_fee)
        }
    }

    // ============ Main implementation ============

    #[abi(embed_v0)]
    impl EternumAMMImpl of super::IEternumAMM<ContractState> {
        // --- Swaps ---

        fn swap_lords_for_token(
            ref self: ContractState, token: ContractAddress, lords_amount: u256, min_token_out: u256, deadline: u64,
        ) -> u256 {
            self._assert_not_paused();
            self._assert_pool_exists(token);
            self._assert_deadline(deadline);
            assert!(lords_amount > 0, "zero amount");
            self._start_reentrancy_guard();

            let (token_out, protocol_fee) = self._swap_in_pool(token, lords_amount, 0, true);
            assert!(token_out >= min_token_out, "slippage exceeded");

            let caller = get_caller_address();
            let this = get_contract_address();
            let lords = IERC20Dispatcher { contract_address: self.lords_address.read() };
            let resource = IERC20Dispatcher { contract_address: token };

            lords.transfer_from(caller, this, lords_amount);
            resource.transfer(caller, token_out);

            if protocol_fee > 0 {
                resource.transfer(self.fee_recipient.read(), protocol_fee);
            }

            self
                .emit(
                    Swap {
                        user: caller,
                        token_in: self.lords_address.read(),
                        token_out: token,
                        amount_in: lords_amount,
                        amount_out: token_out,
                        protocol_fee,
                    },
                );

            self._end_reentrancy_guard();
            token_out
        }

        fn swap_token_for_lords(
            ref self: ContractState, token: ContractAddress, token_amount: u256, min_lords_out: u256, deadline: u64,
        ) -> u256 {
            self._assert_not_paused();
            self._assert_pool_exists(token);
            self._assert_deadline(deadline);
            assert!(token_amount > 0, "zero amount");
            self._start_reentrancy_guard();

            let (lords_out, protocol_fee) = self._swap_in_pool(token, 0, token_amount, false);
            assert!(lords_out >= min_lords_out, "slippage exceeded");

            let caller = get_caller_address();
            let this = get_contract_address();
            let lords = IERC20Dispatcher { contract_address: self.lords_address.read() };
            let resource = IERC20Dispatcher { contract_address: token };

            resource.transfer_from(caller, this, token_amount);
            lords.transfer(caller, lords_out);

            if protocol_fee > 0 {
                lords.transfer(self.fee_recipient.read(), protocol_fee);
            }

            self
                .emit(
                    Swap {
                        user: caller,
                        token_in: token,
                        token_out: self.lords_address.read(),
                        amount_in: token_amount,
                        amount_out: lords_out,
                        protocol_fee,
                    },
                );

            self._end_reentrancy_guard();
            lords_out
        }

        fn swap_token_for_token(
            ref self: ContractState,
            token_in: ContractAddress,
            token_out: ContractAddress,
            amount_in: u256,
            min_amount_out: u256,
            deadline: u64,
        ) -> u256 {
            self._assert_not_paused();
            self._assert_pool_exists(token_in);
            self._assert_pool_exists(token_out);
            self._assert_deadline(deadline);
            assert!(amount_in > 0, "zero amount");
            assert!(token_in != token_out, "same token");
            self._start_reentrancy_guard();

            // Two internal swaps: token_in -> LORDS -> token_out
            let (lords_intermediate, protocol_fee_1) = self._swap_in_pool(token_in, 0, amount_in, false);
            let (final_out, protocol_fee_2) = self._swap_in_pool(token_out, lords_intermediate, 0, true);

            assert!(final_out >= min_amount_out, "slippage exceeded");

            // Only 2 external ERC20 transfers needed
            let caller = get_caller_address();
            let this = get_contract_address();
            let resource_in = IERC20Dispatcher { contract_address: token_in };
            let resource_out = IERC20Dispatcher { contract_address: token_out };

            resource_in.transfer_from(caller, this, amount_in);
            resource_out.transfer(caller, final_out);

            let fee_recipient = self.fee_recipient.read();
            if protocol_fee_1 > 0 {
                let lords = IERC20Dispatcher { contract_address: self.lords_address.read() };
                lords.transfer(fee_recipient, protocol_fee_1);
            }
            if protocol_fee_2 > 0 {
                resource_out.transfer(fee_recipient, protocol_fee_2);
            }

            self
                .emit(
                    Swap {
                        user: caller,
                        token_in,
                        token_out,
                        amount_in,
                        amount_out: final_out,
                        protocol_fee: protocol_fee_1 + protocol_fee_2,
                    },
                );

            self._end_reentrancy_guard();
            final_out
        }

        // --- Liquidity ---

        fn add_liquidity(
            ref self: ContractState,
            token: ContractAddress,
            lords_amount: u256,
            token_amount: u256,
            lords_min: u256,
            token_min: u256,
            deadline: u64,
        ) -> (u256, u256, u256) {
            self._assert_not_paused();
            self._assert_pool_exists(token);
            self._assert_deadline(deadline);
            self._start_reentrancy_guard();

            let lords_reserve = self.pool_lords_reserve.read(token);
            let token_reserve = self.pool_token_reserve.read(token);

            let (lords_used, token_used) = math::compute_add_liquidity(
                lords_amount, token_amount, lords_reserve, token_reserve,
            );
            assert!(lords_used >= lords_min, "lords below minimum");
            assert!(token_used >= token_min, "token below minimum");

            let lp_token_addr = self.pool_lp_token.read(token);
            let lp_token = ILPTokenDispatcher { contract_address: lp_token_addr };
            let lp_erc20 = IERC20Dispatcher { contract_address: lp_token_addr };
            let total_supply = lp_erc20.total_supply();
            let lp_mint_amount = math::compute_lp_mint(lords_used, lords_reserve, total_supply);
            assert!(lp_mint_amount > 0, "insufficient liquidity minted");

            // Effects
            self.pool_lords_reserve.write(token, lords_reserve + lords_used);
            self.pool_token_reserve.write(token, token_reserve + token_used);

            // Interactions
            let caller = get_caller_address();
            let this = get_contract_address();
            let lords = IERC20Dispatcher { contract_address: self.lords_address.read() };
            let resource = IERC20Dispatcher { contract_address: token };

            lords.transfer_from(caller, this, lords_used);
            resource.transfer_from(caller, this, token_used);
            lp_token.mint(caller, lp_mint_amount);

            self
                .emit(
                    LiquidityAdded {
                        token,
                        provider: caller,
                        lords_amount: lords_used,
                        token_amount: token_used,
                        lp_minted: lp_mint_amount,
                    },
                );

            self._end_reentrancy_guard();
            (lords_used, token_used, lp_mint_amount)
        }

        fn remove_liquidity(
            ref self: ContractState,
            token: ContractAddress,
            lp_amount: u256,
            lords_min: u256,
            token_min: u256,
            deadline: u64,
        ) -> (u256, u256) {
            self._assert_not_paused();
            self._assert_pool_exists(token);
            self._assert_deadline(deadline);
            assert!(lp_amount > 0, "zero lp amount");
            self._start_reentrancy_guard();

            let lords_reserve = self.pool_lords_reserve.read(token);
            let token_reserve = self.pool_token_reserve.read(token);
            let lp_token_addr = self.pool_lp_token.read(token);
            let lp_erc20 = IERC20Dispatcher { contract_address: lp_token_addr };
            let total_supply = lp_erc20.total_supply();

            let (lords_out, token_out) = math::compute_lp_burn(lp_amount, lords_reserve, token_reserve, total_supply);
            assert!(lords_out >= lords_min, "lords below minimum");
            assert!(token_out >= token_min, "token below minimum");

            // Effects
            self.pool_lords_reserve.write(token, lords_reserve - lords_out);
            self.pool_token_reserve.write(token, token_reserve - token_out);

            // Interactions
            let caller = get_caller_address();
            let lp_token = ILPTokenDispatcher { contract_address: lp_token_addr };
            let lords = IERC20Dispatcher { contract_address: self.lords_address.read() };
            let resource = IERC20Dispatcher { contract_address: token };

            lp_token.burn(caller, lp_amount);
            lords.transfer(caller, lords_out);
            resource.transfer(caller, token_out);

            self
                .emit(
                    LiquidityRemoved {
                        token, provider: caller, lords_amount: lords_out, token_amount: token_out, lp_burned: lp_amount,
                    },
                );

            self._end_reentrancy_guard();
            (lords_out, token_out)
        }

        // --- Admin ---

        fn create_pool(
            ref self: ContractState,
            token: ContractAddress,
            lp_fee_num: u256,
            lp_fee_denom: u256,
            protocol_fee_num: u256,
            protocol_fee_denom: u256,
        ) {
            self.ownable.assert_only_owner();
            assert!(!self.pool_exists.read(token), "pool already exists");
            assert!(!token.is_zero(), "invalid token address");
            assert!(lp_fee_denom > 0, "invalid fee denom");
            assert!(lp_fee_num < lp_fee_denom, "fee num must be < denom");
            if protocol_fee_num > 0 {
                assert!(protocol_fee_denom > 0, "invalid protocol fee denom");
                assert!(protocol_fee_num < protocol_fee_denom, "protocol fee num must be < denom");
            }

            // Deploy LP token contract
            let class_hash = self.lp_token_class_hash.read();
            let this = get_contract_address();
            let salt: felt252 = token.into();

            let mut constructor_calldata = array![];
            let name: ByteArray = "Eternum LP Token";
            let symbol: ByteArray = "ELP";
            name.serialize(ref constructor_calldata);
            symbol.serialize(ref constructor_calldata);
            this.serialize(ref constructor_calldata);

            let (lp_token_address, _) = deploy_syscall(class_hash, salt, constructor_calldata.span(), false)
                .unwrap_syscall();

            // Store pool state
            self.pool_exists.write(token, true);
            self.pool_lp_token.write(token, lp_token_address);
            self.pool_lp_fee_num.write(token, lp_fee_num);
            self.pool_lp_fee_denom.write(token, lp_fee_denom);
            self.pool_protocol_fee_num.write(token, protocol_fee_num);
            self.pool_protocol_fee_denom.write(token, protocol_fee_denom);

            self
                .emit(
                    PoolCreated {
                        token,
                        lp_token: lp_token_address,
                        lp_fee_num,
                        lp_fee_denom,
                        protocol_fee_num,
                        protocol_fee_denom,
                    },
                );
        }

        fn set_pool_fee(
            ref self: ContractState,
            token: ContractAddress,
            lp_fee_num: u256,
            lp_fee_denom: u256,
            protocol_fee_num: u256,
            protocol_fee_denom: u256,
        ) {
            self.ownable.assert_only_owner();
            self._assert_pool_exists(token);
            assert!(lp_fee_denom > 0, "invalid fee denom");
            assert!(lp_fee_num < lp_fee_denom, "fee num must be < denom");
            if protocol_fee_num > 0 {
                assert!(protocol_fee_denom > 0, "invalid protocol fee denom");
                assert!(protocol_fee_num < protocol_fee_denom, "protocol fee num must be < denom");
            }

            self.pool_lp_fee_num.write(token, lp_fee_num);
            self.pool_lp_fee_denom.write(token, lp_fee_denom);
            self.pool_protocol_fee_num.write(token, protocol_fee_num);
            self.pool_protocol_fee_denom.write(token, protocol_fee_denom);

            self.emit(PoolFeeChanged { token, lp_fee_num, lp_fee_denom, protocol_fee_num, protocol_fee_denom });
        }

        fn set_fee_recipient(ref self: ContractState, recipient: ContractAddress) {
            self.ownable.assert_only_owner();
            assert!(!recipient.is_zero(), "invalid recipient");
            let old = self.fee_recipient.read();
            self.fee_recipient.write(recipient);
            self.emit(FeeRecipientChanged { old_recipient: old, new_recipient: recipient });
        }

        fn set_paused(ref self: ContractState, paused: bool) {
            self.ownable.assert_only_owner();
            self.paused.write(paused);
        }

        // --- Views ---

        fn get_reserves(self: @ContractState, token: ContractAddress) -> (u256, u256) {
            self._assert_pool_exists(token);
            (self.pool_lords_reserve.read(token), self.pool_token_reserve.read(token))
        }

        fn get_lp_token(self: @ContractState, token: ContractAddress) -> ContractAddress {
            self._assert_pool_exists(token);
            self.pool_lp_token.read(token)
        }

        fn get_lords_address(self: @ContractState) -> ContractAddress {
            self.lords_address.read()
        }

        fn get_fee_recipient(self: @ContractState) -> ContractAddress {
            self.fee_recipient.read()
        }

        fn is_paused(self: @ContractState) -> bool {
            self.paused.read()
        }

        fn quote_lords_for_token(self: @ContractState, token: ContractAddress, lords_amount: u256) -> u256 {
            self._assert_pool_exists(token);
            let lords_reserve = self.pool_lords_reserve.read(token);
            let token_reserve = self.pool_token_reserve.read(token);
            let fee_num = self.pool_lp_fee_num.read(token);
            let fee_denom = self.pool_lp_fee_denom.read(token);
            math::get_input_price(fee_num, fee_denom, lords_amount, lords_reserve, token_reserve)
        }

        fn quote_token_for_lords(self: @ContractState, token: ContractAddress, token_amount: u256) -> u256 {
            self._assert_pool_exists(token);
            let lords_reserve = self.pool_lords_reserve.read(token);
            let token_reserve = self.pool_token_reserve.read(token);
            let fee_num = self.pool_lp_fee_num.read(token);
            let fee_denom = self.pool_lp_fee_denom.read(token);
            math::get_input_price(fee_num, fee_denom, token_amount, token_reserve, lords_reserve)
        }
    }
}
