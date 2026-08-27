# Eternum Torii SDK

This package contains SQL query utilities for interacting with the Eternum game state. It provides type-safe interfaces
for querying game data and events.

## Features

- **SQL Queries**: Direct SQL queries for complex data retrieval
  - Player structures
  - Armies and battles
  - Trading data
  - Quest information
  - Season data
  - Tile information
- **Type Definitions**: Comprehensive TypeScript types for game entities and events

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

## Package Structure

- `src/queries/sql/`: SQL queries for complex data retrieval
- `src/types/`: TypeScript type definitions
- `src/utils/`: Utility functions for data processing

## Dependencies

- `@dojoengine/sdk`: Dojo SDK for blockchain interactions
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
