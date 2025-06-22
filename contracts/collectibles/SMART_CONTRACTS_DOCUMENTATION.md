# Realms Collectibles Smart Contract - Comprehensive Technical Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture Deep Dive](#architecture-deep-dive)
3. [Attribute System Technical Details](#attribute-system-technical-details)
4. [Token Locking System](#token-locking-system)
5. [Access Control & Security](#access-control--security)
6. [Metadata Generation Engine](#metadata-generation-engine)
7. [API Reference](#api-reference)
8. [Integration Patterns](#integration-patterns)
9. [Security Considerations](#security-considerations)
10. [Testing & Deployment](#testing--deployment)

---

## Overview

The **Realms Collectibles** system is a sophisticated ERC721 NFT contract built on Starknet that implements advanced
on-chain metadata management with extreme gas efficiency. This contract is designed for high-throughput gaming
applications, collectible trading platforms, and any use case requiring complex trait systems with dynamic locking
mechanisms.

### Core Innovation Points

**1. Packed Attribute System**: Stores 16 different trait types in a single `u128` value, reducing storage costs by ~95%
compared to traditional mapping-based approaches.

**2. Time-Based Token Locking**: Implements a two-tier locking system allowing both administrative control and user
autonomy over token transferability.

**3. Dynamic Metadata Generation**: Generates OpenSea-compatible JSON metadata entirely on-chain, eliminating dependency
on external metadata servers.

**4. Role-Based Access Control**: Implements granular permissions allowing different actors to perform specific
operations without compromising security.

**5. Gas-Efficient Design**: Every operation is optimized for minimal gas consumption while maintaining full
functionality.

### Key Benefits

- **Storage Efficiency**: 16 traits stored in 16 bytes (u128) instead of 16 separate storage slots
- **On-Chain Metadata**: No dependency on external APIs or IPFS for basic metadata
- **Flexible Locking**: Supports complex gaming mechanics like staking, tournaments, and season locks
- **Upgradeability**: Safe upgrade patterns with role-based access control
- **Enumerable**: Full ERC721Enumerable support for efficient token discovery
- **Royalty Support**: Built-in ERC2981 royalty standard compliance

---

## Architecture Deep Dive

### System Components Interaction

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RealmsCollectible Contract                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   ERC721 Core   │  │ Metadata Engine │  │ Locking System  │             │
│  │                 │  │                 │  │                 │             │
│  │ • Mint/Burn     │  │ • Trait Types   │  │ • Owner Control │             │
│  │ • Transfer      │  │ • Trait Values  │  │ • Time-Based    │             │
│  │ • Approval      │  │ • IPFS Mapping  │  │ • Admin Locks   │             │
│  │ • Enumerable    │  │ • JSON Gen      │  │ • Transfer Hook │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│           │                     │                     │                     │
│           └─────────────────────┼─────────────────────┘                     │
│                                 │                                           │
│  ┌─────────────────┐  ┌─────────┴─────────┐  ┌─────────────────┐             │
│  │ Access Control  │  │ Storage Optimizer │  │   Upgradeability │             │
│  │                 │  │                 │  │                 │             │
│  │ • Role Manager  │  │ • Packed Attrs  │  │ • Safe Upgrades │             │
│  │ • Permissions   │  │ • Bit Packing   │  │ • Version Ctrl  │             │
│  │ • Multi-Admin   │  │ • Gas Savings   │  │ • Migration     │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                          External Interfaces                                │
│                                                                             │
│  ERC721 │ ERC721Enumerable │ ERC2981 │ AccessControl │ Upgradeable         │
│  ERC721Metadata │ Custom Mint/Burn │ Custom Locking │ Custom Metadata      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### 1. ERC721 Foundation Layer

- **Standard Compliance**: Full ERC721 implementation with OpenZeppelin components
- **Enumerable Extension**: Efficient token enumeration and batch operations
- **Hook Integration**: Custom transfer hooks for lock enforcement
- **Metadata Interface**: Dynamic token URI generation

#### 2. Attribute System Layer

- **Bit Manipulation**: Efficient packing/unpacking of 16 trait types
- **Type Safety**: Validation of trait type and value ranges
- **Name Resolution**: Human-readable trait and value names
- **JSON Generation**: Real-time metadata compilation

#### 3. Locking Mechanism Layer

- **State Management**: Global lock definitions and token-specific assignments
- **Access Control**: Owner-only lock/unlock operations
- **Time Validation**: Automatic expiration handling
- **Transfer Prevention**: Hook-based transfer blocking

#### 4. Access Control Layer

- **Role-Based Permissions**: Fine-grained operation control
- **Multi-Role Support**: Users can have multiple roles
- **Admin Hierarchy**: Secure role grant/revoke mechanisms
- **Emergency Controls**: Administrative override capabilities

---

## Attribute System Technical Details

### Bit Packing Architecture

The attribute system uses a single `u128` (128-bit) value to store 16 different trait types, where each trait occupies
exactly 8 bits (1 byte). This allows for 256 possible values per trait type (0-255), where 0 represents "no trait
present". so it is really 1 - 255 for each trait type.

#### Memory Layout Visualization

```
u128 Value: 0x0F|0E|0D|0C|0B|0A|09|08|07|06|05|04|03|02|01|01
Byte Pos:     15,14,13,12,11,10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0
Trait Type:   15,14,13,12,11,10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0

Each trait type can then store a value from 1 - 255.

Example Breakdown:
- Trait Type 0 (Position 0): can be named = "Rarity", then it can have a value of 1 - 255
- Trait Type 1 (Position 1): can be named = "Element", then it can have a value of 1 - 255
- Trait Type 2 (Position 2): can be named = "Power", then it can have a value of 1 - 255
- Trait Type 3 (Position 3): can be named  = "Region", then it can have a value of 1 - 255
- Trait Types 4-14: can be named = "Special", then it can have a value of 1 - 255
- Trait Type 15 (Position 15) can be named = "Special", then it can have a value of 1 - 255
```

#### Unpacking Algorithm

The contract uses an unpacking function that converts the packed `u128` into an array of 16 individual `u8` values:

```cairo
// Conceptual unpacking process:
fn unpack_u128_to_bytes_full(packed: u128) -> Array<u8> {
    let mut result = array![];
    let mut remaining = packed;

    // Extract each byte from least significant to most significant
    for i in 0..16 {
        let byte_value = (remaining & 0xFF) as u8;  // Get lowest 8 bits
        result.append(byte_value);
        remaining = remaining >> 8;  // Shift right by 8 bits
    }

    result
}
```

#### Trait Type and Value System

**Trait Types (0-15)**: Define categories of attributes

- Type 0: Rarity (Common, Rare, Legendary, etc.)
- Type 1: Element (Fire, Water, Earth, Air, etc.)
- Type 2: Power Level (Weak, Strong, Mighty, etc.)
- Type 3: Region (Northern, Southern, Eastern, etc.)
- Types 4-15: Application-specific categories

**Trait Values (1-255)**: Define specific values within each type

- Value 0: Reserved for "no trait present"
- Values 1-255: Actual trait values e.g. 1 = "Common", 2 = "Rare", 3 = "Legendary", etc. all for type 0 (Rarity)
- Each trait type can have up to 255 different values

#### Storage Efficiency Analysis

**Traditional Approach**:

```cairo
// 16 separate storage slots
trait_0: Map<u256, u8>,  // 16 bytes per token
trait_1: Map<u256, u8>,  // 16 bytes per token
// ... 14 more mappings
// Total: 16 bytes per token for traits
```

**Packed Approach**:

```cairo
// Single storage slot
token_id_to_attrs_raw: Map<u256, u128>,  // 16 bytes per token
// Total: 16 bytes per token for traits
// Savings: 16 bytes (93.75% reduction)
```

### Metadata Resolution Process

The metadata generation follows a sophisticated pipeline:

1. **Attribute Retrieval**: Get packed `u128` from storage
2. **Bit Unpacking**: Convert to 16-element `u8` array
3. **Trait Resolution**: For each non-zero value:
   - Get trait type name from `trait_type_to_name` mapping
   - Get trait value name from `trait_value_to_name` mapping
   - Build `(trait_type, trait_value)` pairs
4. **IPFS Resolution**: Check for attribute-specific image, fallback to default
5. **JSON Compilation**: Build OpenSea-compatible metadata structure
6. **Base64 Encoding**: Convert to data URI format

#### Step 4: JSON Compilation and Encoding

```cairo
// 5. Generate final JSON and encode
make_json_and_base64_encode_metadata(attrs_data, ipfs_cid)
```

The final step uses a utility function that:

1. **Builds JSON Structure**: Creates properly formatted JSON with image and attributes
2. **Handles Special Characters**: Escapes quotes, newlines, and other JSON special characters
3. **Base64 Encoding**: Converts to data URI format: `data:application/json;base64,...`
4. **Returns Data URI**: Compatible with OpenSea and other NFT platforms

### IPFS Image Management

#### Two-Tier Image System

**Tier 1: Attribute-Specific Images**

```cairo
// Set specific image for exact attribute combination
metadata.set_attrs_raw_to_ipfs_cid(
    0x00000000000000000000000000000005,  // Legendary rarity only
    "QmLegendarySpecialArtworkCID",
    false
);
```

**Tier 2: Default Fallback**

```cairo
// Set default image for all other combinations
metadata.set_default_ipfs_cid("QmDefaultCollectionArtworkCID", false);
```

#### Advanced Image Mapping Strategies

**Strategy 1: Rarity-Based Images**

```cairo
// Different images for different rarity levels
metadata.set_attrs_raw_to_ipfs_cid(0x01, "QmCommonCID", false);     // Common
metadata.set_attrs_raw_to_ipfs_cid(0x02, "QmUncommonCID", false);   // Uncommon
metadata.set_attrs_raw_to_ipfs_cid(0x03, "QmRareCID", false);       // Rare
metadata.set_attrs_raw_to_ipfs_cid(0x04, "QmEpicCID", false);       // Epic
metadata.set_attrs_raw_to_ipfs_cid(0x05, "QmLegendaryCID", false);  // Legendary
```

**Strategy 2: Element-Based Images**

```cairo
// Different images for different elements (trait_type_1)
metadata.set_attrs_raw_to_ipfs_cid(0x0100, "QmFireCID", false);     // Fire element
metadata.set_attrs_raw_to_ipfs_cid(0x0200, "QmWaterCID", false);    // Water element
metadata.set_attrs_raw_to_ipfs_cid(0x0300, "QmEarthCID", false);    // Earth element
metadata.set_attrs_raw_to_ipfs_cid(0x0400, "QmAirCID", false);      // Air element
```

**Strategy 3: Combination-Based Images**

```cairo
// Specific images for special combinations
metadata.set_attrs_raw_to_ipfs_cid(
    0x00000000000000000000000003020105,  // Legendary Fire Mighty
    "QmLegendaryFireMightyCID",
    false
);
```

### Trait System Management

#### Setting Up Trait Types

```cairo
// Define the category of traits (what the trait represents)
metadata.set_trait_type_name(0, "Rarity", false);      // Position 0 = Rarity
metadata.set_trait_type_name(1, "Element", false);     // Position 1 = Element
metadata.set_trait_type_name(2, "Power Level", false); // Position 2 = Power
metadata.set_trait_type_name(3, "Region", false);      // Position 3 = Geographic region
metadata.set_trait_type_name(4, "Class", false);       // Position 4 = Character class
metadata.set_trait_type_name(5, "Weapon", false);      // Position 5 = Equipped weapon
```

#### Setting Up Trait Values

```cairo
// Define specific values within each trait type
// Rarity values (trait_type_id = 0)
metadata.set_trait_value_name(0, 1, "Common", false);
metadata.set_trait_value_name(0, 2, "Uncommon", false);
metadata.set_trait_value_name(0, 3, "Rare", false);
metadata.set_trait_value_name(0, 4, "Epic", false);
metadata.set_trait_value_name(0, 5, "Legendary", false);
metadata.set_trait_value_name(0, 6, "Mythic", false);

// Element values (trait_type_id = 1)
metadata.set_trait_value_name(1, 1, "Fire", false);
metadata.set_trait_value_name(1, 2, "Water", false);
metadata.set_trait_value_name(1, 3, "Earth", false);
metadata.set_trait_value_name(1, 4, "Air", false);
metadata.set_trait_value_name(1, 5, "Light", false);
metadata.set_trait_value_name(1, 6, "Shadow", false);
```

#### Trait System Validation

```cairo
// Validation rules enforced by contract
assert!(trait_type_id < 16, "Trait type must be 0-15");
assert!(trait_value_id > 0 && trait_value_id <= 255, "Trait value must be 1-255");

// Overwrite protection (when overwrite = false)
assert!(
    existing_name == "",
    "Trait name already exists - use overwrite=true to modify"
);
```

---

## 🔒 Token Locking System

### Two-Tier Lock Architecture

The locking system implements a sophisticated two-tier approach that separates **lock definitions** from **token
assignments**, providing both administrative control and user autonomy.

#### Tier 1: Global Lock States (Administrative)

Global lock states are reusable templates managed by users with `LOCKER_ROLE`:

```cairo
// Storage structure
lock_state: Map<felt252, u64>  // lock_id → unlock_timestamp

// Example lock states
lock_state['season_1_tournament'] = 1735689600;  // Jan 1, 2025
lock_state['staking_pool_alpha'] = 1767225600;   // Jan 1, 2026
lock_state['governance_vote_1'] = 1703980800;    // Dec 31, 2023
```

**Key Properties**:

- **Reusable**: One lock state can be applied to multiple tokens
- **Centrally Managed**: Only `LOCKER_ROLE` can create/modify
- **Time-Based**: All locks have specific expiration timestamps
- **Immutable Once Set**: Lock timestamps cannot be moved backward

#### Tier 2: Token-Specific Assignments (User-Controlled)

Individual token locks are controlled exclusively by token owners:

```cairo
// Storage structure
token_lock: Map<u256, (felt252, felt252)>  // token_id → (lock_id, tx_hash)

// Example token assignments
token_lock[1001] = ('season_1_tournament', 0x123...abc);  // Token 1001 locked for tournament
token_lock[1002] = ('staking_pool_alpha', 0x456...def);   // Token 1002 staked
token_lock[1003] = (0, 0);                                // Token 1003 unlocked
```

**Key Properties**:

- **Owner-Only Control**: Only token owner can lock/unlock their tokens
- **Selective Application**: Owners choose which locks to apply
- **Transaction Tracking**: Each lock records the transaction hash
- **Independent Expiration**: Each token unlocks based on its assigned lock's timestamp

### Detailed Lock State Management

#### Creating Lock States (Admin Operation)

```cairo
// Function signature
fn lock_state_update(ref self: ContractState, lock_id: felt252, unlock_at: u64)

// Access control
self.accesscontrol.assert_only_role(LOCKER_ROLE);

// Validation rules
assert!(unlock_at >= starknet::get_block_timestamp(), "Must be future timestamp");
assert!(lock_id != 0, "Lock ID cannot be zero");

// Event emission
self.emit(LockStateUpdated {
    lock_id,
    unlock_at,
    timestamp: starknet::get_block_timestamp()
});
```

**Administrative Capabilities**:

- Create new lock states with unique identifiers
- Update existing lock timestamps (can only extend, not shorten)
- Set lock expiration times for future dates
- Track all lock state changes through events

**Security Considerations**:

- `LOCKER_ROLE` can modify lock states even after tokens are locked
- This is by design for emergency situations (e.g., extending tournament durations)
- Requires trusted multi-sig management for `LOCKER_ROLE`

#### Token Locking (User Operation)

```cairo
// Function signature
fn token_lock(ref self: ContractState, token_id: u256, lock_id: felt252)

// Ownership validation
let caller = starknet::get_caller_address();
let owner = self.erc721._owner_of(token_id);
assert!(caller == owner, "Only owner can lock");

// Lock state validation
let unlock_at = self.lock_state.entry(lock_id).read();
assert!(unlock_at > starknet::get_block_timestamp(), "Lock must be active");

// Lock assignment
self.token_lock.entry(token_id).write((lock_id, tx_hash));
```

**Locking Process**:

1. **Ownership Check**: Verify caller owns the token
2. **Lock Validation**: Ensure lock state exists and is active
3. **Assignment**: Link token to lock with transaction hash
4. **Event Emission**: Record lock application

**Important Restrictions**:

- Only token owners can lock their tokens (not approved operators)
- Cannot lock with expired or non-existent lock states
- Cannot lock already locked tokens (must unlock first)

#### Token Unlocking (User Operation)

```cairo
// Function signature
fn token_unlock(ref self: ContractState, token_id: u256)

// Ownership validation
let caller = starknet::get_caller_address();
let owner = self.erc721._owner_of(token_id);
assert!(caller == owner, "Only owner can unlock");

// Lock state validation
let (lock_id, _) = self.token_lock.entry(token_id).read();
assert!(lock_id != 0, "Token not locked");

let unlock_at = self.lock_state.entry(lock_id).read();
assert!(unlock_at <= starknet::get_block_timestamp(), "Lock not expired");

// Unlock operation
self.token_lock.entry(token_id).write((0, 0));
```

**Unlocking Process**:

1. **Ownership Check**: Verify caller owns the token
2. **Lock Existence**: Ensure token is actually locked
3. **Expiration Check**: Verify lock has expired
4. **Cleanup**: Reset lock assignment to (0, 0)
5. **Event Emission**: Record unlock operation

### Transfer Prevention Mechanism

The locking system integrates with ERC721 transfers through a hook mechanism:

```cairo
impl ERC721HooksImpl of ERC721Component::ERC721HooksTrait<ContractState> {
    fn before_update(
        ref self: ERC721Component::ComponentState<ContractState>,
        to: ContractAddress,
        token_id: u256,
        auth: ContractAddress,
    ) {
        let mut contract_state = self.get_contract_mut();
        assert!(!contract_state.token_is_locked(token_id), "Token is locked");
        contract_state.erc721_enumerable.before_update(to, token_id);
    }
}
```

**Hook Integration**:

- **Universal Coverage**: Prevents all transfer types (transfer, transferFrom, safeTransfer)
- **Mint/Burn Safety**: Only blocks transfers, not minting or burning
- **Lock Checking**: Uses efficient `token_is_locked()` function
- **Enumerable Integration**: Maintains enumerable functionality

### Lock State Query Functions

#### `token_is_locked(token_id: u256) -> bool`

```cairo
fn token_is_locked(self: @ContractState, token_id: u256) -> bool {
    let (lock_id, _) = self.token_lock.entry(token_id).read();
    lock_id != 0  // Simple check: any non-zero lock_id means locked
}
```

#### `token_lock_state(token_id: u256) -> (felt252, felt252)`

```cairo
fn token_lock_state(self: @ContractState, token_id: u256) -> (felt252, felt252) {
    self.token_lock.entry(token_id).read()  // Returns (lock_id, tx_hash)
}
```

### Real-World Lock Use Cases

#### Gaming Scenarios

**1. Tournament Participation**

```cairo
// Admin creates tournament lock
lock_admin.lock_state_update('world_championship_2024', 1735689600);

// Players lock their characters for tournament duration
lock.token_lock(character_nft_id, 'world_championship_2024');

// Characters cannot be traded during tournament
// Auto-unlock after tournament ends
```

**2. Staking for Rewards**

```cairo
// Admin creates staking pool
lock_admin.lock_state_update('staking_pool_q1_2024', 1706659200);

// Users stake their NFTs for rewards
lock.token_lock(collectible_id, 'staking_pool_q1_2024');

// NFTs locked for entire quarter
// Rewards distributed based on locked duration
```

**3. Governance Voting**

```cairo
// Admin creates voting period
lock_admin.lock_state_update('dao_proposal_vote_15', 1704067200);

// Voters lock tokens to participate
lock.token_lock(governance_token_id, 'dao_proposal_vote_15');

// Prevents vote selling during voting period
```

---

## 🔐 Access Control System

### Role Hierarchy

| Role                    | Permissions                          | Purpose               |
| ----------------------- | ------------------------------------ | --------------------- |
| `DEFAULT_ADMIN_ROLE`    | Grant/revoke all roles               | System administration |
| `MINTER_ROLE`           | Mint new tokens with attributes      | Token creation        |
| `METADATA_UPDATER_ROLE` | Update trait names and IPFS mappings | Metadata management   |
| `LOCKER_ROLE`           | Create and manage lock states        | Lock administration   |
| `UPGRADER_ROLE`         | Upgrade contract implementation      | Contract evolution    |

### Permission Matrix

```cairo
┌─────────────────────────┬─────────┬──────────────┬─────────┬──────────┬─────────────┐
│ Function                │ MINTER  │ METADATA_UPD │ LOCKER  │ UPGRADER │ ADMIN       │
├─────────────────────────┼─────────┼──────────────┼─────────┼──────────┼─────────────┤
│ safe_mint()             │    ✓    │              │         │          │             │
│ set_trait_type_name()   │         │      ✓       │         │          │             │
│ set_trait_value_name()  │         │      ✓       │         │          │             │
│ set_default_ipfs_cid()  │         │      ✓       │         │          │             │
│ set_attrs_raw_to_ipfs() │         │      ✓       │         │          │             │
│ lock_state_update()     │         │              │    ✓    │          │             │
│ upgrade()               │         │              │         │     ✓    │             │
│ grant_role()            │         │              │         │          │      ✓      │
│ revoke_role()           │         │              │         │          │      ✓      │
└─────────────────────────┴─────────┴──────────────┴─────────┴──────────┴─────────────┘
```

## 📊 Metadata Generation

### JSON Metadata Structure

The contract generates OpenSea-compatible metadata that follows the standard format:

```json
{
  "name": "Collection Name #123",
  "description": "Collection description",
  "image": "ipfs://QmSpecificImageCIDOrDefaultCID",
  "attributes": [
    {
      "trait_type": "Rarity",
      "value": "Legendary"
    },
    {
      "trait_type": "Element",
      "value": "Fire"
    },
    {
      "trait_type": "Power",
      "value": "Mighty"
    },
    {
      "trait_type": "Region",
      "value": "Northern Realms"
    }
  ]
}
```

### Metadata Generation Pipeline

#### Step 1: Attribute Retrieval and Unpacking

```cairo
fn get_metadata_json(self: @ContractState, token_id: u256) -> ByteArray {
    // 1. Get packed attributes from storage
    let attrs_raw: u128 = self.token_id_to_attrs_raw.entry(token_id).read();

    // 2. Unpack into individual bytes
    let mut attrs_arr: Array<u8> = unpack_u128_to_bytes_full(attrs_raw);

    // attrs_arr now contains [byte0, byte1, byte2, ..., byte15]
    // where byte_i corresponds to trait_type_i
}
```

#### Step 2: IPFS Image Resolution

```cairo
// 3. Determine image CID (specific or default)
let mut ipfs_cid: ByteArray = self.attrs_raw_to_ipfs_cid.entry(attrs_raw).read();
if ipfs_cid == "" {
    ipfs_cid = self.default_ipfs_cid.read();
}
```

**Image Resolution Logic**:

- **Primary**: Check if specific attribute combination has custom image
- **Fallback**: Use default image for all other combinations
- **Format**: Always returns IPFS CID without protocol prefix

#### Step 3: Trait Resolution and Filtering

```cairo
// 4. Build trait array (only non-zero values)
let mut attrs_data: Array<(ByteArray, ByteArray)> = array![];

for i in 0..attrs_arr.len() {
    let trait_value: u8 = attrs_arr.pop_front().unwrap();

    if trait_value > 0 {  // Skip empty traits
        let trait_type_name: ByteArray =
            self.trait_type_to_name.entry(i.try_into().unwrap()).read();
        let trait_value_name: ByteArray =
            self.trait_value_to_name.entry((i.try_into().unwrap(), trait_value)).read();

        // Only add if both names exist
        if trait_type_name != "" && trait_value_name != "" {
            attrs_data.append((trait_type_name, trait_value_name));
        }
    }
}
```

**Filtering Rules**:

- Skip trait positions with value 0 (no trait present)
- Skip traits where type name is not set
- Skip traits where value name is not set
- Maintain attribute order (position 0 first, then 1, etc.)

#### Step 4: JSON Compilation and Encoding

```cairo
// 5. Generate final JSON and encode
make_json_and_base64_encode_metadata(attrs_data, ipfs_cid)
```

The final step uses a utility function that:

1. **Builds JSON Structure**: Creates properly formatted JSON with image and attributes
2. **Handles Special Characters**: Escapes quotes, newlines, and other JSON special characters
3. **Base64 Encoding**: Converts to data URI format: `data:application/json;base64,...`
4. **Returns Data URI**: Compatible with OpenSea and other NFT platforms

### IPFS Image Management

#### Two-Tier Image System

**Tier 1: Attribute-Specific Images**

```cairo
// Set specific image for exact attribute combination
metadata.set_attrs_raw_to_ipfs_cid(
    0x00000000000000000000000000000005,  // Legendary rarity only
    "QmLegendarySpecialArtworkCID",
    false
);
```

**Tier 2: Default Fallback**

```cairo
// Set default image for all other combinations
metadata.set_default_ipfs_cid("QmDefaultCollectionArtworkCID", false);
```

#### Advanced Image Mapping Strategies

**Strategy 1: Rarity-Based Images**

```cairo
// Different images for different rarity levels
metadata.set_attrs_raw_to_ipfs_cid(0x01, "QmCommonCID", false);     // Common
metadata.set_attrs_raw_to_ipfs_cid(0x02, "QmUncommonCID", false);   // Uncommon
metadata.set_attrs_raw_to_ipfs_cid(0x03, "QmRareCID", false);       // Rare
metadata.set_attrs_raw_to_ipfs_cid(0x04, "QmEpicCID", false);       // Epic
metadata.set_attrs_raw_to_ipfs_cid(0x05, "QmLegendaryCID", false);  // Legendary
```

**Strategy 2: Element-Based Images**

```cairo
// Different images for different elements (trait_type_1)
metadata.set_attrs_raw_to_ipfs_cid(0x0100, "QmFireCID", false);     // Fire element
metadata.set_attrs_raw_to_ipfs_cid(0x0200, "QmWaterCID", false);    // Water element
metadata.set_attrs_raw_to_ipfs_cid(0x0300, "QmEarthCID", false);    // Earth element
metadata.set_attrs_raw_to_ipfs_cid(0x0400, "QmAirCID", false);      // Air element
```

**Strategy 3: Combination-Based Images**

```cairo
// Specific images for special combinations
metadata.set_attrs_raw_to_ipfs_cid(
    0x00000000000000000000000003020105,  // Legendary Fire Mighty
    "QmLegendaryFireMightyCID",
    false
);
```

### Trait System Management

#### Setting Up Trait Types

```cairo
// Define the category of traits (what the trait represents)
metadata.set_trait_type_name(0, "Rarity", false);      // Position 0 = Rarity
metadata.set_trait_type_name(1, "Element", false);     // Position 1 = Element
metadata.set_trait_type_name(2, "Power Level", false); // Position 2 = Power
metadata.set_trait_type_name(3, "Region", false);      // Position 3 = Geographic region
metadata.set_trait_type_name(4, "Class", false);       // Position 4 = Character class
metadata.set_trait_type_name(5, "Weapon", false);      // Position 5 = Equipped weapon
```

#### Setting Up Trait Values

```cairo
// Define specific values within each trait type
// Rarity values (trait_type_id = 0)
metadata.set_trait_value_name(0, 1, "Common", false);
metadata.set_trait_value_name(0, 2, "Uncommon", false);
metadata.set_trait_value_name(0, 3, "Rare", false);
metadata.set_trait_value_name(0, 4, "Epic", false);
metadata.set_trait_value_name(0, 5, "Legendary", false);
metadata.set_trait_value_name(0, 6, "Mythic", false);

// Element values (trait_type_id = 1)
metadata.set_trait_value_name(1, 1, "Fire", false);
metadata.set_trait_value_name(1, 2, "Water", false);
metadata.set_trait_value_name(1, 3, "Earth", false);
metadata.set_trait_value_name(1, 4, "Air", false);
metadata.set_trait_value_name(1, 5, "Light", false);
metadata.set_trait_value_name(1, 6, "Shadow", false);
```

#### Trait System Validation

```cairo
// Validation rules enforced by contract
assert!(trait_type_id < 16, "Trait type must be 0-15");
assert!(trait_value_id > 0 && trait_value_id <= 255, "Trait value must be 1-255");

// Overwrite protection (when overwrite = false)
assert!(
    existing_name == "",
    "Trait name already exists - use overwrite=true to modify"
);
```

### Metadata Query Optimization

#### Gas-Efficient Queries

**Raw Metadata Retrieval**:

```cairo
// Cheapest operation - single storage read
let raw_attrs = metadata.get_metadata_raw(token_id);  // ~800 gas
```

**Full JSON Generation**:

```cairo
// More expensive - includes name resolution and JSON building
let json_metadata = metadata.get_metadata_json(token_id);  // ~3000-8000 gas
```

**Batch Operations** (for external tools):

```cairo
// Read multiple tokens efficiently
let mut batch_metadata = array![];
for token_id in token_ids {
    batch_metadata.append(metadata.get_metadata_raw(token_id));
}
```

---

## API Reference

### Core NFT Functions

#### `safe_mint(recipient: ContractAddress, attributes_raw: u128)`

**Purpose**: Mints a new NFT with packed attributes to the specified recipient.

**Access Control**: Requires `MINTER_ROLE`

**Parameters**:

- `recipient`: Address that will own the newly minted token
- `attributes_raw`: Packed u128 containing up to 16 trait values (must be non-zero)

**Validation**:

```cairo
assert!(attributes_raw != 0, "RealmsCollectible: Attributes raw must be non-zero");
// Must have IPFS CID set for attributes (specific or default)
let ipfs_cid = self.attrs_raw_to_ipfs_cid.entry(attributes_raw).read();
assert!(ipfs_cid != "", "RealmsCollectible: IPFS CID not set for those attributes");
```

**Events Emitted**:

- `Transfer(from: 0, to: recipient, token_id)`
- Standard ERC721 events

**Example Usage**:

```cairo
// Mint a Legendary Fire Mighty token (attributes: [0,0,0,0,0,0,0,0,0,0,0,0,3,1,5])
let attributes = 0x00000000000000000000000000030105_u128;
mint_burn.safe_mint(player_address, attributes);
// Token ID will be auto-generated (e.g., 1, 2, 3, etc.)
```

#### `burn(token_id: u256)`

**Purpose**: Burns (destroys) an existing token.

**Access Control**: Token owner or approved operator

**Parameters**:

- `token_id`: ID of token to burn

**Validation**:

```cairo
self.erc721._require_owned(token_id);
// Standard ERC721 authorization checks
```

**Side Effects**:

- Removes token from circulation
- Clears approvals
- Updates enumerable indices
- Attribute data remains in storage but becomes inaccessible

### Metadata Management Functions

#### `
