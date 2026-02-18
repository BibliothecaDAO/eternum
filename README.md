```
    ╔═══════════════════════════════════════════════════════════════════╗
    ║                                                                   ║
    ║   ██████╗ ███████╗ █████╗ ██╗     ███╗   ███╗███████╗            ║
    ║   ██╔══██╗██╔════╝██╔══██╗██║     ████╗ ████║██╔════╝            ║
    ║   ██████╔╝█████╗  ███████║██║     ██╔████╔██║███████╗            ║
    ║   ██╔══██╗██╔══╝  ██╔══██║██║     ██║╚██╔╝██║╚════██║           ║
    ║   ██║  ██║███████╗██║  ██║███████╗██║ ╚═╝ ██║███████║           ║
    ║                                                                   ║
    ║   ███████╗████████╗███████╗██████╗ ███╗   ██╗██╗   ██╗███╗   ███╗║
    ║   ██╔════╝╚══██╔═╝██╔════╝██╔══██╗████╗  ██║██║   ██║████╗ ████║║
    ║   █████╗     ██║   █████╗  ██████╔╝██╔██╗ ██║██║   ██║██╔████╔██║║
    ║   ██╔══╝     ██║   ██╔══╝  ██╔══██╗██║╚██╗██║██║   ██║██║╚██╔╝██║║
    ║   ███████╗   ██║   ███████╗██║  ██║██║ ╚████║╚██████╔╝██║ ╚═╝ ██║║
    ║   ╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝     ╚═╝║
    ║                                                                   ║
    ║           The Onchain Strategy Game of the Realmverse              ║
    ╚═══════════════════════════════════════════════════════════════════╝
```

<div align="center">

**An open-source, fully onchain strategy game built on [Starknet](https://starknet.io) with the [Dojo](https://dojoengine.org) engine.**

Conquer hex territories. Harvest resources. Build armies. Forge alliances. Win seasons.

[Play Now](https://eternum.realms.world) · [Documentation](https://docs.realms.world) · [Discord](https://discord.gg/realmsworld) · [Twitter](https://twitter.com/lootrealms)

</div>

---

## What is Eternum?

Eternum is the foundational game of the [Realms World](https://realms.world) ecosystem — a fully onchain strategy game where every action lives on Starknet. You claim Realms, manage resources across a hex-based world map, raise armies, trade with other players, and compete in seasonal competitions for $LORDS tokens.

**Everything is onchain.** Contracts are the game. The client is just a window.

### 🔥 Blitz

**Blitz** is the competitive tournament format — shorter, faster, deadlier.

- Compact hex maps, compressed timelines
- All realms start with the same 9 resources and infinite labor
- MMR-ranked matchmaking (Elo-like system)
- Points from capturing hyperstructures, essence rifts, camps, and exploration
- Seasons and series with $LORDS prize pools

Think of Eternum as the sandbox. Blitz is the arena.

## Architecture

```
eternum/
├── client/                    # Frontend applications
│   └── apps/
│       ├── game/              # Main game client (React + Three.js)
│       ├── landing/           # Landing page
│       ├── game-docs/         # Documentation site (Vocs)
│       └── balancing/         # Game balancing tools
├── contracts/                 # Cairo/Dojo smart contracts
├── packages/                  # Shared libraries & SDK
│   ├── core/                  # @bibliothecadao/eternum (core SDK)
│   ├── provider/              # Game contract interactions
│   ├── react/                 # React hooks and components
│   ├── torii/                 # Onchain data querying
│   └── types/                 # Shared type definitions
├── config/                    # Configuration & deployment scripts
└── docs/                      # Architecture notes & internal docs
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Blockchain | [Starknet](https://starknet.io) (Cairo) |
| Game Engine | [Dojo](https://dojoengine.org) v1.0.4 |
| Frontend | React, Vite, Three.js |
| Onchain Queries | [Torii](https://book.dojoengine.org/toolchain/torii) |
| Account Abstraction | [Cartridge Controller](https://cartridge.gg) |
| Package Manager | pnpm + Bun |

## Getting Started

### Prerequisites

- [Dojo](https://book.dojoengine.org) v1.0.4
- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) v9.12.3
- [Bun](https://bun.sh/)

### Setup

```bash
# 1. Install Dojo
curl -L https://install.dojoengine.org | bash

# 2. Install pnpm
npm install -g pnpm

# 3. Clone and install
git clone https://github.com/BibliothecaDAO/eternum.git
cd eternum
pnpm install

# 4. Build shared packages
pnpm run build:packages

# 5. Start development server
pnpm dev
```

### Common Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start game dev server |
| `pnpm dev:docs` | Start docs dev server (Vocs) |
| `pnpm build:packages` | Build shared packages |

### Running Contracts Locally

See the [Dojo book](https://book.dojoengine.org) for running a local Katana node and deploying contracts with Sozo.

```bash
cd contracts
sozo build
sozo migrate
```

## Contributing

We welcome contributions! See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for guidelines.

Key entry points for developers:
- **Contracts** → [`contracts/`](./contracts) — Cairo game logic
- **SDK** → [`packages/`](./packages) — shared libraries ([package docs](./packages/README.md))
- **Game Client** → [`client/apps/game/`](./client/apps/game) — React/Three.js frontend
- **Architecture** → [`docs/`](./docs) — internal design notes

## Links

| | |
|---|---|
| 🎮 **Play** | [eternum.realms.world](https://eternum.realms.world) |
| 📖 **Docs** | [docs.realms.world](https://docs.realms.world) |
| 🌐 **Realms World** | [realms.world](https://realms.world) |
| 💬 **Discord** | [discord.gg/realmsworld](https://discord.gg/realmsworld) |
| 🐦 **Twitter** | [@lootrealms](https://twitter.com/lootrealms) |
| 🏛️ **BibliothecaDAO** | [@BibliothecaDAO](https://twitter.com/BibliothecaDAO) |

## License

MIT
