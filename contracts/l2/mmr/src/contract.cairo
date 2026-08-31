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
pub const UPDATER_ROLE: felt252 = selector!("UPDATER_ROLE");

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
    use super::{IERC20View, IMMRToken, INITIAL_MMR, MIN_MMR, UPDATER_ROLE, UPGRADER_ROLE};

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
            self.accesscontrol.assert_only_role(UPDATER_ROLE);
            self.write_player_mmr(player, new_mmr);
        }

        fn update_mmr_batch(ref self: ContractState, updates: Array<(ContractAddress, u256)>) {
            self.accesscontrol.assert_only_role(UPDATER_ROLE);

            for (player, new_mmr) in updates {
                self.write_player_mmr(player, new_mmr);
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

    #[generate_trait]
    impl MMRWriterImpl of MMRWriterTrait {
        fn write_player_mmr(ref self: ContractState, player: ContractAddress, requested_mmr: u256) {
            let stored_mmr = self.balances.entry(player).read();
            let old_mmr = if stored_mmr.is_zero() {
                INITIAL_MMR
            } else {
                stored_mmr
            };
            let new_mmr = if requested_mmr < MIN_MMR {
                MIN_MMR
            } else {
                requested_mmr
            };

            self.balances.entry(player).write(new_mmr);
            self.write_total_supply(stored_mmr, old_mmr, new_mmr);
            self.emit(MMRUpdated { player, old_mmr, new_mmr, timestamp: starknet::get_block_timestamp() });
        }

        fn write_total_supply(ref self: ContractState, stored_mmr: u256, old_mmr: u256, new_mmr: u256) {
            let total_supply = self.total_supply.read();
            if stored_mmr.is_zero() {
                self.total_supply.write(total_supply + new_mmr);
            } else if new_mmr > old_mmr {
                self.total_supply.write(total_supply + (new_mmr - old_mmr));
            } else if new_mmr < old_mmr {
                self.total_supply.write(total_supply - (old_mmr - new_mmr));
            }
        }
    }
}
