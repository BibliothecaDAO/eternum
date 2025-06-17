# Eternum Dojo Integration

The Eternum Dojo package provides seamless integration between Eternum and the Dojo game engine. It handles the setup
and configuration of the Dojo environment, network connections, and system calls for the Eternum game.

## Features

- **Network Setup**: Easy configuration of Dojo network connections
- **Component Management**: Integration with Dojo's component system
- **System Calls**: Pre-configured system calls for game interactions
- **VRF Integration**: Support for Verifiable Random Function (VRF) provider
- **Burner Account Support**: Optional burner account functionality for development

## Installation

```bash
pnpm add @bibliothecadao/dojo
```

## Usage

```typescript
import { setup } from "@bibliothecadao/dojo";

// Configure Dojo
const config = {
  // Your Dojo configuration
};

// Setup environment
const env = {
  vrfProviderAddress: "0x...", // Your VRF provider address
  useBurner: true, // Enable burner accounts for development
};

// Initialize the Dojo integration
const { network, components, systemCalls } = await setup(config, env);

// Use the components and system calls
// components.YourComponent...
// systemCalls.yourSystemCall...
```

## Dependencies

- `@dojoengine/core`: Core Dojo engine functionality
- `@dojoengine/recs`: Dojo's component system
- `@dojoengine/sdk`: Dojo SDK for blockchain interactions
- `@bibliothecadao/types`: Type definitions
- `@bibliothecadao/provider`: Provider implementation
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
