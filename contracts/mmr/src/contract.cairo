// SPDX-License-Identifier: MIT
//
// Blitz MMR Token Contract
//
// A soul-bound ERC20 token representing player Matchmaking Rating (MMR).
// Key features:
// - Non-transferable: All transfer functions revert (soul-bound)
// - Only authorized game contracts can update MMR
// - Balance represents MMR rating (18 decimals, 1000 MMR = 1000e18)
// - Minimum MMR floor of 100 enforced on updates

use starknet::ContractAddress;

/// MMR-specific interface for the token
#[starknet::interface]
pub trait IMMRToken<TContractState> {
    /// Get player's current MMR (returns raw balance / 1e18 for display)
    fn get_mmr(self: @TContractState, player: ContractAddress) -> u256;

    /// Check if player has been initialized with MMR
    fn has_mmr(self: @TContractState, player: ContractAddress) -> bool;

    /// Initialize a new player with starting MMR (1000)
    /// Can only be called by authorized game contract
    /// Does nothing if player already has MMR
    fn initialize_player(ref self: TContractState, player: ContractAddress);

    /// Update a player's MMR to a new value
    /// Can only be called by authorized game contract
    /// Enforces minimum MMR floor of 100
    fn update_mmr(ref self: TContractState, player: ContractAddress, new_mmr: u256);

    /// Batch update multiple players' MMR
    /// Can only be called by authorized game contract
    fn update_mmr_batch(ref self: TContractState, updates: Array<(ContractAddress, u256)>);
}

/// Minimal ERC20 view interface (no transfers)
/// Note: decimals() is provided by ERC20MetadataImpl
#[starknet::interface]
pub trait IERC20Balance<TContractState> {
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn total_supply(self: @TContractState) -> u256;
}

// Role constants
pub const GAME_ROLE: felt252 = selector!("GAME_ROLE");
pub const UPGRADER_ROLE: felt252 = selector!("UPGRADER_ROLE");

// MMR Constants (in wei, 18 decimals)
pub const INITIAL_MMR: u256 = 1000_000000000000000000; // 1000 MMR
pub const MIN_MMR: u256 = 100_000000000000000000; // 100 MMR (hard floor)
pub const MMR_PRECISION: u256 = 1_000000000000000000; // 1e18


#[starknet::contract]
pub mod MMRToken {
    use core::num::traits::Zero;
    use openzeppelin::access::accesscontrol::AccessControlComponent;
    use openzeppelin::access::accesscontrol::DEFAULT_ADMIN_ROLE;
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::token::erc20::ERC20Component;
    use openzeppelin::upgrades::UpgradeableComponent;
    use openzeppelin::upgrades::interface::IUpgradeable;
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ClassHash, ContractAddress};
    use super::{GAME_ROLE, IERC20Balance, IMMRToken, INITIAL_MMR, MIN_MMR, MMR_PRECISION, UPGRADER_ROLE};

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: accesscontrol, event: AccessControlEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);

    // ERC20 view functions only (no transfer functions exposed)
    #[abi(embed_v0)]
    impl ERC20MetadataImpl = ERC20Component::ERC20MetadataImpl<ContractState>;

    // Access control
    #[abi(embed_v0)]
    impl AccessControlMixinImpl = AccessControlComponent::AccessControlMixinImpl<ContractState>;

    // Internal implementations
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        /// Tracks which players have been initialized with MMR
        initialized: Map<ContractAddress, bool>,
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
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
        ERC20Event: ERC20Component::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        #[flat]
        AccessControlEvent: AccessControlComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        MMRInitialized: MMRInitialized,
        MMRUpdated: MMRUpdated,
    }

    /// Emitted when a player is initialized with starting MMR
    #[derive(Drop, starknet::Event)]
    struct MMRInitialized {
        #[key]
        player: ContractAddress,
        initial_mmr: u256,
        timestamp: u64,
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

    /// Soul-bound implementation: Block ALL transfers
    /// This hook is called before any token movement (transfer, mint, burn)
    /// We allow mints (from = 0) and burns (to = 0) but block transfers
    impl ERC20HooksImpl of ERC20Component::ERC20HooksTrait<ContractState> {
        fn before_update(
            ref self: ERC20Component::ComponentState<ContractState>,
            from: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) {
            // Allow mints (from is zero address)
            if Zero::is_zero(@from) {
                return;
            }

            // Allow burns (recipient is zero address)
            if Zero::is_zero(@recipient) {
                return;
            }

            // Block all transfers between non-zero addresses
            panic!("MMRToken: Soul-bound token cannot be transferred");
        }

        fn after_update(
            ref self: ERC20Component::ComponentState<ContractState>,
            from: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) {
            // No-op
        }
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        default_admin: ContractAddress,
        game_contract: ContractAddress,
        upgrader: ContractAddress,
    ) {
        // Initialize ERC20 with name and symbol
        self.erc20.initializer("Blitz MMR", "MMR");

        // Initialize access control
        self.accesscontrol.initializer();
        self.accesscontrol._grant_role(DEFAULT_ADMIN_ROLE, default_admin);
        self.accesscontrol._grant_role(GAME_ROLE, game_contract);
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
        fn get_mmr(self: @ContractState, player: ContractAddress) -> u256 {
            // Return balance divided by precision for human-readable MMR
            // e.g., 1500e18 balance -> 1500 MMR
            self._get_balance(player) / MMR_PRECISION
        }

        fn has_mmr(self: @ContractState, player: ContractAddress) -> bool {
            self.initialized.entry(player).read()
        }

        fn initialize_player(ref self: ContractState, player: ContractAddress) {
            // Only game contract can initialize players
            self.accesscontrol.assert_only_role(GAME_ROLE);

            // Skip if already initialized
            if self.initialized.entry(player).read() {
                return;
            }

            // Mark as initialized
            self.initialized.entry(player).write(true);

            // Mint initial MMR tokens
            self.erc20.mint(player, INITIAL_MMR);

            // Emit event
            self
                .emit(
                    MMRInitialized {
                        player, initial_mmr: INITIAL_MMR, timestamp: starknet::get_block_timestamp(),
                    },
                );
        }

        fn update_mmr(ref self: ContractState, player: ContractAddress, new_mmr: u256) {
            // Only game contract can update MMR
            self.accesscontrol.assert_only_role(GAME_ROLE);

            // Player must be initialized
            assert!(self.initialized.entry(player).read(), "MMRToken: Player not initialized");

            // Enforce minimum MMR floor
            let final_mmr = if new_mmr < MIN_MMR {
                MIN_MMR
            } else {
                new_mmr
            };

            // Get current balance
            let current_balance = self._get_balance(player);

            // Convert MMR to token amount (multiply by precision)
            let new_balance = final_mmr * MMR_PRECISION;

            // Update balance via mint/burn
            if new_balance > current_balance {
                // Mint the difference
                self.erc20.mint(player, new_balance - current_balance);
            } else if new_balance < current_balance {
                // Burn the difference
                self.erc20.burn(player, current_balance - new_balance);
            }
            // If equal, no change needed

            // Emit event
            self
                .emit(
                    MMRUpdated {
                        player,
                        old_mmr: current_balance / MMR_PRECISION,
                        new_mmr: final_mmr,
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }

        fn update_mmr_batch(ref self: ContractState, updates: Array<(ContractAddress, u256)>) {
            // Only game contract can update MMR
            self.accesscontrol.assert_only_role(GAME_ROLE);

            for (player, new_mmr) in updates {
                // Initialize if needed
                if !self.initialized.entry(player).read() {
                    self.initialized.entry(player).write(true);
                    self.erc20.mint(player, INITIAL_MMR);
                    self
                        .emit(
                            MMRInitialized {
                                player,
                                initial_mmr: INITIAL_MMR,
                                timestamp: starknet::get_block_timestamp(),
                            },
                        );
                }

                // Update MMR
                let final_mmr = if new_mmr < MIN_MMR {
                    MIN_MMR
                } else {
                    new_mmr
                };

                let current_balance = self._get_balance(player);
                let new_balance = final_mmr * MMR_PRECISION;

                if new_balance > current_balance {
                    self.erc20.mint(player, new_balance - current_balance);
                } else if new_balance < current_balance {
                    self.erc20.burn(player, current_balance - new_balance);
                }

                self
                    .emit(
                        MMRUpdated {
                            player,
                            old_mmr: current_balance / MMR_PRECISION,
                            new_mmr: final_mmr,
                            timestamp: starknet::get_block_timestamp(),
                        },
                    );
            }
        }
    }

    /// Expose balance_of for ERC20 compatibility (returns raw balance with 18 decimals)
    /// Note: decimals() and name()/symbol() are provided by ERC20MetadataImpl
    #[abi(embed_v0)]
    impl ERC20BalanceImpl of IERC20Balance<ContractState> {
        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self._get_balance(account)
        }

        fn total_supply(self: @ContractState) -> u256 {
            self._get_total_supply()
        }
    }

    /// Internal helper functions
    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _get_balance(self: @ContractState, account: ContractAddress) -> u256 {
            self.erc20.ERC20_balances.entry(account).read()
        }

        fn _get_total_supply(self: @ContractState) -> u256 {
            self.erc20.ERC20_total_supply.read()
        }
    }
}
