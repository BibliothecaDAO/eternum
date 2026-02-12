# Realms: Eternum & Blitz

Eternum is the foundational game for Realms World — a living digital ecosystem that evolves through player interaction.
It serves as both a game and an open platform.

- Community: https://discord.gg/realmsworld
- Repo docs index: [`docs/README.md`](./docs/README.md)
- Official docs site source: [`client/apps/game-docs`](./client/apps/game-docs)

## Choose your path

### I’m here to play / learn the game
- Start with the docs site: [`client/apps/game-docs`](./client/apps/game-docs)

### I’m here to build (developers)
- Setup: see **Prerequisites** + **Setup** below
- Contributing: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Contracts: [`contracts/`](./contracts)
- Packages/SDK: [`packages/`](./packages)

### I’m here for architecture / internal notes
- See [`docs/`](./docs)

---

## Project Structure

- [Client](./client) - React apps built with Vite
  - [Game](./client/apps/game) - Main game client with Three.js interface
  - [Landing](./client/apps/landing) - Landing page
  - [Game Docs](./client/apps/game-docs) - Game documentation
  - [Balancing](./client/apps/balancing) - Game balancing tools
- [Contracts](./contracts) - Cairo/Dojo smart contracts
- [Packages](./packages) - Shared libraries
  - [Core](./packages/core) - Eternum SDK
  - [Provider](./packages/provider) - Game contract interactions
  - [React](./packages/react) - React hooks and components
  - [Torii](./packages/torii) - On-chain data querying
  - [Types](./packages/types) - Type definitions
- [Config](./config) - Configuration and deployment scripts

## Realtime communication

The realtime work plan was moved out of the README to keep this page focused:
- [`docs/roadmap/realtime.md`](./docs/roadmap/realtime.md)

## Packages overview

For package-by-package docs, see:
- [`packages/README.md`](./packages/README.md)

## Prerequisites

- [Dojo](https://book.dojoengine.org) v1.0.4
- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/) v9.12.3
- [Bun](https://bun.sh/)

## Setup

1) Install Dojo:

```bash
curl -L https://install.dojoengine.org | bash
```

2) Install pnpm:

```bash
npm install -g pnpm
```

3) Install dependencies:

```bash
pnpm install
```

4) Build shared packages:

```bash
pnpm run build:packages
```

## Development commands (common)

- `pnpm dev` - Start game development server
- `pnpm dev:docs` - Start documentation dev server (Vocs)
- `pnpm build:packages` - Build shared packages

## License

MIT
