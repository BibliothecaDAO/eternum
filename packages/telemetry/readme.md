# Eternum Types

This package provides TypeScript type definitions, constants, and Dojo-specific types for the Eternum game. It serves as
the central source of type information for all Eternum packages.

## Features

- **Type Definitions**: Comprehensive TypeScript types for:
  - Game entities and components
  - Contract interactions
  - Event structures
  - API responses
- **Constants**: Game-wide constants and configuration values
- **Dojo Types**: Type definitions for Dojo engine integration

## Installation

```bash
pnpm add @bibliothecadao/types
```

## Usage

```typescript
import { RealmInfo, StructureType, ResourcesIds, ContractAddress } from "@bibliothecadao/types";

// Use types in your code
const realm: RealmInfo = {
  // realm properties
};

// Use constants
const structureType = StructureType.Realm;
const resourceType = ResourcesIds.Wood;

// Use utility types
const address = ContractAddress("0x123...");
```

## Package Structure

- `src/types/`: Core type definitions
- `src/constants/`: Game constants and configuration
- `src/dojo/`: Dojo-specific type definitions

## Dependencies

- `@dojoengine/recs`: Dojo's component system types
- `@dojoengine/core`: Core Dojo types
- `starknet`: Starknet type definitions
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
