# Realms Collectible Deployment Guide

A comprehensive guide for deploying and managing Realms Collectible NFT contracts using the JavaScript automation
system.

## Table of Contents

1. [Overview](#overview)
2. [Setup & Configuration](#setup--configuration)
3. [Data Configuration](#data-configuration)
4. [Contract Lifecycle](#contract-lifecycle)
5. [Deployment Workflows](#deployment-workflows)
6. [Network Management](#network-management)
7. [Advanced Features](#advanced-features)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The Realms Collectible deployment system provides a complete automation toolkit for managing NFT contracts on Starknet.
It handles everything from trait data validation to contract deployment and ongoing updates.

### Key Features

- **Automated Data Validation**: Ensures trait data integrity and uniqueness
- **Multi-Network Support**: Deploy to local, testnet, or mainnet environments
- **Incremental Updates**: Update existing contracts without redeployment
- **Batch Operations**: Efficient minting and metadata management
- **Binary Optimization**: Packs trait data into efficient storage format
- **IPFS Integration**: Manages image mappings and metadata generation

### System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   JSON Config   │───▶│ Data Processor  │───▶│ Smart Contract  │
│   (Traits)      │    │ (Validation)    │    │ (Deployment)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
       │                       │                       │
       ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Example Config  │    │ Binary Encoding │    │ Trait Metadata  │
│ Trait Names     │    │ AttrsRaw Gen    │    │ IPFS Mappings   │
│ IPFS CIDs       │    │ Calldata Prep   │    │ Token Minting   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## Setup & Configuration

### Prerequisites

- **Bun** or **Node.js** (v18+)
- **Scarb** (Starknet contract compiler)
- **Starknet CLI** tools
- **Environment Variables** configured

### Installation

```bash
# Navigate to deployment directory
cd contracts/collectibles/ext/scripts/deployment

# Install dependencies
bun install

# or with npm
npm install
```

### ⚠️ Important Build Requirements

**If you're NOT using the provided `.sh` scripts, you MUST build the contracts first:**

```bash
# Navigate to contract root and build in release mode
cd contracts/collectibles
scarb --release build
```

**The provided shell scripts handle this automatically:**

- `./deploy.sh` automatically builds before deploying
- `./declare.sh` automatically builds before declaring

**If you use Bun/Node directly, you must build manually first!**

### Environment Configuration

Create a `.env` file with the required configuration:

```bash
# Network Configuration
STARKNET_NETWORK=sepolia
STARKNET_RPC_URL=https://starknet-sepolia.public.blastapi.io

# Account Configuration
STARKNET_ACCOUNT_ADDRESS=0x123...
STARKNET_PRIVATE_KEY=0x456...

# Contract Role Addresses
COLLECTIBLES_DEFAULT_ADMIN=0x789...
COLLECTIBLES_MINTER=0xabc...
COLLECTIBLES_UPGRADER=0xdef...
COLLECTIBLES_LOCKER=0x111...
COLLECTIBLES_METADATA_UPDATER=0x222...
COLLECTIBLES_DEFAULT_ROYALTY_RECEIVER=0x333...
COLLECTIBLES_FEE_NUMERATOR=250  # 2.5% royalty
```

### Directory Structure

```
ext/scripts/
├── deployment/
│   ├── data/
│   │   ├── example.json          # Example configuration
│   │   └── process.js            # Data validation & processing
│   ├── libs/
│   │   └── commands.js           # Contract interaction functions
│   ├── deploy.js                 # Deployment orchestration
│   ├── update.js                 # Contract update operations
│   ├── mint.js                   # Token minting operations
│   └── declare.js                # Contract declaration
├── deploy.sh                     # Build & deploy script
├── declare.sh                    # Build & declare script
└── package.json                  # Dependencies
```

---

## Data Configuration

### JSON Configuration Structure

The heart of the system is the JSON configuration file that defines your NFT collection's traits, images, and minting
parameters.

#### Complete Example Structure

```json
{
  "name": "Collectible: Baby Chicken",
  "symbol": "CBDC",
  "description": "I dream of a better tomorrow, where chickens can cross the road and not be questioned about their motives.",
  "updateContractAddress": "",
  "defaultIpfsCid": "Qmb7Zr5bJaSzrARdXVYzc5PMp3bbnydJu4reKBXGF8Aiz4",
  "defaultIpfsCidOverwrite": false,
  "traits": [
    /* Trait definitions */
  ],
  "traitsCombinedIpfsCid": [
    /* Image mappings */
  ],
  "mintCData": [
    /* Minting instructions */
  ]
}
```

### Trait System Configuration

#### 1. Trait Types Definition

Each trait type represents a category of attributes (max 16 types):

```json
{
  "traitTypeNameOverwrite": false,
  "traitTypeId": 0, // Sequential IDs 0-15
  "traitTypeName": "Skin", // Human-readable category name
  "traitValues": [
    {
      "traitValueId": 1, // Sequential IDs 1-255 (0 = none)
      "traitValueName": "Smooth", // Human-readable value name
      "traitValueNameOverwrite": false
    },
    {
      "traitValueId": 2,
      "traitValueName": "Rough",
      "traitValueNameOverwrite": false
    }
  ]
}
```

#### 2. Important Constraints

**Trait Type Limits:**

- Maximum 16 trait types (IDs 0-15)
- IDs must be sequential starting from 0
- Names must be unique across all trait types

**Trait Value Limits:**

- Maximum 255 values per trait type (IDs 1-255)
- ID 0 is reserved for "no trait present"
- IDs must be sequential starting from 1
- Names must be unique within each trait type

**Binary Encoding:** Each trait type occupies exactly 8 bits (1 byte) in the packed representation:

- Trait Type 0: bits 0-7
- Trait Type 1: bits 8-15
- Trait Type 2: bits 16-23
- etc.

### Image Mapping System

#### 1. Default Fallback Image

```json
{
  "defaultIpfsCid": "QmDefaultCollectionImage123",
  "defaultIpfsCidOverwrite": false
}
```

#### 2. Trait Combination Images

Map specific trait combinations to unique artwork:

```json
{
  "traitsCombinedIpfsCid": [
    {
      "traits": "Skin:Smooth,Structure:Regular,Eyes:Normal",
      "ipfsCid": "QmSg9bPzW9anFYc3wWU5KnvymwkxQTpmqcRSfYj7UmiBa7",
      "overwrite": false
    },
    {
      "traits": "Skin:Scratched,Structure:Regular,Eyes:Elf",
      "ipfsCid": "QmNdvtT9EmrUc6haJyN7ZanHNrsjd23v1ydG6r8jTGEZvq",
      "overwrite": false
    }
  ]
}
```

**Trait String Format:**

- Format: `"TraitType1:TraitValue1,TraitType2:TraitValue2"`
- Must reference existing trait types and values
- No duplicate trait types within one combination
- Order doesn't matter for the combination string

#### 3. Binary Conversion Example

For the combination `"Skin:Smooth,Structure:Village,Eyes:Normal"`:

```
Trait Mappings:
- Skin (type 0): Smooth (value 1) → byte 0 = 1
- Structure (type 1): Village (value 2) → byte 1 = 2
- Eyes (type 2): Normal (value 1) → byte 2 = 1

Binary Result: 0x010201
```

### Minting Configuration

Define which tokens to mint during deployment:

```json
{
  "mintCData": [
    {
      "traits": "Skin:Rough,Structure:Regular,Eyes:Normal",
      "toAddress": "0x01bfc84464f990c09cc0e5d64d18f54c3469fd5c467398bf31293051bade1c39",
      "count": 7
    },
    {
      "traits": "Skin:Smooth,Structure:Village,Eyes:Normal",
      "toAddress": "0x01bfc84464f990c09cc0e5d64d18f54c3469fd5c467398bf31293051bade1c39",
      "count": 3
    }
  ]
}
```

---

## Contract Lifecycle

### 1. Declaration Phase

Before deployment, contracts must be declared to the network:

⚠️ **CRITICAL: If not using shell scripts, build first!**

```bash
# If you DON'T use ./declare.sh, you MUST build manually:
cd contracts/collectibles
scarb --release build
cd -
```

```bash
# Build and declare contracts (automatic build)
./declare.sh sepolia

# Or use Bun directly (REQUIRES manual build first!)
cd deployment
bun run declare:sepolia
```

**Declaration Process:**

1. Builds contracts with Scarb in release mode
2. Declares the contract class to Starknet
3. Returns class hash for deployment

### 2. Deployment Phase

Deploy a new contract instance with your configuration:

⚠️ **CRITICAL: If not using shell scripts, build first!**

```bash
# If you DON'T use ./deploy.sh, you MUST build manually:
cd contracts/collectibles
scarb --release build
cd -
```

```bash
# Build and deploy with trait data (automatic build)
# Specify collectible type: cosmetics or loot-chests
./deploy.sh cosmetics sepolia

# Or use Bun directly (REQUIRES manual build first!)
cd deployment
bun run deploy:cosmetics:sepolia
# or for loot-chests
bun run deploy:loot-chests:sepolia
```

**Deployment Process:**

1. Validates JSON configuration data
2. Deploys contract with constructor parameters
3. Sets default IPFS CID
4. Configures all trait type names
5. Configures all trait value names
6. Maps trait combinations to IPFS CIDs
7. Performs initial minting (if specified)

### 3. Update Phase

Update existing contracts without redeployment:

```bash
# Update existing contract
cd deployment
bun run update:cosmetics:sepolia
# or for loot-chests
bun run update:loot-chests:sepolia
```

**Update Requirements:**

- Set `updateContractAddress` in JSON config
- Only items marked with `overwrite: true` are processed
- Useful for adding new traits or updating metadata

### 4. Minting Phase

Mint additional tokens after deployment:

```bash
# Mint new tokens
cd deployment
bun run mint:cosmetics:sepolia
# or for loot-chests
bun run mint:loot-chests:sepolia
```

**Minting Requirements:**

- Contract must exist and be configured
- Caller must have `MINTER_ROLE`
- All trait combinations must have IPFS CIDs configured

---

## Deployment Workflows

### Complete New Deployment

#### Step 1: Prepare Configuration

Create your `collection.json` file:

```json
{
  "name": "My Awesome Collection",
  "symbol": "AWESOME",
  "description": "A collection of awesome NFTs",
  "updateContractAddress": "",
  "defaultIpfsCid": "QmYourDefaultImage",
  "defaultIpfsCidOverwrite": false,
  "traits": [
    {
      "traitTypeNameOverwrite": false,
      "traitTypeId": 0,
      "traitTypeName": "Background",
      "traitValues": [
        {
          "traitValueId": 1,
          "traitValueName": "Blue Sky",
          "traitValueNameOverwrite": false
        },
        {
          "traitValueId": 2,
          "traitValueName": "Sunset",
          "traitValueNameOverwrite": false
        }
      ]
    }
  ],
  "traitsCombinedIpfsCid": [
    {
      "traits": "Background:Blue Sky",
      "ipfsCid": "QmBlueSkyImage",
      "overwrite": false
    }
  ],
  "mintCData": []
}
```

#### Step 2: Validate Configuration

```bash
cd deployment
node -e "
const { processData } = require('./data/process.js');
try {
  const result = processData('../data/collection.json');
  console.log('✅ Configuration valid');
} catch (error) {
  console.log('❌ Configuration error:', error.message);
}
"
```

#### Step 3: Deploy to Testnet

```bash
# Deploy to sepolia testnet first
# Choose collectible type: cosmetics or loot-chests
./deploy.sh cosmetics sepolia
```

#### Step 4: Verify Deployment

Check the deployed contract using block explorers:

```bash
# For Sepolia testnet, visit:
# https://sepolia.starkscan.co/contract/0x[your-contract-address]
#
# For Mainnet, visit:
# https://starkscan.co/contract/0x[your-contract-address]
#
# The block explorer will show:
# - Contract details and verification status
# - Transaction history
# - Read contract functions (name, symbol, etc.)
# - Write contract functions (if connected)
```

**What to verify:**

- Contract name matches your JSON configuration
- Symbol matches your JSON configuration
- Total supply shows correct initial mint count
- Trait metadata is properly configured

#### Step 5: Deploy to Mainnet

```bash
# Set mainnet environment
export STARKNET_NETWORK=mainnet

# Deploy to mainnet with collectible type
./deploy.sh cosmetics mainnet
```

### Incremental Updates

#### Step 1: Prepare Update Configuration

Modify your JSON file for updates:

```json
{
  "name": "My Awesome Collection",
  "symbol": "AWESOME",
  "updateContractAddress": "0x123abc...", // Set contract address
  "traits": [
    {
      "traitTypeNameOverwrite": true, // Enable overwrite
      "traitTypeId": 0,
      "traitTypeName": "Background Updated", // New name
      "traitValues": [
        {
          "traitValueId": 3, // New trait value
          "traitValueName": "Starry Night",
          "traitValueNameOverwrite": false
        }
      ]
    }
  ],
  "traitsCombinedIpfsCid": [
    {
      "traits": "Background:Starry Night",
      "ipfsCid": "QmStarryNightImage",
      "overwrite": false
    }
  ]
}
```

#### Step 2: Execute Update

```bash
cd deployment
bun run update:cosmetics:sepolia
# or for loot-chests
bun run update:loot-chests:sepolia
```

**Update Processing:**

- Only processes items with `overwrite: true` or new items
- Existing data remains unchanged unless explicitly overwritten
- New trait values and IPFS mappings are added
- Contract address must be specified in `updateContractAddress`

### Batch Minting

#### Step 1: Prepare Mint Configuration

```json
{
  "name": "My Awesome Collection",
  "symbol": "AWESOME",
  "updateContractAddress": "0x123abc...",
  "mintCData": [
    {
      "traits": "Background:Blue Sky",
      "toAddress": "0x456def...",
      "count": 10
    },
    {
      "traits": "Background:Sunset",
      "toAddress": "0x789ghi...",
      "count": 5
    }
  ]
}
```

#### Step 2: Execute Minting

```bash
cd deployment
bun run mint:cosmetics:sepolia
# or for loot-chests
bun run mint:loot-chests:sepolia
```

**Minting Requirements:**

- All trait combinations must have IPFS CIDs configured
- Minter account must have `MINTER_ROLE` permission
- Each mint operation creates tokens with auto-generated IDs

---

## Network Management

### Supported Networks

The deployment system supports multiple Starknet networks:

```bash
# Local development
bun run deploy:cosmetics:local
bun run deploy:loot-chests:local

# Testnet deployment
bun run deploy:cosmetics:sepolia
bun run deploy:loot-chests:slot

# Mainnet deployment
bun run deploy:cosmetics:mainnet
bun run deploy:loot-chests:mainnet
```

### Environment Configuration

Each network requires specific environment variables:

#### Sepolia Testnet

```bash
STARKNET_NETWORK=sepolia
STARKNET_RPC_URL=https://starknet-sepolia.public.blastapi.io
STARKNET_ACCOUNT_ADDRESS=0x...
STARKNET_PRIVATE_KEY=0x...
```

#### Mainnet

```bash
STARKNET_NETWORK=mainnet
STARKNET_RPC_URL=https://starknet-mainnet.public.blastapi.io
STARKNET_ACCOUNT_ADDRESS=0x...
STARKNET_PRIVATE_KEY=0x...
```

### Network-Specific Considerations

#### Local Development

- Fast iteration and testing
- No real value at stake
- Full control over accounts and timing

#### Testnet (Sepolia)

- Real network conditions
- Free test tokens
- Ideal for final testing before mainnet

#### Mainnet

- Production environment
- Real economic value
- Requires careful planning and testing

---

## Advanced Features

### Data Processing Pipeline

The system includes sophisticated data validation and processing:

#### Validation Rules

```javascript
// Trait type constraints
assert(traitTypeId < 16, "Maximum 16 trait types");
assert(traitTypeId === expectedSequential, "IDs must be sequential");
assert(uniqueTraitTypeNames, "Trait type names must be unique");

// Trait value constraints
assert(traitValueId > 0 && traitValueId <= 255, "Value IDs 1-255");
assert(uniqueWithinType, "Value names unique within trait type");
assert(sequentialValueIds, "Value IDs must be sequential");

// Combination constraints
assert(validTraitReferences, "All traits must exist");
assert(uniqueCombinations, "No duplicate combinations");
assert(noEmptyTraits, "No empty trait names or values");
```

#### Binary Encoding

The system automatically converts trait combinations to optimized binary format:

```javascript
// Example conversion process
const traits = "Skin:Smooth,Eyes:Blue,Hair:Long";

// Step 1: Parse trait string
const traitPairs = [
  ["Skin", "Smooth"], // Type 0, Value 1
  ["Eyes", "Blue"], // Type 2, Value 3
  ["Hair", "Long"], // Type 4, Value 2
];

// Step 2: Convert to binary positions
let attrsRaw = 0;
attrsRaw |= 1 << (0 * 8); // Skin at position 0
attrsRaw |= 3 << (2 * 8); // Eyes at position 2
attrsRaw |= 2 << (4 * 8); // Hair at position 4

// Result: 0x0002030001
```

### Custom Extensions

#### Adding New Networks

Edit `package.json` to add new network configurations:

```json
{
  "scripts": {
    "deploy:custom": "STARKNET_NETWORK=custom node deploy.js",
    "update:custom": "STARKNET_NETWORK=custom node update.js",
    "mint:custom": "STARKNET_NETWORK=custom node mint.js"
  }
}
```

#### Custom Data Processors

Extend `process.js` for specialized validation:

```javascript
// Add custom validation function
function validateCustomConstraints(traits) {
  // Custom business logic
  traits.forEach((trait) => {
    if (trait.traitTypeName === "Rarity") {
      assert(trait.traitValues.length <= 5, "Max 5 rarity levels");
    }
  });
}

// Integrate into processing pipeline
export function processData(fileName) {
  const data = JSON.parse(readFileSync(fileName, "utf8"));

  // Standard validation
  validateTraitsCombinations(/* ... */);

  // Custom validation
  validateCustomConstraints(data.traits);

  // Continue processing...
}
```

### Monitoring and Logging

The system provides comprehensive logging for all operations:

#### Deployment Logging

```
╔══════════════════════════════════════════════════════════╗
║ Deploying Realms Collectible [My Collection (MYCOL)]   ║
╚══════════════════════════════════════════════════════════╝

📝 Contract Configuration:
   Name: My Collection
   Symbol: MYCOL
   Default Admin: 0x123...
   Minter: 0x456...

🎯 DEFAULT IPFS CID:
   Default IPFS CID updated: 1

🏷️  TRAIT TYPES CALLDATA:
   Total trait types updated: 3
   ┌─────┬─────────────────────────────────────────────────────────┐
   │ ID  │ Name                                                    │
   ├─────┼─────────────────────────────────────────────────────────┤
   │   0 │ Background                                              │
   │   1 │ Character                                               │
   │   2 │ Accessory                                               │
   └─────┴─────────────────────────────────────────────────────────┘
```

#### Error Handling

```javascript
try {
  const result = processData(fileName);
} catch (error) {
  if (error.message.includes("Duplicate trait")) {
    console.error("❌ Trait Configuration Error:", error.message);
    console.log("💡 Tip: Ensure all trait names are unique");
  } else if (error.message.includes("Invalid trait format")) {
    console.error("❌ Trait Format Error:", error.message);
    console.log("💡 Tip: Use format 'TraitType:TraitValue'");
  } else {
    console.error("❌ Unexpected Error:", error.message);
  }
}
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Trait Configuration Errors

**Error:** `Duplicate trait type name: Background`

```bash
❌ Trait Configuration Error: Duplicate trait type name: Background
💡 Solution: Ensure all trait type names are unique across the entire collection
```

**Error:** `Invalid trait format: Background Blue Sky`

```bash
❌ Trait Format Error: Invalid trait format: Background Blue Sky
💡 Solution: Use correct format "Background:Blue Sky"
```

**Error:** `Too many trait types: maximum 16 allowed`

```bash
❌ Trait Limit Error: Too many trait types at traitTypeId 16: maximum 16 allowed
💡 Solution: Reduce number of trait types or combine similar categories
```

#### 2. IPFS Configuration Issues

**Error:** `IPFS CID not set for those attributes`

```bash
❌ IPFS Error: IPFS CID not set for those attributes
💡 Solution: Either add specific IPFS mapping or set defaultIpfsCid
```

**Fix:** Add IPFS mapping or default:

```json
{
  "defaultIpfsCid": "QmYourDefaultImage",
  "traitsCombinedIpfsCid": [
    {
      "traits": "YourTraitCombination",
      "ipfsCid": "QmSpecificImage",
      "overwrite": false
    }
  ]
}
```

#### 3. Network Connection Issues

**Error:** `Failed to connect to Starknet RPC`

```bash
❌ Network Error: Failed to connect to Starknet RPC
💡 Solution: Check RPC URL and network configuration
```

**Fix:** Verify environment variables:

```bash
# Check current configuration
echo $STARKNET_NETWORK
echo $STARKNET_RPC_URL

# Test connection
starknet get-block --network $STARKNET_NETWORK
```

#### 4. Permission Issues

**Error:** `Caller does not have MINTER_ROLE`

```bash
❌ Permission Error: Caller does not have MINTER_ROLE
💡 Solution: Grant MINTER_ROLE to the deploying account
```

**Fix:** Grant appropriate roles:

```bash
# Use the block explorer's write functions to grant roles:
#
# 1. Go to your contract on the block explorer
# 2. Connect your wallet (must be DEFAULT_ADMIN_ROLE holder)
# 3. Navigate to "Write Contract" section
# 4. Find "grant_role" function
# 5. Enter role hash and account address
#
# For Sepolia: https://sepolia.starkscan.co/contract/0x[contract-address]
# For Mainnet: https://starkscan.co/contract/0x[contract-address]
#
# Role hashes (use these exact values):
# MINTER_ROLE: 0x...hash from contract
# METADATA_UPDATER_ROLE: 0x...hash from contract
# LOCKER_ROLE: 0x...hash from contract
```

#### 5. Build Issues

**Error:** `scarb build failed`

```bash
❌ Build Error: scarb build failed
💡 Solution: Check Scarb installation and contract syntax
```

**Fix:** Verify Scarb setup:

```bash
# Check Scarb version
scarb --version

# Clean and rebuild
scarb clean
scarb build
```

### Debugging Tips

#### 1. Verbose Logging

Enable detailed logging during deployment:

```bash
# Add debug flag
STARKNET_DEBUG=1 bun run deploy:cosmetics:sepolia
```

#### 2. Data Validation

Test data processing without deployment:

```javascript
// Test configuration processing
const { processData } = require("./data/process.js");
const result = processData("data/example.json");
console.log(JSON.stringify(result, null, 2));
```

#### 3. Network Testing

Verify network connectivity:

```bash
# Test network connection
starknet get-block-number --network sepolia

# Test account balance
starknet get-balance \
  --address $STARKNET_ACCOUNT_ADDRESS \
  --network sepolia
```

#### 4. Contract Verification

Verify deployed contract state using block explorers:

```bash
# Use block explorers to verify your contract:
#
# For Sepolia testnet:
# https://sepolia.starkscan.co/contract/0x[your-contract-address]
#
# For Mainnet:
# https://starkscan.co/contract/0x[your-contract-address]
#
# The block explorer provides read/write contract functions where you can:
# - Call "name()" to verify contract name
# - Call "symbol()" to verify contract symbol
# - Call "get_trait_type_name(0)" to check first trait type
# - Call "get_trait_value_name(0,1)" to check trait values
# - View all contract transactions and events
```

**What to verify using the block explorer:**

- Contract name and symbol match your configuration
- Trait type names are properly set
- Trait value names are properly configured
- IPFS CID mappings are correctly stored
- Token metadata displays properly

### Performance Optimization

#### 1. Batch Operations

Use batch operations for large deployments:

```javascript
// Process large datasets in chunks
const chunkSize = 50;
for (let i = 0; i < traitValues.length; i += chunkSize) {
  const chunk = traitValues.slice(i, i + chunkSize);
  await setTraitValueName(contractAddress, chunk);
}
```

#### 2. Network Optimization

Optimize for network conditions:

```bash
# Use local RPC for faster development
export STARKNET_RPC_URL=http://localhost:5050

# Use premium RPC for production
export STARKNET_RPC_URL=https://premium-rpc-endpoint.com
```

---

### Support and Resources

#### Documentation

- [Starknet Documentation](https://docs.starknet.io/)
- [Cairo Language Guide](https://book.cairo-lang.org/)
- [OpenZeppelin Cairo](https://docs.openzeppelin.com/contracts-cairo/)

#### Community

- [Starknet Discord](https://discord.gg/starknet)
- [Cairo Telegram](https://t.me/starknet_cairo)
- [GitHub Issues](https://github.com/eternum-game/project/issues)

#### Tools

- [Starkscan Explorer](https://starkscan.co/)
- [Starknet Foundry](https://foundry-rs.github.io/starknet-foundry/)
- [Cairo VSCode Extension](https://marketplace.visualstudio.com/items?itemName=starkware.cairo)

---

_This guide covers the complete deployment and management workflow for Realms Collectible contracts. For specific
technical questions or issues, please refer to the contract documentation or open an issue in the project repository._
