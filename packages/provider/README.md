# Eternum Provider

The Eternum Provider package provides a comprehensive interface for interacting with the Eternum game contracts. It
handles all game transactions, state management, and contract interactions in a type-safe manner.

## Features

- **Transaction Management**: Support for all game transactions including:
  - Army operations (create, delete, buy troops, merge)
  - Battle system (start, resolve, join, leave, claim)
  - Trading system (buy, sell, create/accept orders)
  - Guild management (create, join, leave, transfer ownership)
  - Structure management (create, destroy, upgrade, transfer)
  - Resource management (mint, pickup, send)
  - Quest system (start, claim rewards)
- **Contract Interactions**: Type-safe methods for all contract calls
- **Promise Queue**: Batches and manages transaction execution for optimal performance

## Installation

```bash
pnpm add @bibliothecadao/provider
```

## Usage

### Basic Provider Setup

```typescript
import { EternumProvider } from "@bibliothecadao/provider";

// Initialize the provider
const provider = new EternumProvider(katanaManifest, rpcUrl, vrfProviderAddress);
```

### Transaction Examples

#### Create a Trade Order

```typescript
// Create a trade offering 100 wood for 50 stone
const tx = await provider.create_order({
  maker_id: 123,
  taker_id: 456,
  maker_gives_resource_type: 1, // wood
  taker_pays_resource_type: 2, // stone
  maker_gives_min_resource_amount: 100,
  maker_gives_max_count: 1,
  taker_pays_min_resource_amount: 50,
  expires_at: 1704067200,
  signer: account,
});
```

#### Accept a Trade Order

```typescript
// Accept a trade order
const tx = await provider.accept_order({
  taker_id: 123,
  trade_id: 789,
  taker_buys_count: 1,
  signer: account,
});
```

#### Upgrade a Realm

```typescript
// Upgrade a realm's level
const tx = await provider.upgrade_realm({
  realm_entity_id: 123,
  signer: account,
});
```

#### Bridge Operations

```typescript
// Deposit resources into a realm
const tx = await provider.bridge_deposit_into_realm({
  resources: [{ tokenAddress: "0x...", amount: 100 }],
  recipient_structure_id: 123,
  client_fee_recipient: "0x...",
  signer: account,
});

// Withdraw resources from a realm
const tx = await provider.bridge_withdraw_from_realm({
  resources: [{ tokenAddress: "0x...", amount: 100 }],
  from_structure_id: 123,
  recipient_address: "0x...",
  client_fee_recipient: "0x...",
  signer: account,
});
```

### Promise Queue System

The provider includes a smart transaction queue system that:

- Batches related transactions together
- Optimizes transaction execution
- Handles transaction dependencies
- Provides automatic retry and error handling

```typescript
// Transactions are automatically queued and batched
const tx1 = provider.create_order({ ... }); // Queued
const tx2 = provider.accept_order({ ... }); // Queued
const tx3 = provider.upgrade_realm({ ... }); // Queued

// Transactions are executed in optimal batches
// Related transactions are grouped together
// Maximum batch size is 3 transactions
```

## Dependencies

- `@bibliothecadao/types`: Type definitions
- `@dojoengine/core`: Core Dojo functionality
- `starknet`: Starknet SDK
- `@scure/starknet`: Additional Starknet utilities

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Generate documentation
pnpm gen:docs
```

## License

MIT
