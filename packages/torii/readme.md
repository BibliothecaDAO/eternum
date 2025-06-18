# Eternum Torii SDK

This package contains the Torii client and SQL query utilities for interacting with the Eternum game state. It provides
type-safe interfaces for querying game data and events.

## Features

- **Torii Client (gRPC)**: Type-safe client for interacting with the Torii server using `@dojoengine/torii-wasm`
  - Real-time event subscriptions
  - Entity queries
  - Component queries
- **SQL Queries**: Direct SQL queries for complex data retrieval
  - Player structures
  - Armies and battles
  - Trading data
  - Quest information
  - Season data
  - Tile information
- **Type Definitions**: Comprehensive TypeScript types for game entities and events
- **Query Parser**: Utilities for parsing and processing query results

## Installation

```bash
pnpm add @bibliothecadao/torii
```

## Usage

### SQL Queries

```typescript
import { SqlApi } from "@bibliothecadao/torii";

// Initialize the SQL API client
const sqlApi = new SqlApi("https://your-torii-server/sql");

// Fetch player structures
const structures = await sqlApi.fetchPlayerStructures("0x123...");
console.log("Player structures:", structures);
```

### Torii Client (gRPC)

```typescript
import { ToriiClient, getExplorerFromToriiClient } from "@bibliothecadao/torii";

// Initialize the Torii client
const client = new ToriiClient({
  // Configuration options
});

// Fetch explorer data
const explorer = await getExplorerFromToriiClient(client, entityId);
console.log("Explorer:", explorer?.explorer);
```

## Package Structure

- `src/parser/`: Torii client implementation and event parsing
- `src/queries/`:
  - `torii-client/`: gRPC queries using `@dojoengine/torii-wasm`
  - `sql/`: SQL queries for complex data retrieval
- `src/types/`: TypeScript type definitions
- `src/utils/`: Utility functions for data processing

## Dependencies

- `@dojoengine/sdk`: Dojo SDK for blockchain interactions
- `@dojoengine/torii-wasm`: WebAssembly bindings for Torii gRPC
- `@bibliothecadao/types`: Type definitions for Eternum

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
