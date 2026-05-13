// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts for Cairo 0.20.0

//! # Realms Collectible Contract
//!
//! An ERC721 NFT contract with dynamic packed attribute system and token locking capabilities.
//! Features gas-efficient storage, on-chain metadata generation, and role-based access control.

use starknet::ContractAddress;

/// Minting and burning functionality for ERC721 tokens with packed attributes.
///
/// This trait provides core NFT lifecycle management with an efficient attribute packing system
/// that stores up to 16 different trait types in a single u128 value.
#[starknet::interface]
trait ERC721MintBurnTrait<TState> {
    /// Destroys an existing token, removing it from circulation permanently.
    ///
    /// The token is burned using ERC721's update mechanism with zero address as recipient.
    /// This clears ownership, approvals, and enumerable indices but preserves attribute data
    /// in storage for potential future reference.
    ///
    /// # Arguments
    /// * `token_id` - The unique identifier of the token to destroy
    ///
    /// # Requirements
    /// * Token must exist and be owned by someone
    /// * Caller must be the token owner or an approved operator
    /// * Token must not be locked (transfers/burns are blocked for locked tokens)
    ///
    /// # Effects
    /// * Removes token from owner's balance and enumerable list
    /// * Clears all approvals for the token
    /// * Emits Transfer event with zero address as recipient
    /// * Attribute data remains in storage but becomes inaccessible
    fn burn(ref self: TState, token_id: u256);

    fn mint(ref self: TState, recipient: ContractAddress, attributes_raw: u128);
    fn mint_many(ref self: TState, recipient: ContractAddress, attributes_and_counts: Span<(u128, u16)>);

    /// Creates a new NFT with packed attributes and assigns it to the recipient.
    ///
    /// Token IDs are automatically generated using an internal counter, starting from 1.
    /// * The attributes must be pre-configured with IPFS image mappings before minting.
    /// * Attributes are packed into a u128 where each byte (8 bits) represents one trait type (0-15),
    /// and each byte value (1-255) represents a specific trait value within that type.
    ///
    /// # Arguments
    /// * `recipient` - Address that will receive ownership of the newly minted token
    /// * `attributes_raw` - Packed u128 containing trait data where:
    ///   - Each byte position (0-15) represents a trait type
    ///   - Each byte value (1-255) represents a trait value
    ///   - Value 0 means "no trait present" for that type
    ///   - Must be non-zero overall (at least one trait must be set)
    ///
    /// # Requirements
    /// * Caller must have `MINTER_ROLE` permission
    /// * `attributes_raw` cannot be zero (must have at least one trait)
    /// * Either a specific IPFS CID must be set for these exact attributes,
    ///   or a default IPFS CID must be configured
    /// * Recipient address cannot be zero
    ///
    /// # Behavior
    /// * Token ID auto-increments: first mint gets ID 1, second gets ID 2, etc.
    /// * Attributes are stored in packed format for gas efficiency
    /// * Token is immediately transferable unless explicitly locked afterward
    /// * Emits standard ERC721 Transfer and other component events
    ///
    /// # Example
    /// ```cairo
    /// // Mint token with rarity=5, element=1, power=3 (positions 0,1,2)
    /// let attributes = 0x00000000000000000000000000030105_u128;
    /// mint_burn.safe_mint(player_address, attributes);
    /// // Token will have auto-generated ID (e.g., 1, 2, 3...)
    /// ```
    fn safe_mint(ref self: TState, recipient: ContractAddress, attributes_raw: u128);

    /// Creates multiple NFTs with different attribute combinations in a single transaction.
    ///
    /// This is an optimized batch operation that reduces transaction overhead when minting
    /// multiple tokens. Each attribute combination can be minted multiple times by specifying
    /// a count. All tokens go to the same recipient address.
    ///
    /// # Arguments
    /// * `recipient` - Address that will receive all newly minted tokens
    /// * `attributes_and_counts` - Array of (attributes_raw, count) pairs where:
    ///   - `attributes_raw` follows the same rules as single mint
    ///   - `count` specifies how many tokens to mint with those attributes
    ///   - Each pair is processed sequentially
    ///
    /// # Requirements
    /// * Caller must have `MINTER_ROLE` permission
    /// * All attribute combinations must have IPFS CID mappings configured
    /// * Each attributes_raw value must be non-zero
    /// * Count values should be reasonable to avoid gas limit issues
    ///
    /// # Behavior
    /// * Processes each (attributes, count) pair in order
    /// * For each pair, mints 'count' tokens with identical attributes
    /// * Token IDs continue auto-incrementing across the entire batch
    /// * If any mint fails, the entire transaction reverts
    ///
    /// # Example
    /// ```cairo
    /// let batch = array![
    ///     (0x05, 3),    // Mint 3 tokens with rarity=5
    ///     (0x0105, 2),  // Mint 2 tokens with rarity=5, element=1
    /// ];
    /// mint_burn.safe_mint_many(player_address, batch.span());
    /// // Will mint 5 tokens total with consecutive IDs
    /// ```
    fn safe_mint_many(ref self: TState, recipient: ContractAddress, attributes_and_counts: Span<(u128, u16)>);
}

/// Batch transfer operations for efficient multi-token movements.
///
/// Provides optimized functions for transferring multiple tokens in a single transaction,
/// reducing gas costs and improving UX for bulk operations.
#[starknet::interface]
trait ERC721EnumerableTransferAmountTrait<TState> {
    /// Transfers a specified number of tokens from one address to another.
    ///
    /// Uses the enumerable extension to efficiently select tokens in order of ownership.
    /// Always transfers tokens starting from index 0 in the owner's token list, so the
    /// actual tokens transferred depend on the current enumerable ordering.
    ///
    /// # Arguments
    /// * `from` - Current owner of the tokens to transfer
    /// * `to` - Address that will receive the tokens
    /// * `amount` - Number of tokens to transfer (must not exceed balance)
    ///
    /// # Requirements
    /// * Caller must be authorized to transfer tokens on behalf of `from`
    /// * `from` must own at least `amount` tokens
    /// * All selected tokens must be unlocked (not in a locked state)
    /// * Standard ERC721 transfer authorization rules apply
    ///
    /// # Behavior
    /// * Selects tokens using `token_of_owner_by_index(from, 0)` repeatedly
    /// * After each transfer, remaining tokens shift down in enumerable indices
    /// * All transfers are processed atomically - if any fails, all revert
    /// * Each transfer triggers the full ERC721 transfer flow including hooks
    ///
    /// # Returns
    /// Array containing the token IDs that were successfully transferred
    ///
    /// # Gas Considerations
    /// * More efficient than individual transfers due to reduced transaction overhead
    /// * Gas usage scales linearly with the number of tokens transferred
    /// * Large batches may hit block gas limits - consider breaking into smaller chunks
    ///
    /// # Example
    /// ```cairo
    /// // Transfer any 5 tokens from Alice to Bob
    /// let transferred_ids = transfer.transfer_amount(alice, bob, 5);
    /// // transferred_ids contains the IDs of the 5 tokens that moved
    /// ```
    fn transfer_amount(ref self: TState, from: ContractAddress, to: ContractAddress, amount: u16) -> Span<u256>;
}

/// Comprehensive metadata management for NFT traits and visual assets.
///
/// This interface manages the human-readable names for traits, IPFS image mappings,
/// and dynamic metadata generation. It supports a two-tier image system with
/// specific mappings for attribute combinations and fallback defaults.
#[starknet::interface]
trait IRealmsCollectibleMetadata<TState> {
    /// Sets the default IPFS image used when no specific mapping exists for token attributes.
    ///
    /// This serves as the fallback image for any token whose exact attribute combination
    /// doesn't have a custom image mapping. Essential for ensuring all tokens have
    /// valid images in their metadata.
    ///
    /// # Arguments
    /// * `ipfs_cid` - IPFS Content Identifier for the default image (without ipfs:// prefix)
    /// * `overwrite` - Whether to replace an existing default CID
    ///
    /// # Requirements
    /// * Caller must have `METADATA_UPDATER_ROLE`
    /// * If a default CID already exists and differs from the new one, `overwrite` must be true
    /// * IPFS CID should be a valid CID pointing to an accessible image
    ///
    /// # Behavior
    /// * If the same CID is already set, function returns early without changes
    /// * Emits `DefaultIPFSCIDUpdated` event with timestamp
    /// * New default applies to all future metadata generation calls
    /// * Existing token metadata reflects the change immediately on next access
    ///
    /// # Example
    /// ```cairo
    /// metadata.set_default_ipfs_cid("QmDefaultCollectionArt123abc", false);
    /// ```
    fn set_default_ipfs_cid(ref self: TState, ipfs_cid: ByteArray, overwrite: bool);

    /// Maps specific attribute combinations to custom IPFS images.
    ///
    /// Allows setting unique artwork for specific trait combinations, such as legendary
    /// items, special events, or rare attribute pairings. Takes precedence over the
    /// default image when generating metadata.
    ///
    /// # Arguments
    /// * `attrs_raw` - Exact packed attribute combination (u128) to map
    /// * `ipfs_cid` - IPFS Content Identifier for this specific combination
    /// * `overwrite` - Whether to replace an existing mapping for these attributes
    ///
    /// # Requirements
    /// * Caller must have `METADATA_UPDATER_ROLE`
    /// * If mapping already exists for these attributes, `overwrite` must be true
    /// * IPFS CID should point to appropriate artwork for the attribute combination
    ///
    /// # Use Cases
    /// * Legendary rarity items get special golden artwork
    /// * Specific element combinations trigger unique visual effects
    /// * Event-specific attributes display commemorative images
    /// * Ultra-rare combinations showcase one-of-a-kind artwork
    ///
    /// # Behavior
    /// * Mapping is exact - only tokens with precisely these attributes use this image
    /// * Takes priority over default image in metadata generation
    /// * Emits `AttrsRawToIPFSCIDUpdated` event with timestamp
    ///
    /// # Example
    /// ```cairo
    /// // Special art for all legendary items (rarity value 5 in position 0)
    /// metadata.set_attrs_raw_to_ipfs_cid(0x05, "QmLegendaryGoldFrame", false);
    ///
    /// // Unique art for legendary fire warriors
    /// metadata.set_attrs_raw_to_ipfs_cid(0x020105, "QmLegendaryFireWarrior", false);
    /// ```
    fn set_attrs_raw_to_ipfs_cid(ref self: TState, attrs_raw: u128, ipfs_cid: ByteArray, overwrite: bool);

    /// Defines the human-readable name for a trait type category.
    ///
    /// Trait types represent the categories of attributes (like "Rarity", "Element", "Class").
    /// These names appear as "trait_type" in the generated JSON metadata and are crucial
    /// for proper display on NFT marketplaces.
    ///
    /// # Arguments
    /// * `trait_type_id` - Position in the packed attributes (0-15, maps to byte positions)
    /// * `name` - Human-readable category name (e.g., "Rarity", "Element", "Character Class")
    /// * `overwrite` - Whether to replace an existing name for this trait type
    ///
    /// # Requirements
    /// * Caller must have `METADATA_UPDATER_ROLE`
    /// * `trait_type_id` must be between 0 and 15 (corresponds to 16 possible trait types)
    /// * If name already exists for this trait type, `overwrite` must be true
    ///
    /// # Behavior
    /// * Name becomes the "trait_type" field in JSON metadata for this position
    /// * Only affects metadata generation - doesn't change token attributes themselves
    /// * If same name is set again, function returns early without events
    /// * Emits `TraitTypeUpdated` event with timestamp
    ///
    /// # Best Practices
    /// * Use clear, descriptive names that users will understand
    /// * Maintain consistency across your collection
    /// * Consider how names will appear on various NFT platforms
    ///
    /// # Example
    /// ```cairo
    /// metadata.set_trait_type_name(0, "Rarity", false);        // Position 0 = Rarity
    /// metadata.set_trait_type_name(1, "Element", false);       // Position 1 = Element
    /// metadata.set_trait_type_name(2, "Character Class", false); // Position 2 = Class
    /// ```
    fn set_trait_type_name(ref self: TState, trait_type_id: u8, name: ByteArray, overwrite: bool);

    /// Defines human-readable names for specific values within a trait type.
    ///
    /// Maps the numeric trait values (1-255) to descriptive names that appear in metadata.
    /// For example, if trait type 0 is "Rarity", then value 1 might be "Common",
    /// value 5 might be "Legendary", etc.
    ///
    /// # Arguments
    /// * `trait_type_id` - The trait category (0-15)
    /// * `trait_value_id` - The specific numeric value within that category (1-255)
    /// * `name` - Human-readable name for this value (e.g., "Common", "Fire", "Warrior")
    /// * `overwrite` - Whether to replace an existing name for this trait value
    ///
    /// # Requirements
    /// * Caller must have `METADATA_UPDATER_ROLE`
    /// * `trait_type_id` must be 0-15
    /// * `trait_value_id` must be 1-255 (0 is reserved for "no trait present")
    /// * If name already exists for this combination, `overwrite` must be true
    ///
    /// # Behavior
    /// * Name appears as "value" in JSON metadata when this trait is present
    /// * Only traits with both type name AND value name appear in final metadata
    /// * Traits with missing names are filtered out of the attributes array
    /// * Emits `TraitValueUpdated` event with timestamp
    ///
    /// # Planning Considerations
    /// * Reserve lower numbers for common values, higher for rare ones
    /// * Plan your value ranges - you have 255 possible values per trait type
    /// * Consider how trait combinations will work together
    ///
    /// # Example
    /// ```cairo
    /// // Set up rarity values for trait type 0
    /// metadata.set_trait_value_name(0, 1, "Common", false);
    /// metadata.set_trait_value_name(0, 2, "Uncommon", false);
    /// metadata.set_trait_value_name(0, 5, "Legendary", false);
    ///
    /// // Set up element values for trait type 1
    /// metadata.set_trait_value_name(1, 1, "Fire", false);
    /// metadata.set_trait_value_name(1, 2, "Water", false);
    /// metadata.set_trait_value_name(1, 3, "Earth", false);
    /// ```
    fn set_trait_value_name(ref self: TState, trait_type_id: u8, trait_value_id: u8, name: ByteArray, overwrite: bool);

    /// Retrieves the human-readable name for a trait type category.
    ///
    /// # Arguments
    /// * `trait_type_id` - Position in packed attributes (0-15)
    ///
    /// # Returns
    /// The trait type name, or empty string if not set
    ///
    /// # Requirements
    /// * `trait_type_id` must be 0-15
    fn get_trait_type_name(self: @TState, trait_type_id: u8) -> ByteArray;

    /// Retrieves the human-readable name for a specific trait value.
    ///
    /// # Arguments
    /// * `trait_type_id` - Trait category (0-15)
    /// * `trait_value_id` - Specific value within category (1-255)
    ///
    /// # Returns
    /// The trait value name, or empty string if not set
    ///
    /// # Requirements
    /// * `trait_type_id` must be 0-15
    /// * `trait_value_id` must be 1-255
    fn get_trait_value_name(self: @TState, trait_type_id: u8, trait_value_id: u8) -> ByteArray;

    /// Returns the raw packed attribute data for a token.
    ///
    /// Provides direct access to the u128 value containing all trait information.
    /// Useful for efficient attribute checking without metadata generation overhead.
    ///
    /// # Arguments
    /// * `token_id` - The token to query
    ///
    /// # Returns
    /// Raw u128 with packed trait data, or 0 if token doesn't exist
    ///
    /// # Usage
    /// * Efficient for checking specific traits programmatically
    /// * Useful for smart contract integrations that need attribute data
    /// * Can be unpacked using utility functions to get individual trait values
    fn get_metadata_raw(self: @TState, token_id: u256) -> u128;

    /// Generates complete OpenSea-compatible JSON metadata for a token.
    ///
    /// Creates a full metadata JSON structure with name, description, image, and attributes.
    /// Handles image resolution, trait name lookup, and base64 encoding automatically.
    /// This is the function called by `tokenURI()` to provide metadata to marketplaces.
    ///
    /// # Arguments
    /// * `token_id` - The token to generate metadata for
    ///
    /// # Returns
    /// Complete data URI in format: `data:application/json;base64,{encoded_json}`
    ///
    /// # Metadata Generation Process
    /// 1. Retrieves packed attributes from storage
    /// 2. Unpacks into individual trait values (16 bytes)
    /// 3. Resolves IPFS image (specific mapping or default)
    /// 4. Looks up trait type and value names for each non-zero trait
    /// 5. Filters out traits missing either type or value names
    /// 6. Builds JSON with collection name, description, image, and attributes
    /// 7. Encodes as base64 data URI
    ///
    /// # JSON Structure
    /// ```json
    /// {
    ///   "name": "Collection Name #123",
    ///   "description": "Collection description",
    ///   "image": "ipfs://QmSpecificOrDefaultCID",
    ///   "attributes": [
    ///     {"trait_type": "Rarity", "value": "Legendary"},
    ///     {"trait_type": "Element", "value": "Fire"}
    ///   ]
    /// }
    /// ```
    ///
    /// # Requirements
    /// * Token must exist (checked by ERC721 before calling)
    ///
    /// # Performance Notes
    /// * More expensive than `get_metadata_raw()` due to string operations
    /// * Result is not cached - regenerated on each call
    /// * Marketplaces typically cache the result based on token URI
    fn get_metadata_json(self: @TState, token_id: u256) -> ByteArray;
}

/// Lock state enumeration for token transfer restrictions
#[derive(Copy, Drop, Serde)]
enum LockState {
    #[default]
    Inactive,
    Active,
}

/// Token locking system for temporary transfer restrictions.
///
/// Provides a two-tier locking mechanism where administrators define global lock states
/// and token owners choose which locks to apply to their tokens. Locks automatically
/// expire based on timestamps and are enforced through transfer hooks.
#[starknet::interface]
trait IRealmsCollectibleLock<TState> {
    /// Applies a global lock state to a specific token, preventing transfers until expiration.
    ///
    /// Only token owners can lock their own tokens. The lock references a global lock state
    /// that must be active (not expired) at the time of locking. Once locked, the token
    /// cannot be transferred until the lock's expiration timestamp is reached.
    ///
    /// # Arguments
    /// * `token_id` - The token to lock (must be owned by caller)
    /// * `lock_id` - Reference to a global lock state created by administrators
    ///
    /// # Requirements
    /// * Caller must be the current owner of the token (approved operators cannot lock)
    /// * Token must exist and not already be locked
    /// * Referenced lock state must exist and be active (unlock_at > current_time)
    /// * Lock ID cannot be zero (reserved value)
    ///
    /// # Behavior
    /// * Records the lock ID and transaction hash for the token
    /// * Prevents all transfers, including transferFrom, safeTransferFrom, etc.
    /// * Lock persists even if token ownership would normally change
    /// * Automatically unlocks when the lock's expiration time is reached
    /// * Emits `TokenLockStateUpdated` event with Active state
    ///
    /// # Use Cases
    /// * Staking tokens in a pool for a specific duration
    /// * Participating in tournaments or competitions
    /// * Governance voting periods where tokens must remain static
    /// * Seasonal game mechanics requiring temporary restrictions
    ///
    /// # Example
    /// ```cairo
    /// // Player locks their character for a tournament
    /// lock.token_lock(character_id, 'world_championship_2024');
    /// // Token cannot be transferred until tournament lock expires
    /// ```
    fn token_lock(ref self: TState, token_id: u256, lock_id: felt252);

    /// Unlocks a token if its lock period has expired (callable by anyone).
    ///
    /// Note: you dont need to call this function for tokens to get unlocked.
    /// They get unlocked automatically when the lock period expires. This function is only
    /// useful if you want to unlock a token manually (for maybe a unique reason)
    /// before the lock period expires.
    ///
    /// This function checks if a token's lock has expired and removes the lock if so.
    /// It can be called by anyone, not just the token owner, making it a public utility.
    /// The function is also called automatically during transfer attempts.
    ///
    /// # Arguments
    /// * `token_id` - The token to potentially unlock
    ///
    /// # Behavior
    /// * Returns immediately if token is not locked (no error)
    /// * Checks the global lock state's expiration timestamp
    /// * Only unlocks if current time >= lock's unlock_at timestamp
    /// * Clears the token's lock data (sets to (0, 0))
    /// * Emits `TokenLockStateUpdated` event with Inactive state
    /// * Does nothing if lock hasn't expired yet
    ///
    /// # Access Control
    /// * Public function - anyone can call it
    /// * Safe to call repeatedly or on non-locked tokens
    /// * Automatically called by transfer hook during transfer attempts
    ///
    /// # Gas Optimization
    /// * Early return if token not locked (minimal gas)
    /// * Manual unlocking usually unnecessary due to automatic calls
    /// * Useful for batch unlock operations or cleanup
    ///
    /// # Example
    /// ```cairo
    /// // Anyone can unlock expired tokens
    /// lock.token_unlock(some_token_id);
    /// // This happens automatically during transfers too
    /// ```
    fn token_unlock(ref self: TState, token_id: u256);

    /// Returns the current lock information for a token.
    ///
    /// Provides access to the lock ID and transaction hash associated with a token's lock.
    /// If the token is not locked, returns (0, 0). Note that this shows lock assignment
    /// regardless of whether the lock has expired - use `token_is_locked()` for
    /// current lock status.
    ///
    /// # Arguments
    /// * `token_id` - The token to query
    ///
    /// # Returns
    /// Tuple containing:
    /// * `lock_id` - The global lock state ID, or 0 if not locked
    /// * `transaction_hash` - Hash of the transaction that applied this lock, or 0 if not locked
    ///
    /// # Usage
    /// * Checking which specific lock is applied to a token
    /// * Audit trails showing when tokens were locked
    /// * Integration with external systems tracking lock assignments
    ///
    /// # Example
    /// ```cairo
    /// let (lock_id, tx_hash) = lock.token_lock_state(token_id);
    /// if lock_id != 0 {
    ///     // Token has a lock assigned (may or may not be expired)
    /// }
    /// ```
    fn token_lock_state(self: @TState, token_id: u256) -> (felt252, felt252);

    /// Checks whether a token is currently locked and transfer-restricted.
    ///
    /// This is the authoritative check for whether a token can be transferred.
    /// Returns true only if the token has a lock assigned AND that lock hasn't expired.
    /// This is the function used by transfer hooks to block transfers.
    ///
    /// # Arguments
    /// * `token_id` - The token to check
    ///
    /// # Returns
    /// * `true` if token is locked and cannot be transferred
    /// * `false` if token is unlocked or lock has expired
    ///
    /// # Implementation Notes
    /// * Simple check: any non-zero lock_id means locked
    /// * Does not verify lock expiration - relies on unlock function being called
    /// * Transfer hook calls `token_unlock()` first, then checks this function
    ///
    /// # Example
    /// ```cairo
    /// if lock.token_is_locked(token_id) {
    ///     // Transfer will be blocked
    /// } else {
    ///     // Transfer is allowed
    /// }
    /// ```
    fn token_is_locked(self: @TState, token_id: u256) -> bool;
}

/// Administrative interface for managing global lock states.
///
/// Allows administrators with LOCKER_ROLE to define reusable lock states that
/// token owners can apply to their tokens. Lock states are identified by unique
/// IDs and have expiration timestamps.
#[starknet::interface]
trait IRealmsCollectibleLockAdmin<TState> {
    /// Creates or updates a global lock state that tokens can reference.
    ///
    /// Global lock states are reusable templates that define when locks expire.
    /// Multiple tokens can reference the same lock state. Once created, lock states
    /// can be updated to extend duration but not to expire earlier (for security).
    ///
    /// # Arguments
    /// * `lock_id` - Unique identifier for this lock state (choose meaningful names)
    /// * `unlock_at` - Unix timestamp when this lock type expires
    ///
    /// # Requirements
    /// * Caller must have `LOCKER_ROLE` permission
    /// * `lock_id` cannot be zero (reserved for "no lock" state)
    /// * `unlock_at` must be in the future (> current block timestamp)
    /// * Lock ID should be unique to avoid conflicts
    ///
    /// # Behavior
    /// * Creates new lock state or updates existing one
    /// * Can extend existing lock duration but not shorten it
    /// * Affects all tokens currently using this lock state
    /// * Emits `LockStateUpdated` event with timestamp
    /// * Lock state persists until manually removed or contract upgraded
    ///
    /// # Security Considerations
    /// * LOCKER_ROLE can modify active locks, affecting user tokens
    /// * Should be controlled by governance or trusted multi-sig
    /// * Can extend tournament durations or emergency lock periods
    /// * Users should understand that lock durations may change
    ///
    /// # Use Cases
    /// * Tournament locks: "Set tournament end time"
    /// * Staking pools: "Define staking period duration"
    /// * Governance votes: "Lock tokens during voting period"
    /// * Emergency locks: "Temporarily restrict transfers"
    ///
    /// # Example
    /// ```cairo
    /// // Create 30-day tournament lock
    /// let tournament_end = current_time() + (30 * 24 * 60 * 60);
    /// admin.lock_state_update('world_championship_2024', tournament_end);
    ///
    /// // Create 90-day staking lock
    /// let staking_end = current_time() + (90 * 24 * 60 * 60);
    /// admin.lock_state_update('q1_staking_rewards', staking_end);
    /// ```
    fn lock_state_update(ref self: TState, lock_id: felt252, unlock_at: u64);
}

// Role constants for access control
const METADATA_UPDATER_ROLE: felt252 = selector!("METADATA_UPDATER_ROLE");
const MINTER_ROLE: felt252 = selector!("MINTER_ROLE");
const UPGRADER_ROLE: felt252 = selector!("UPGRADER_ROLE");
const LOCKER_ROLE: felt252 = selector!("LOCKER_ROLE");

/// Main contract implementation with all components integrated
#[starknet::contract]
mod RealmsCollectible {
    use collectibles::utils::{make_json_and_base64_encode_metadata, unpack_u128_to_bytes_full};
    use core::num::traits::Zero;
    use openzeppelin::access::accesscontrol::AccessControlComponent;
    use openzeppelin::access::accesscontrol::DEFAULT_ADMIN_ROLE;
    use openzeppelin::access::ownable::OwnableComponent;
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::token::common::erc2981::{DefaultConfig, ERC2981Component};
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin::token::erc721::ERC721Component;
    use openzeppelin::token::erc721::extensions::ERC721EnumerableComponent;
    use openzeppelin::token::erc721::interface::{
        IERC721Dispatcher, IERC721DispatcherTrait, IERC721Metadata, IERC721MetadataCamelOnly, IERC721MetadataDispatcher,
        IERC721MetadataDispatcherTrait,
    };
    use openzeppelin::upgrades::UpgradeableComponent;
    use openzeppelin::upgrades::interface::IUpgradeable;

    use starknet::ClassHash;
    use starknet::ContractAddress;
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use super::LockState;
    use super::{ERC721EnumerableTransferAmountTrait};
    use super::{IRealmsCollectibleLock, IRealmsCollectibleLockDispatcher, IRealmsCollectibleLockDispatcherTrait};
    use super::{
        IRealmsCollectibleLockAdmin, IRealmsCollectibleLockAdminDispatcher, IRealmsCollectibleLockAdminDispatcherTrait,
    };
    use super::{
        IRealmsCollectibleMetadata, IRealmsCollectibleMetadataDispatcher, IRealmsCollectibleMetadataDispatcherTrait,
    };
    use super::{LOCKER_ROLE, METADATA_UPDATER_ROLE, MINTER_ROLE, UPGRADER_ROLE};

    component!(path: ERC721Component, storage: erc721, event: ERC721Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: accesscontrol, event: AccessControlEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);
    component!(path: ERC2981Component, storage: erc2981, event: ERC2981Event);
    component!(path: ERC721EnumerableComponent, storage: erc721_enumerable, event: ERC721EnumerableEvent);

    #[abi(embed_v0)]
    impl ERC721Impl = ERC721Component::ERC721Impl<ContractState>;
    #[abi(embed_v0)]
    impl AccessControlMixinImpl = AccessControlComponent::AccessControlMixinImpl<ContractState>;
    #[abi(embed_v0)]
    impl ERC2981Impl = ERC2981Component::ERC2981Impl<ContractState>;
    #[abi(embed_v0)]
    impl ERC2981InfoImpl = ERC2981Component::ERC2981InfoImpl<ContractState>;
    #[abi(embed_v0)]
    impl ERC2981AdminAccessControlImpl = ERC2981Component::ERC2981AdminAccessControlImpl<ContractState>;
    #[abi(embed_v0)]
    impl ERC721EnumerableImpl = ERC721EnumerableComponent::ERC721EnumerableImpl<ContractState>;

    impl ERC721InternalImpl = ERC721Component::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;
    impl ERC2981InternalImpl = ERC2981Component::InternalImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;
    impl ERC721EnumerableInternalImpl = ERC721EnumerableComponent::InternalImpl<ContractState>;

    /// Event emitted when a trait type name is updated
    #[derive(Drop, starknet::Event)]
    pub struct TraitTypeUpdated {
        #[key]
        pub trait_type_id: u8,
        pub trait_type_name: ByteArray,
        pub timestamp: u64,
    }

    /// Event emitted when a trait value name is updated
    #[derive(Drop, starknet::Event)]
    pub struct TraitValueUpdated {
        #[key]
        pub trait_type_id: u8,
        #[key]
        pub trait_value_id: u8,
        pub trait_value_name: ByteArray,
        pub timestamp: u64,
    }

    /// Event emitted when a token's lock state changes
    #[derive(Drop, starknet::Event)]
    pub struct TokenLockStateUpdated {
        #[key]
        pub token_id: u256,
        #[key]
        pub lock_id: felt252,
        pub lock_state: LockState,
        pub timestamp: u64,
    }

    /// Event emitted when a global lock state is updated
    #[derive(Drop, starknet::Event)]
    pub struct LockStateUpdated {
        #[key]
        pub lock_id: felt252,
        pub unlock_at: u64,
        pub timestamp: u64,
    }

    /// Event emitted when the default IPFS CID is updated
    #[derive(Drop, starknet::Event)]
    pub struct DefaultIPFSCIDUpdated {
        #[key]
        pub ipfs_cid: ByteArray,
        pub timestamp: u64,
    }

    /// Event emitted when an attribute-specific IPFS CID mapping is updated
    #[derive(Drop, starknet::Event)]
    pub struct AttrsRawToIPFSCIDUpdated {
        #[key]
        pub attrs_raw: u128,
        #[key]
        pub ipfs_cid: ByteArray,
        pub timestamp: u64,
    }

    /// Contract storage structure containing all state variables
    #[storage]
    struct Storage {
        /// Auto-incrementing counter for token IDs
        counter: u128,
        /// Collection description used in metadata
        description: ByteArray,
        /// Maps token ID to packed attributes (u128)
        token_id_to_attrs_raw: Map<u256, u128>,
        /// Default IPFS CID for tokens without specific mappings
        default_ipfs_cid: ByteArray,
        /// Maps packed attributes to specific IPFS CIDs
        attrs_raw_to_ipfs_cid: Map<u128, ByteArray>,
        /// Maps trait type ID (0-15) to human-readable names
        trait_type_to_name: Map<u8, ByteArray>,
        /// Maps (trait_type_id, trait_value_id) to human-readable names
        trait_value_to_name: Map<(u8, u8), ByteArray>,
        /// Maps token_id to (lock_id, lock_tx_hash)
        token_lock: Map<u256, (felt252, felt252)>,
        /// Maps lock_id to unlock_at timestamp
        lock_state: Map<felt252, u64>,
        #[substorage(v0)]
        erc721: ERC721Component::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        #[substorage(v0)]
        erc721_enumerable: ERC721EnumerableComponent::Storage,
        #[substorage(v0)]
        accesscontrol: AccessControlComponent::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
        #[substorage(v0)]
        erc2981: ERC2981Component::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC721Event: ERC721Component::Event,
        #[flat]
        ERC721EnumerableEvent: ERC721EnumerableComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        #[flat]
        AccessControlEvent: AccessControlComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        #[flat]
        ERC2981Event: ERC2981Component::Event,
        TraitTypeUpdated: TraitTypeUpdated,
        TraitValueUpdated: TraitValueUpdated,
        TokenLockStateUpdated: TokenLockStateUpdated,
        LockStateUpdated: LockStateUpdated,
        DefaultIPFSCIDUpdated: DefaultIPFSCIDUpdated,
        AttrsRawToIPFSCIDUpdated: AttrsRawToIPFSCIDUpdated,
    }

    /// Initializes the contract with all necessary parameters and role assignments
    ///
    /// # Arguments
    /// * `erc721_name` - The name of the NFT collection
    /// * `erc721_symbol` - The symbol of the NFT collection
    /// * `erc721_base_uri` - Base URI for token metadata (unused as we generate on-chain)
    /// * `description` - Description used in token metadata
    /// * `default_admin` - Address with admin privileges for role management
    /// * `minter` - Address with minting privileges
    /// * `upgrader` - Address with contract upgrade privileges
    /// * `locker` - Address with lock state management privileges
    /// * `metadata_updater` - Address with metadata update privileges
    /// * `default_royalty_receiver` - Address to receive royalty payments
    /// * `fee_numerator` - Royalty percentage (in basis points, e.g., 250 = 2.5%)
    #[constructor]
    fn constructor(
        ref self: ContractState,
        erc721_name: ByteArray,
        erc721_symbol: ByteArray,
        erc721_base_uri: ByteArray,
        description: ByteArray,
        default_admin: ContractAddress,
        minter: ContractAddress,
        upgrader: ContractAddress,
        locker: ContractAddress,
        metadata_updater: ContractAddress,
        default_royalty_receiver: ContractAddress,
        fee_numerator: u128,
    ) {
        self.erc721.initializer(erc721_name, erc721_symbol, erc721_base_uri);
        self.erc721_enumerable.initializer();
        self.erc2981.initializer(default_royalty_receiver, fee_numerator);

        self.accesscontrol.initializer();
        self.accesscontrol._grant_role(DEFAULT_ADMIN_ROLE, default_admin);
        self.accesscontrol._grant_role(UPGRADER_ROLE, upgrader);
        self.accesscontrol._grant_role(MINTER_ROLE, minter);
        self.accesscontrol._grant_role(LOCKER_ROLE, locker);
        self.accesscontrol._grant_role(METADATA_UPDATER_ROLE, metadata_updater);

        self.description.write(description);
    }

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        /// Upgrades the contract to a new implementation
        ///
        /// # Arguments
        /// * `new_class_hash` - Hash of the new contract implementation
        ///
        /// # Requirements
        /// * Caller must have `UPGRADER_ROLE`
        /// * New implementation must be compatible with current storage layout
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.accesscontrol.assert_only_role(UPGRADER_ROLE);
            self.upgradeable.upgrade(new_class_hash);
        }
    }

    /// ERC721 metadata implementation with dynamic on-chain generation
    #[abi(embed_v0)]
    impl ERC721Metadata of IERC721Metadata<ContractState> {
        /// Returns the NFT collection name
        fn name(self: @ContractState) -> ByteArray {
            self.erc721.ERC721_name.read()
        }

        /// Returns the NFT collection symbol
        fn symbol(self: @ContractState) -> ByteArray {
            self.erc721.ERC721_symbol.read()
        }

        /// Returns the complete metadata URI for a token
        /// Generates OpenSea-compatible JSON metadata entirely on-chain
        ///
        /// # Arguments
        /// * `token_id` - The token ID to get metadata for
        ///
        /// # Returns
        /// Base64-encoded data URI with complete JSON metadata
        ///
        /// # Requirements
        /// * Token must exist
        fn token_uri(self: @ContractState, token_id: u256) -> ByteArray {
            self.erc721._require_owned(token_id);
            RealmsCollectibleMetadataImpl::get_metadata_json(self, token_id)
        }
    }

    /// ERC721 transfer hooks to enforce token locking
    impl ERC721HooksImpl of ERC721Component::ERC721HooksTrait<ContractState> {
        /// Hook called before any token transfer, mint, or burn
        /// Enforces token locking by preventing transfers of locked tokens
        ///
        /// # Arguments
        /// * `to` - Destination address (zero for burns)
        /// * `token_id` - Token being transferred
        /// * `auth` - Address authorized to perform the transfer
        fn before_update(
            ref self: ERC721Component::ComponentState<ContractState>,
            to: ContractAddress,
            token_id: u256,
            auth: ContractAddress,
        ) {
            let mut contract_state = self.get_contract_mut();
            // Attempt to unlock token if lock has expired
            contract_state.token_unlock(token_id);
            // Ensure locked tokens can't be transferred or burned
            assert!(!contract_state.token_is_locked(token_id), "RealmsCollectible: Token is locked");
            contract_state.erc721_enumerable.before_update(to, token_id);
        }
    }

    #[abi(embed_v0)]
    impl ERC721EnumerableTransferAmountImpl of ERC721EnumerableTransferAmountTrait<ContractState> {
        fn transfer_amount(
            ref self: ContractState, from: ContractAddress, to: ContractAddress, amount: u16,
        ) -> Span<u256> {
            let mut token_ids = array![];
            for _ in 0..amount {
                let token_id = self.erc721_enumerable.token_of_owner_by_index(from, 0);
                self.erc721.transfer_from(from, to, token_id);
                token_ids.append(token_id);
            };
            token_ids.span()
        }
    }

    #[abi(embed_v0)]
    impl ERC721MetadataCamelOnly of IERC721MetadataCamelOnly<ContractState> {
        fn tokenURI(self: @ContractState, tokenId: u256) -> ByteArray {
            ERC721Metadata::token_uri(self, tokenId)
        }
    }

    #[abi(embed_v0)]
    impl ERC721MintBurnImpl of super::ERC721MintBurnTrait<ContractState> {
        fn burn(ref self: ContractState, token_id: u256) {
            self.erc721.update(Zero::zero(), token_id, starknet::get_caller_address());
        }

        fn mint(ref self: ContractState, recipient: ContractAddress, attributes_raw: u128) {
            self.accesscontrol.assert_only_role(MINTER_ROLE);

            // increment counter
            let token_id = self.counter.read() + 1;
            self.counter.write(token_id);

            // set attributes raw
            assert!(attributes_raw != 0, "RealmsCollectible: Attributes raw must be non-zero");

            // ensure ipfs image is already set for those attributes
            let ipfs_cid = self.attrs_raw_to_ipfs_cid.entry(attributes_raw).read();
            assert!(ipfs_cid != "", "RealmsCollectible: IPFS CID not set for those attributes");

            self.token_id_to_attrs_raw.entry(token_id.into()).write(attributes_raw);

            // mint token
            self.erc721.mint(recipient, token_id.into());
        }

        fn mint_many(
            ref self: ContractState, recipient: ContractAddress, mut attributes_and_counts: Span<(u128, u16)>,
        ) {
            while attributes_and_counts.len() > 0 {
                let (attributes_raw, count) = attributes_and_counts.pop_front().unwrap();
                let (attributes_raw, count) = (*attributes_raw, *count);
                for _ in 0..count {
                    self.mint(recipient, attributes_raw);
                }
            }
        }

        fn safe_mint(ref self: ContractState, recipient: ContractAddress, attributes_raw: u128) {
            self.accesscontrol.assert_only_role(MINTER_ROLE);

            // increment counter
            let token_id = self.counter.read() + 1;
            self.counter.write(token_id);

            // set attributes raw
            assert!(attributes_raw != 0, "RealmsCollectible: Attributes raw must be non-zero");

            // ensure ipfs image is already set for those attributes
            let ipfs_cid = self.attrs_raw_to_ipfs_cid.entry(attributes_raw).read();
            assert!(ipfs_cid != "", "RealmsCollectible: IPFS CID not set for those attributes");

            self.token_id_to_attrs_raw.entry(token_id.into()).write(attributes_raw);

            // mint token
            self.erc721.safe_mint(recipient, token_id.into(), array![].span());
        }

        fn safe_mint_many(
            ref self: ContractState, recipient: ContractAddress, mut attributes_and_counts: Span<(u128, u16)>,
        ) {
            while attributes_and_counts.len() > 0 {
                let (attributes_raw, count) = attributes_and_counts.pop_front().unwrap();
                let (attributes_raw, count) = (*attributes_raw, *count);
                for _ in 0..count {
                    self.safe_mint(recipient, attributes_raw);
                }
            }
        }
    }

    #[abi(embed_v0)]
    impl RealmsCollectibleMetadataImpl of IRealmsCollectibleMetadata<ContractState> {
        fn set_default_ipfs_cid(ref self: ContractState, ipfs_cid: ByteArray, overwrite: bool) {
            self.accesscontrol.assert_only_role(METADATA_UPDATER_ROLE);

            let current_ipfs_cid = self.default_ipfs_cid.read();
            if current_ipfs_cid != "" {
                if current_ipfs_cid == ipfs_cid {
                    return;
                } else {
                    assert!(overwrite, "RealmsCollectible: Default IPFS CID already exists");
                }
            }
            self.default_ipfs_cid.write(format!("{}", ipfs_cid));
            self.emit(DefaultIPFSCIDUpdated { ipfs_cid, timestamp: starknet::get_block_timestamp() });
        }

        fn set_attrs_raw_to_ipfs_cid(ref self: ContractState, attrs_raw: u128, ipfs_cid: ByteArray, overwrite: bool) {
            self.accesscontrol.assert_only_role(METADATA_UPDATER_ROLE);

            let current_ipfs_cid = self.attrs_raw_to_ipfs_cid.entry(attrs_raw).read();
            if current_ipfs_cid != "" {
                if current_ipfs_cid == ipfs_cid {
                    return;
                } else {
                    assert!(overwrite, "RealmsCollectible: Attrs raw to IPFS CID already exists");
                }
            }
            self.attrs_raw_to_ipfs_cid.entry(attrs_raw).write(format!("{}", ipfs_cid));
            self.emit(AttrsRawToIPFSCIDUpdated { attrs_raw, ipfs_cid, timestamp: starknet::get_block_timestamp() });
        }

        fn set_trait_type_name(ref self: ContractState, trait_type_id: u8, name: ByteArray, overwrite: bool) {
            self.accesscontrol.assert_only_role(METADATA_UPDATER_ROLE);
            assert!(trait_type_id < 16, "RealmsCollectible: Trait type id must be a value between 0 and 15");

            let current_name = self.trait_type_to_name.entry(trait_type_id).read();
            if current_name != "" {
                if current_name == name {
                    return;
                } else {
                    assert!(overwrite, "RealmsCollectible: Trait type name already exists");
                }
            }
            self.trait_type_to_name.entry(trait_type_id).write(format!("{}", name));
            self
                .emit(
                    TraitTypeUpdated {
                        trait_type_id, trait_type_name: name, timestamp: starknet::get_block_timestamp(),
                    },
                );
        }

        fn set_trait_value_name(
            ref self: ContractState, trait_type_id: u8, trait_value_id: u8, name: ByteArray, overwrite: bool,
        ) {
            self.accesscontrol.assert_only_role(METADATA_UPDATER_ROLE);
            assert!(trait_type_id < 16, "RealmsCollectible: Trait type id must be a value between 0 and 15");
            assert!(trait_value_id > 0, "RealmsCollectible: Trait value id must be a value between 1 and 255");

            let current_name = self.trait_value_to_name.entry((trait_type_id, trait_value_id)).read();
            if current_name != "" {
                if current_name == name {
                    return;
                } else {
                    assert!(overwrite, "RealmsCollectible: Trait value name already exists");
                }
            }

            self.trait_value_to_name.entry((trait_type_id, trait_value_id)).write(format!("{}", name));
            self
                .emit(
                    TraitValueUpdated {
                        trait_type_id,
                        trait_value_id,
                        trait_value_name: name,
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }

        fn get_trait_type_name(self: @ContractState, trait_type_id: u8) -> ByteArray {
            assert!(trait_type_id < 16, "RealmsCollectible: Trait type id must be a value between 0 and 15");
            self.trait_type_to_name.entry(trait_type_id).read()
        }

        fn get_trait_value_name(self: @ContractState, trait_type_id: u8, trait_value_id: u8) -> ByteArray {
            assert!(trait_type_id < 16, "RealmsCollectible: Trait type id must be a value between 0 and 15");
            assert!(trait_value_id > 0, "RealmsCollectible: Trait value id must be a value between 1 and 255");
            self.trait_value_to_name.entry((trait_type_id, trait_value_id)).read()
        }

        fn get_metadata_raw(self: @ContractState, token_id: u256) -> u128 {
            self.token_id_to_attrs_raw.entry(token_id).read()
        }

        fn get_metadata_json(self: @ContractState, token_id: u256) -> ByteArray {
            let attrs_raw: u128 = self.token_id_to_attrs_raw.entry(token_id).read();
            let mut ipfs_cid: ByteArray = self.attrs_raw_to_ipfs_cid.entry(attrs_raw).read();
            if ipfs_cid == "" {
                ipfs_cid = self.default_ipfs_cid.read();
            }
            let mut attrs_arr: Array<u8> = unpack_u128_to_bytes_full(attrs_raw);
            let mut attrs_data: Array<(ByteArray, ByteArray)> = array![];
            for i in 0..attrs_arr.len() {
                let trait_value: u8 = attrs_arr.pop_front().unwrap();
                if trait_value > 0 {
                    let trait_type_name: ByteArray = self.trait_type_to_name.entry(i.try_into().unwrap()).read();
                    let trait_value_name: ByteArray = self
                        .trait_value_to_name
                        .entry((i.try_into().unwrap(), trait_value))
                        .read();
                    // Only add trait if both type and value names are defined
                    if trait_type_name != "" && trait_value_name != "" {
                        attrs_data.append((trait_type_name, trait_value_name));
                    }
                }
            };

            let name = self.erc721.ERC721_name.read();
            let description = self.description.read();

            make_json_and_base64_encode_metadata(name, description, token_id, attrs_data, ipfs_cid)
        }
    }

    #[abi(embed_v0)]
    impl RealmsCollectibleLockImpl of IRealmsCollectibleLock<ContractState> {
        fn token_lock(ref self: ContractState, token_id: u256, lock_id: felt252) {
            self.erc721._require_owned(token_id);
            let caller = starknet::get_caller_address();
            let owner = self.erc721._owner_of(token_id);
            assert!(caller == owner, "RealmsCollectible: Caller is not owner");

            let unlock_at = self.lock_state.entry(lock_id).read();
            assert!(unlock_at > starknet::get_block_timestamp(), "RealmsCollectible: Lock is not active");

            self.token_lock.entry(token_id).write((lock_id, starknet::get_tx_info().transaction_hash));

            self
                .emit(
                    TokenLockStateUpdated {
                        token_id, lock_id, lock_state: LockState::Active, timestamp: starknet::get_block_timestamp(),
                    },
                );
        }

        fn token_unlock(ref self: ContractState, token_id: u256) {
            let (lock_id, _) = self.token_lock.entry(token_id).read();
            if lock_id == 0 {
                return;
            }

            let unlock_at = self.lock_state.entry(lock_id).read();
            let now = starknet::get_block_timestamp();
            if now >= unlock_at {
                self.token_lock.entry(token_id).write((0, 0));
                self
                    .emit(
                        TokenLockStateUpdated {
                            token_id,
                            lock_id,
                            lock_state: LockState::Inactive,
                            timestamp: starknet::get_block_timestamp(),
                        },
                    );
            }
        }

        fn token_lock_state(self: @ContractState, token_id: u256) -> (felt252, felt252) {
            self.token_lock.entry(token_id).read()
        }

        fn token_is_locked(self: @ContractState, token_id: u256) -> bool {
            let (lock_id, _) = self.token_lock.entry(token_id).read();
            lock_id != 0
        }
    }

    #[abi(embed_v0)]
    impl RealmsCollectibleLockAdminImpl of IRealmsCollectibleLockAdmin<ContractState> {
        fn lock_state_update(ref self: ContractState, lock_id: felt252, unlock_at: u64) {
            self.accesscontrol.assert_only_role(LOCKER_ROLE);
            assert!(unlock_at > starknet::get_block_timestamp(), "RealmsCollectible: Unlock at must be in the future");
            assert!(lock_id != 0, "RealmsCollectible: Lock id is zero");

            self.lock_state.entry(lock_id).write(unlock_at);
            self.emit(LockStateUpdated { lock_id, unlock_at, timestamp: starknet::get_block_timestamp() });
        }
    }
}
