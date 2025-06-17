<a href="https://twitter.com/lootrealms">
<img src="https://img.shields.io/twitter/follow/lootrealms?style=social"/>
</a>
<a href="https://twitter.com/BibliothecaDAO">
<img src="https://img.shields.io/twitter/follow/BibliothecaDAO?style=social"/>
</a>

[![discord](https://img.shields.io/badge/join-bibliothecadao-black?logo=discord&logoColor=white)](https://discord.gg/realmsworld)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

# Realms: Eternum

Eternum has been designed to be a foundational game for Realms World. It will freely evolve and grow as the game and
world age. Think of it as a living, breathing digital ecosystem, constantly inviting endless exploration. It's both a
game and an open platform.

### Eternum as a Game

A unique, high-stakes game played over seasons. Players can pursue total victory or freely explore their own path,
unconstrained by predetermined objectives.

In Eternum, players forge alliances across an infinite hexagonal procedurally generated map during fully onchain,
immutable seasons. They build resource stockpiles, train troops, trade, and strategically cooperate or deceive to
achieve victory in this world of diplomacy, resource management, and tactical decision-making.

Entry is via a Season pass minted off the original Loot Realms NFTs. Using $LORDS, players trade in a free market within
the world and on Starknet to gain competitive advantages. The open nature of the design allows players to extend the
game world and introduce their own features if they choose.

### Eternum as a Platform

Eternum lays a robust scaffold on which to build higher-level structures and games. It establishes key functional
systems in the Core layer while introducing fungible resources, serving as a foundation for future development and
expansion.

<details>
<summary> Click to expand</summary>

### Open World Philosophy

Emphasizing the concept of a truly Autonomous World is pivotal. In our vision, it must embody two key characteristics:
radical openness and persistence. But what exactly does this entail? Let's delve into both theoretical and mechanical
perspectives.

From a theoretical standpoint, radical openness signifies an inclusive world accessible to everyone. This openness
transcends traditional barriers - there are no gatekeepers, no singular entities exerting control. Instead, it's a space
where anyone can contribute, build, and actively participate without restrictions.

Mechanically, radical openness is reflected in the flexibility and adaptability of the world's underlying structures.
The contracts that define this world are not rigid; they are designed to be extended, forked, and maintained by anyone
with the willingness and capability to do so.

Envision Eternum as akin to the original cellular structure in a primordial soup. Over time, this basic form dissolves,
giving rise to a more complex organism. Eternum is the genesis, the starting point from which an intricate and expansive
world emerges, constantly evolving and reshaping itself in response to the contributions and interactions of its
inhabitants.

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
  - [React](./packages/react) - React hooks and components
- [Config](./config) - Configuration and deployment scripts

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
