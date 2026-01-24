//! Mock MMR Token Contract for Testing
//!
//! A simple mock implementation of the IMMRToken interface for testing
//! the MMR systems without needing a full token deployment.
//!
//! Key behavior:
//! - balance_of returns actual stored value (0 if player has never been set)
//! - get_player_mmr returns INITIAL_MMR (1000e18) if player has never been set
//! - update_mmr stores the new value (with floor enforcement)
//! - set_mmr is a test helper to set MMR directly

use starknet::ContractAddress;

// MMR Constants (with 18 decimals like standard ERC20)
pub const INITIAL_MMR: u256 = 1000_000000000000000000; // 1000e18
pub const MIN_MMR: u256 = 100_000000000000000000; // 100e18

/// Mock MMR token interface for testing
#[starknet::interface]
pub trait IMockMMRToken<T> {
    /// Get player's actual stored balance (standard ERC20 behavior)
    /// Returns 0 if player has never been initialized
    fn balance_of(self: @T, player: ContractAddress) -> u256;

    /// Get player's effective MMR for game logic
    /// Returns INITIAL_MMR (1000e18) if player has never been initialized
    fn get_player_mmr(self: @T, player: ContractAddress) -> u256;

    /// Update a player's MMR (enforces floor)
    fn update_mmr(ref self: T, player: ContractAddress, new_mmr: u256);

    /// Batch update multiple players' MMR
    fn update_mmr_batch(ref self: T, updates: Array<(ContractAddress, u256)>);

    /// Test helper: set MMR directly (bypasses floor for testing edge cases)
    fn set_mmr(ref self: T, player: ContractAddress, mmr: u256);
}

#[starknet::contract]
pub mod MockMMRToken {
    use core::num::traits::Zero;
    use starknet::ContractAddress;
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use super::{INITIAL_MMR, MIN_MMR};

    #[storage]
    struct Storage {
        /// MMR values (0 means uninitialized)
        mmr_values: Map<ContractAddress, u256>,
    }

    #[abi(embed_v0)]
    impl MockMMRTokenImpl of super::IMockMMRToken<ContractState> {
        fn balance_of(self: @ContractState, player: ContractAddress) -> u256 {
            // Standard ERC20 behavior: return actual stored balance (0 if never set)
            self.mmr_values.read(player)
        }

        fn get_player_mmr(self: @ContractState, player: ContractAddress) -> u256 {
            let stored = self.mmr_values.read(player);
            // Return INITIAL_MMR if player has never been set
            if stored.is_zero() {
                INITIAL_MMR
            } else {
                stored
            }
        }

        fn update_mmr(ref self: ContractState, player: ContractAddress, new_mmr: u256) {
            // Enforce minimum floor
            let final_mmr = if new_mmr < MIN_MMR {
                MIN_MMR
            } else {
                new_mmr
            };
            self.mmr_values.write(player, final_mmr);
        }

        fn update_mmr_batch(ref self: ContractState, updates: Array<(ContractAddress, u256)>) {
            for (player, new_mmr) in updates {
                let final_mmr = if new_mmr < MIN_MMR {
                    MIN_MMR
                } else {
                    new_mmr
                };
                self.mmr_values.write(player, final_mmr);
            }
        }

        fn set_mmr(ref self: ContractState, player: ContractAddress, mmr: u256) {
            // Test helper - allows setting any value including below floor for testing
            self.mmr_values.write(player, mmr);
        }
    }
}
