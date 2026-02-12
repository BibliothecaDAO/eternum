// SPDX-License-Identifier: MIT
//
// Blitz MMR Token Contract
//
// A soul-bound ERC20 token representing player Matchmaking Rating (MMR).
// Key features:
// - Non-transferable: All transfer functions revert (soul-bound)
// - Only authorized game contracts can update MMR
// - balance_of returns actual stored balance (0 for uninitialized)
// - get_player_mmr returns INITIAL_MMR for uninitialized players
// - Minimum MMR floor enforced on updates

use starknet::ContractAddress;


#[starknet::interface]
pub trait IMMRFactoryContract<T> {
    fn is_factory_mmr_contract(self: @T, addr: ContractAddress) -> bool;
    fn set_factory_details(ref self: T, addr: ContractAddress, version: felt252);
}

#[starknet::interface]
pub trait IWorldFactoryMMR<T> {
    fn get_factory_mmr_contract_version(self: @T, addr: ContractAddress) -> felt252;
}

/// MMR-specific interface for the token
#[starknet::interface]
pub trait IMMRToken<TContractState> {
    /// Get player's actual stored balance (standard ERC20 behavior)
    /// Returns 0 if player has never been initialized
    fn balance_of(self: @TContractState, player: ContractAddress) -> u256;

    /// Get player's effective MMR for game logic
    /// Returns INITIAL_MMR if player has never been initialized (balance is 0)
    fn get_player_mmr(self: @TContractState, player: ContractAddress) -> u256;

    /// Update a player's MMR to a new value
    /// Can only be called by authorized game contract
    /// Enforces minimum MMR floor
    /// Auto-initializes if this is the player's first update
    fn update_mmr(ref self: TContractState, player: ContractAddress, new_mmr: u256);

    /// Batch update multiple players' MMR
    /// Can only be called by authorized game contract
    fn update_mmr_batch(ref self: TContractState, updates: Array<(ContractAddress, u256)>);
}

/// Minimal ERC20 view interface (no transfers)
#[starknet::interface]
pub trait IERC20View<TContractState> {
    fn total_supply(self: @TContractState) -> u256;
    fn name(self: @TContractState) -> ByteArray;
    fn symbol(self: @TContractState) -> ByteArray;
    fn decimals(self: @TContractState) -> u8;
}

// Role constants
pub const UPGRADER_ROLE: felt252 = selector!("UPGRADER_ROLE");

// MMR Constants (with 18 decimals like standard ERC20)
pub const INITIAL_MMR: u256 = 1000_000000000000000000; // 1000e18 - Starting MMR for new players
pub const MIN_MMR: u256 = 100_000000000000000000; // 100e18 - Hard floor - MMR cannot go below this


#[starknet::contract]
pub mod MMRToken {
    use core::num::traits::Zero;
    use openzeppelin::access::accesscontrol::{AccessControlComponent, DEFAULT_ADMIN_ROLE};
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::upgrades::UpgradeableComponent;
    use openzeppelin::upgrades::interface::IUpgradeable;
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ClassHash, ContractAddress};
    use super::{
        IERC20View, IMMRFactoryContract, IMMRToken, INITIAL_MMR, IWorldFactoryMMRDispatcher,
        IWorldFactoryMMRDispatcherTrait, MIN_MMR, UPGRADER_ROLE,
    };

    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: accesscontrol, event: AccessControlEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);

    // Access control
    #[abi(embed_v0)]
    impl AccessControlMixinImpl = AccessControlComponent::AccessControlMixinImpl<ContractState>;

    // Internal implementations
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        /// MMR balances (0 means uninitialized, will return INITIAL_MMR)
        balances: Map<ContractAddress, u256>,
        /// Factory data
        factory: (ContractAddress, felt252),
        /// Total supply tracking
        total_supply: u256,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        #[substorage(v0)]
        accesscontrol: AccessControlComponent::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        SRC5Event: SRC5Component::Event,
        #[flat]
        AccessControlEvent: AccessControlComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        MMRUpdated: MMRUpdated,
    }

    /// Emitted when a player's MMR is updated
    #[derive(Drop, starknet::Event)]
    struct MMRUpdated {
        #[key]
        player: ContractAddress,
        old_mmr: u256,
        new_mmr: u256,
        timestamp: u64,
    }

    #[constructor]
    fn constructor(ref self: ContractState, default_admin: ContractAddress, upgrader: ContractAddress) {
        // Initialize access control
        self.accesscontrol.initializer();
        self.accesscontrol._grant_role(DEFAULT_ADMIN_ROLE, default_admin);
        self.accesscontrol._grant_role(UPGRADER_ROLE, upgrader);
    }

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.accesscontrol.assert_only_role(UPGRADER_ROLE);
            self.upgradeable.upgrade(new_class_hash);
        }
    }

    #[abi(embed_v0)]
    impl MMRTokenImpl of IMMRToken<ContractState> {
        fn balance_of(self: @ContractState, player: ContractAddress) -> u256 {
            // Standard ERC20 behavior: return actual stored balance (0 if never set)
            self.balances.entry(player).read()
        }

        fn get_player_mmr(self: @ContractState, player: ContractAddress) -> u256 {
            let stored = self.balances.entry(player).read();
            // Return INITIAL_MMR if player has never been set (stored is 0)
            if stored.is_zero() {
                INITIAL_MMR
            } else {
                stored
            }
        }

        fn update_mmr(ref self: ContractState, player: ContractAddress, new_mmr: u256) {
            // Only game contract can update MMR
            let caller = starknet::get_caller_address();
            assert!(self.is_factory_mmr_contract(caller), "MMR: Caller is not authorized game contract");

            // Check if this is first time (before reading balance_of which returns INITIAL_MMR)
            let stored_before = self.balances.entry(player).read();
            let was_uninitialized = stored_before.is_zero();

            // Get current MMR (returns INITIAL_MMR if uninitialized)
            let old_mmr = if was_uninitialized {
                INITIAL_MMR
            } else {
                stored_before
            };

            // Enforce minimum MMR floor
            let final_mmr = if new_mmr < MIN_MMR {
                MIN_MMR
            } else {
                new_mmr
            };

            // Update balance
            self.balances.entry(player).write(final_mmr);

            // Update total supply
            let current_total = self.total_supply.read();
            if was_uninitialized {
                // First time being set - add full amount to total supply
                self.total_supply.write(current_total + final_mmr);
            } else {
                // Already had balance - adjust total supply by delta
                if final_mmr > old_mmr {
                    self.total_supply.write(current_total + (final_mmr - old_mmr));
                } else if final_mmr < old_mmr {
                    self.total_supply.write(current_total - (old_mmr - final_mmr));
                }
            }

            // Emit event
            self.emit(MMRUpdated { player, old_mmr, new_mmr: final_mmr, timestamp: starknet::get_block_timestamp() });
        }

        fn update_mmr_batch(ref self: ContractState, updates: Array<(ContractAddress, u256)>) {
            // Only game contract can update MMR
            let caller = starknet::get_caller_address();
            assert!(self.is_factory_mmr_contract(caller), "MMR: Caller is not authorized game contract");

            for (player, new_mmr) in updates {
                let old_mmr = self.get_player_mmr(player);
                let final_mmr = if new_mmr < MIN_MMR {
                    MIN_MMR
                } else {
                    new_mmr
                };

                // Track if this is first time
                let stored_before = self.balances.entry(player).read();
                let was_zero = stored_before.is_zero();

                // Update balance
                self.balances.entry(player).write(final_mmr);

                // Update total supply
                if was_zero {
                    self.total_supply.write(self.total_supply.read() + final_mmr);
                } else {
                    let current_total = self.total_supply.read();
                    if final_mmr > old_mmr {
                        self.total_supply.write(current_total + (final_mmr - old_mmr));
                    } else if final_mmr < old_mmr {
                        self.total_supply.write(current_total - (old_mmr - final_mmr));
                    }
                }

                self
                    .emit(
                        MMRUpdated { player, old_mmr, new_mmr: final_mmr, timestamp: starknet::get_block_timestamp() },
                    );
            }
        }
    }

    /// ERC20-like view functions for compatibility
    #[abi(embed_v0)]
    impl ERC20ViewImpl of IERC20View<ContractState> {
        fn total_supply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }

        fn name(self: @ContractState) -> ByteArray {
            "Blitz MMR"
        }

        fn symbol(self: @ContractState) -> ByteArray {
            "MMR"
        }

        fn decimals(self: @ContractState) -> u8 {
            18 // Standard ERC20 decimals
        }
    }

    #[abi(embed_v0)]
    impl IMMRFactoryContractImpl of IMMRFactoryContract<ContractState> {
        fn is_factory_mmr_contract(self: @ContractState, addr: ContractAddress) -> bool {
            let (factory_address, factory_version) = self.factory.read();
            assert!(factory_address.is_non_zero(), "MMR: Factory address not set");
            assert!(factory_version.is_non_zero(), "MMR: Factory version not set");

            factory_version == IWorldFactoryMMRDispatcher { contract_address: factory_address }
                .get_factory_mmr_contract_version(addr)
        }

        fn set_factory_details(ref self: ContractState, addr: ContractAddress, version: felt252) {
            self.accesscontrol.assert_only_role(DEFAULT_ADMIN_ROLE);
            self.factory.write((addr, version));
        }
    }
}
