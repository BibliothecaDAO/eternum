# Game App

This is the main game application for Eternum, built with React, TypeScript, and Vite.

## Running Locally

The client targets the self-hosted Madara appchain (see `deploy/madara-lab/README.md`). The committed `.env` points
`pnpm run dev` at the live lab chain, identity, Herald and launch endpoints, so a fresh clone needs no env setup.
Personal overrides go in `.env.local` (gitignored) and always win over `.env`.

`.env.production` is the committed config the `deploy-client.yml` workflow builds tester releases from (Blitz only in
phase 2).

## 🏗️ Architecture of the game

```
src/ui/
├── design-system/
│   ├── atoms/           # Basic UI components (button, input, select, tabs, etc.)
│   └── molecules/       # Composite components (tooltips, resource icons, etc.)
├── features/            # Domain-driven feature modules
│   ├── economy/
│   │   ├── banking/     # Liquidity, swaps, bank operations
│   │   ├── resources/   # Resource management, transfers, inventory
│   │   └── trading/     # Market orders, trading history, transfers
│   ├── military/
│   │   ├── battle/      # Combat system, raids, attack containers
│   │   └── components/  # Army management, battle logs, defense
│   ├── world/
│   │   └── components/  # Map entities, hyperstructures, battles
│   ├── settlement/
│   │   ├── components/  # Settlement canvas, minimap, controls
│   │   ├── construction/# Building preview
│   │   └── production/  # Production controls, labor, resources
│   ├── social/
│   │   ├── chat/        # Real-time chat system with Socket.io
│   │   ├── guilds/      # Guild management system
│   │   └── player/      # Player lists and panels
│   ├── progression/
│   │   ├── hints/       # Tutorial/hint system
│   │   ├── onboarding/  # New user onboarding
│   │   └── quests/      # Quest system
│   └── infrastructure/
│       ├── automation/  # Automation tables and transfers
│       └── bridge/      # Blockchain bridge functionality
├── layouts/             # Page layouts (world, onboarding, etc.)
├── modules/             # Feature modules (settings, combat simulation, etc.)
├── shared/              # Cross-feature shared components
│   ├── components/      # Shared UI components
│   └── containers/      # Layout containers
└── utils/               # UI utilities
```

Last updated: 2026-03-03.
