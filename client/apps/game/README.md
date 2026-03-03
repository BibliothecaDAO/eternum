# Game App

This is the main game application for Eternum, built with React, TypeScript, and Vite.

## Running Locally

To start the game locally:

1. Make a copy of `.env.local.sample` and rename it to `.env.local`
2. Update the following environment variables in `.env.local` based on your target environment:
   - `VITE_PUBLIC_TORII="http://127.0.0.1:8080"`
   - `VITE_PUBLIC_NODE_URL="http://127.0.0.1:5050"`
3. Run `pnpm run dev` to start the development server

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
