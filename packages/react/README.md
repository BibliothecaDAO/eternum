# @bibliothecadao/react

Shared React hooks and stores for Eternum game applications. This package provides a collection of React hooks and
utilities that make it easy to integrate Eternum game functionality into React applications.

## Available Hooks

### Game State Hooks

- `use-armies.ts`: Army management and combat system
- `use-bank.ts`: Banking and economy system
- `use-bridge.ts`: Bridge interactions and asset management
- `use-buildings.ts`: Building construction and management
- `use-fragment-mines.ts`: Mining system for fragments
- `use-guilds.ts`: Guild management and interactions
- `use-hyperstructures.ts`: Hyperstructure management
- `use-players.ts`: Player data and interactions
- `use-quests.ts`: Quest system and tracking
- `use-realm.ts`: Realm management and interactions
- `use-resources.ts`: Resource tracking and management
- `use-resource-arrivals.ts`: Resource arrival tracking
- `use-rewards.ts`: Reward management system
- `use-season-start.ts`: Season management and timing
- `use-stamina.ts`: Stamina system management
- `use-structures.ts`: Structure management and interactions
- `use-trade.ts`: Trading system and market interactions

### Utility Hooks

- `use-cartridge-address.ts`: Cartridge address management
- `use-contributions.ts`: Contribution tracking system
- `use-debounce.ts`: Debounce utility for performance optimization
- `use-query.ts`: Query management and caching
- `use-screen-orientation.ts`: Screen orientation management

## Installation

```bash
pnpm add @bibliothecadao/react
```

## Usage

```typescript
import { usePlayerOwnedRealmsInfo } from "@bibliothecadao/react";

function RealmsList() {
  const realms = usePlayerOwnedRealmsInfo();

  return (
    <div>
      <h1>Your Realms</h1>
      {realms.map((realm) => (
        <div key={realm.entityId}>
          <h2>Realm #{realm.entityId}</h2>
          <p>Owner: {realm.owner}</p>
          {/* Display other realm properties */}
        </div>
      ))}
    </div>
  );
}
```

## Dependencies

This package requires the following peer dependencies:

- `@bibliothecadao/eternum`: Core Eternum functionality
- `@bibliothecadao/types`: Type definitions
- `@bibliothecadao/dojo`: Dojo integration
- `@dojoengine/react`: Dojo React bindings
- `@starknet-react/core`: Starknet React integration
- `react`: React library
- `starknet`: Starknet SDK
- `wouter`: Lightweight routing

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Development mode with watch
pnpm dev
```

## License

MIT
