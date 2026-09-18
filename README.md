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

**An open-source, fully onchain strategy game built with native Cairo contracts on a self-hosted
[Madara](https://github.com/madara-alliance/madara) appchain.**

Conquer hex territories. Harvest resources. Build armies. Forge alliances. Win seasons.

[Play Now](https://eternum.realms.world) · [Documentation](https://docs.realms.world) ·
[Discord](https://discord.gg/realmsworld) · [Twitter](https://twitter.com/lootrealms)

</div>

---

## What is Eternum?

Eternum is the foundational game of the [Realms World](https://realms.world) ecosystem — a fully onchain strategy game
where every action lives on Starknet. You claim Realms, manage resources across a hex-based world map, raise armies,
trade with other players, and compete in seasonal competitions for $LORDS tokens.

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
├── apps/
│   ├── game/                  # Game client (React + Three.js)
│   ├── realms/                # Realms web app: sign-in, lobby, profile
│   ├── herald/                # Block folding, snapshots and diff streams for the client
│   ├── launch-service/        # Box-native game launch and rotation service
│   ├── web/                   # realms.world website
│   └── game-docs/             # Player documentation site (Vocs)
├── contracts/
│   ├── l3/                    # Native game domains and registry (Cairo) on the Madara appchain
│   └── l2/                    # Ledger, tokens and collectibles on Starknet
├── packages/                  # Shared libraries & SDK (core, provider, react, types, chain, identity)
├── config/                    # Balance presets, deployer and launch configs
├── deploy/madara-lab/         # Self-hosted chain and box infrastructure
└── docs/                      # Architecture notes and implementation briefs
```

## Tech Stack

| Layer           | Tech                                                                             |
| --------------- | -------------------------------------------------------------------------------- |
| Blockchain      | [Starknet](https://starknet.io) L2 plus a self-hosted Madara L3 appchain (Cairo) |
| Game Engine     | Native Cairo domains with recorded randomness                                    |
| Frontend        | React, Vite, Three.js                                                            |
| Chain reads     | Herald (`apps/herald`): folded blocks, snapshots and ordered diffs               |
| Accounts        | Gameplay accounts on the L3, bound to a Sign-in-with-Starknet identity           |
| Package Manager | pnpm + Bun                                                                       |

## Getting Started

### Prerequisites

- Scarb and Foundry pinned in `contracts/l3/world-native/.tool-versions`
- [Node.js](https://nodejs.org/) v20.19+
- [pnpm](https://pnpm.io/) v10.25
- [Bun](https://bun.sh/)

### Setup

```bash
# Clone and install workspace dependencies
git clone https://github.com/BibliothecaDAO/eternum.git
cd eternum
pnpm install --frozen-lockfile

# Install native tools without changing another workspace's toolchain
bash deploy/madara-lab/scripts/install-native-tools.sh "$HOME/.local/share/eternum-native-tools"
source "$HOME/.local/share/eternum-native-tools/env"

pnpm run build:packages
# Select the isolated native manifest and admission endpoint before starting the client.
pnpm dev
```

### Common Commands

| Command               | Description                  |
| --------------------- | ---------------------------- |
| `pnpm dev`            | Start game dev server        |
| `pnpm dev:docs`       | Start docs dev server (Vocs) |
| `pnpm build:packages` | Build shared packages        |

### Running Contracts Locally

The game domains live in `contracts/l3/world-native`. Scarb compiles them; isolated deployment and validation are
covered in [`deploy/madara-lab/README.md`](./deploy/madara-lab/README.md).

```bash
cd contracts/l3/world-native
scarb build
scarb test
```

## Contributing

We welcome contributions! See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for guidelines.

Key entry points for developers:

- **Contracts** → [`contracts/`](./contracts) — Cairo game logic
- **SDK** → [`packages/`](./packages) — shared libraries ([package docs](./packages/README.md))
- **Game Client** → [`apps/game/`](./apps/game) — React/Three.js frontend
- **Architecture** → [`docs/`](./docs) — internal design notes

## Links

|                       |                                                          |
| --------------------- | -------------------------------------------------------- |
| 🎮 **Play**           | [eternum.realms.world](https://eternum.realms.world)     |
| 📖 **Docs**           | [docs.realms.world](https://docs.realms.world)           |
| 🌐 **Realms World**   | [realms.world](https://realms.world)                     |
| 💬 **Discord**        | [discord.gg/realmsworld](https://discord.gg/realmsworld) |
| 🐦 **Twitter**        | [@lootrealms](https://twitter.com/lootrealms)            |
| 🏛️ **BibliothecaDAO** | [@BibliothecaDAO](https://twitter.com/BibliothecaDAO)    |

## License

MIT
