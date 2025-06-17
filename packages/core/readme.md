# Eternum SDK

The Eternum SDK is a core package that provides essential functionality for building applications on Starknet & Dojo. It
serves as the foundation for the Eternum ecosystem, offering a set of utilities, managers, and data structures to enable
seamless integration with the blockchain.

## Features

- **EternumProvider**: A robust provider implementation for interacting with the Eternum protocol
- **Data Structures**: Core data types and constants used throughout the Eternum ecosystem
- **Utility Functions**: Helper functions for common operations including:
  - Hex map utilities for coordinate-based operations
  - Resource arrival calculations and management
- **Managers**: Specialized managers for handling different aspects of the game

## Installation

```bash
pnpm add @bibliothecadao/eternum
```

## Usage

```typescript
import { EternumProvider } from "@bibliothecadao/eternum";

// Initialize the provider
const provider = new EternumProvider({
  // configuration options
});

// Use the provider to interact with the protocol
```

## Dependencies

- `@dojoengine/core`: Core Dojo engine functionality
- `@bibliothecadao/dojo`: Dojo integration
- `@bibliothecadao/provider`: Provider implementation
- `@bibliothecadao/types`: Type definitions
- `starknet`: Starknet integration

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build
```

## License

MIT
