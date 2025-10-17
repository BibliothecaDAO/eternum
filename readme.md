<a href="https://twitter.com/lootrealms">
<img src="https://img.shields.io/twitter/follow/lootrealms?style=social"/>
</a>
<a href="https://twitter.com/BibliothecaDAO">
<img src="https://img.shields.io/twitter/follow/BibliothecaDAO?style=social"/>
</a>

[![discord](https://img.shields.io/badge/join-bibliothecadao-black?logo=discord&logoColor=white)](https://discord.gg/realmsworld)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

# Realms: Eternum

Eternum is the foundational game for Realms World - a living digital ecosystem that evolves through player interaction.
It serves as both a game and an open platform.

### Eternum as a Game

A high-stakes strategy game played in competitive seasons where players forge their own unique path to victory. On an
infinite hexagonal world map, players:

- Build resource stockpiles
- Train troops
- Explore the map
- Trade resources
- Form alliances
- Compete for dominance

Access requires a Season Pass minted from Loot Realms NFTs. Players use $LORDS tokens to trade in the game's free market
on Starknet.

### Eternum as a Platform

Eternum provides the core infrastructure for building games and applications. It includes:

- Core functional systems
- Fungible resource framework
- Extensible architecture

<details>
<summary>Click to expand</summary>

### Open World Philosophy

Eternum is built as an Autonomous World with two core principles:

1. Radical Openness

- No gatekeepers or central control
- Anyone can build and contribute
- Open source and extensible

2. Persistence

- Fully onchain game state
- Immutable seasons
- Player-driven evolution

The platform is designed to be forked and extended by the community, serving as the foundation for an expanding
ecosystem of games and applications.

</details>

## Project Structure

- [Client](./client) - React apps built with Vite
  - [Game](./client/apps/game) - Main game client with Three.js interface
  - [Landing](./client/apps/landing) - Landing page
  - [Game Docs](./client/apps/game-docs) - Game documentation
  - [Balancing](./client/apps/balancing) - Game balancing tools
- [Contracts](./contracts) - Cairo/Dojo smart contracts
  - Game contracts
  - Season Pass contracts
  - Season Resources contracts
- [Packages](./packages) - Shared libraries
  - [Core](./packages/core) - Eternum SDK
  - [Provider](./packages/provider) - Game contract interactions
  - [React](./packages/react) - React hooks and components
  - [Torii](./packages/torii) - On-chain data querying
  - [Types](./packages/types) - Type definitions
- [Apps](./apps) - Isolated services that support the game clients
  - [Realtime Server](./apps/realtime-server) - Socket.IO + Fastify service for notes, chat, and direct messaging
- [Config](./config) - Configuration and deployment scripts

## Realtime Communication Build Plan

1. Bootstrap `apps/realtime-server` with Fastify + Socket.IO, pnpm scripts, and environment scaffolding.
2. Define shared TypeScript contracts and validation in a new `packages/realtime-schema` workspace package.
3. Model Prisma schema for notes, world chat, DM threads/messages, and run the initial migration.
4. Implement server handlers for HTTP history endpoints and realtime rooms (world, zone, location, direct) with username
   auth and rate limits.
5. Ship `packages/realtime-client` to wrap the Socket.IO transport with reconnection, buffering, and typed events.
6. Wire new feature slices in `client/apps/game` for notes, world chat, and DMs, including UI panels and map overlays.
7. Add moderation tooling, automated tests, and deployment docs/observability before opening the feature for QA.

## Eternum Packages Overview

The Eternum ecosystem is composed of several core packages, each serving a specific role in the development and
operation of the game and platform:

### Core (`@bibliothecadao/eternum`)

The foundation of the Eternum SDK, providing essential building blocks for applications on Starknet & Dojo. Includes the
main provider implementation, core data structures, utility functions (such as hex map and resource management), and
specialized managers for game logic. Enables seamless blockchain integration and protocol interaction.

### Provider (`@bibliothecadao/provider`)

A comprehensive, type-safe interface for interacting with Eternum game contracts. Manages all game transactions (army,
battle, trading, guild, structure, resource, and quest operations), contract calls, and event handling. Features a smart
promise queue that batches and optimizes transaction execution for performance and reliability.

### React (`@bibliothecadao/react`)

A collection of shared React hooks and stores designed for Eternum game applications. Provides easy access to game
state, player data, and contract interactions within React components. Simplifies frontend development by offering hooks
for realms, resources, and player-owned data, ensuring smooth integration with the Eternum backend.

### Torii (`@bibliothecadao/torii`)

Enables advanced querying of on-chain Eternum data. Supports both gRPC-based queries (via the torii-client) and direct
SQL queries (via the sql folder), allowing developers to fetch, filter, and aggregate game data efficiently. Ideal for
analytics, dashboards, and any application requiring rich data access.

### Types (`@bibliothecadao/types`)

A centralized collection of type definitions and constants used throughout the Eternum ecosystem. Ensures type safety
and consistency across all packages, covering entities, resources, transactions, and system properties. Essential for
maintaining a robust and reliable codebase.

| Package  | Description                                                                          |
| -------- | ------------------------------------------------------------------------------------ |
| Core     | Foundation for Eternum apps: provider, data structures, utilities, and managers.     |
| Provider | Type-safe interface for all game contract interactions and transaction management.   |
| React    | Shared React hooks and stores for easy frontend integration with Eternum game state. |
| Torii    | Advanced on-chain data querying via gRPC and SQL for analytics and dashboards.       |
| Types    | Centralized type definitions and constants for consistency and type safety.          |

## Prerequisites

- [Dojo](https://book.dojoengine.org) v1.0.4
- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/) v9.12.3
- [Bun](https://bun.sh/)

## Core Dependencies

- [@dojoengine/react](https://www.npmjs.com/package/@dojoengine/react) - React integration for Dojo
- [@dojoengine/recs](https://www.npmjs.com/package/@dojoengine/recs) - Entity Component System
- [@cartridge/controller](https://www.npmjs.com/package/@cartridge/controller) - Game controller integration
- [Starknet.js](https://www.npmjs.com/package/starknet) v6.23.1 - StarkNet interaction
- [Vite](https://vitejs.dev/) - Frontend build tool

## Setup

1. Install Dojo:

```bash
curl -L https://install.dojoengine.org | bash
```

2. Install pnpm:

```bash
npm install -g pnpm
```

3. Install project dependencies:

```bash
pnpm install
```

4. Build shared packages:

```bash
pnpm run build:packages
```

## Game App

This is the main game application for Eternum, built with React, TypeScript, and Vite.

### Running Locally

To run the game locally:

1. Navigate to the game client directory:
   ```bash
   cd client/apps/game
   ```
2. Make a copy of `.env.local.sample` and rename it to `.env.local`
3. Update the following environment variables in `.env.local` based on your target environment:
   - `VITE_PUBLIC_TORII="http://127.0.0.1:8080"`
   - `VITE_PUBLIC_NODE_URL="http://127.0.0.1:5050"`
4. Run `pnpm run dev` to start the development server

## Development of Eternum

Development of Eternum is open-source. If you would like to contribute comment on an open issue.

## Available Scripts

### Development

- `pnpm dev` - Start game development server
- `pnpm dev:docs` - Start documentation development server
- `pnpm dev:landing` - Start landing page development server

### Building

- `pnpm build` - Build game client
- `pnpm build:docs` - Build documentation
- `pnpm build:landing` - Build landing page
- `pnpm build:packages` - Build shared packages

### Testing & Linting

- `pnpm test` - Run all tests
- `pnpm lint` - Run linting
- `pnpm format` - Format code
- `pnpm format:check` - Check code formatting

### Contract Deployment

Eternum supports multiple deployment environments:

| Environment | Description                 |
| ----------- | --------------------------- |
| Local       | For development and testing |
| Slot        | Staging environment         |
| Sepolia     | Public testnet              |
| Mainnet     | Production environment      |

#### Deploying to Local

Before deploying to any environment, confirm that you have a `.env.{environment}` file in the `contracts/common`
directory, as well as in the `client/apps/game` directory. <br>

To deploy and run the game locally:

```bash
# Start local game contracts
pnpm run contract:start:local
```

#### Deploying to Sepolia

To deploy the contracts to Sepolia testnet, run these commands in order:

1. Deploy game contracts:

```bash
pnpm run game:migrate:sepolia
```

2. Deploy season pass contracts:

```bash
pnpm run seasonpass:deploy:sepolia
```

3. Deploy season resources contracts:

```bash
pnpm run seasonresources:deploy:sepolia
```

4. Update TOML configuration:

```bash
pnpm run toml:update:sepolia
```

5. Start the indexer:

```bash
pnpm run indexer:start:sepolia
```

6. Deploy game configuration:

```bash
pnpm run config:deploy:sepolia
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.
