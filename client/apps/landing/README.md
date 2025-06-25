# Landing Page & NFT Marketplace

The official landing page and NFT marketplace for Eternum, featuring realm NFTs, season passes, and game entry points.

## Getting Started

To install dependencies:

```bash
pnpm install
```

To run the development server:

```bash
pnpm run dev
```

To build for production:

```bash
pnpm run build
```

## Architecture

The landing page is built with React, TypeScript, Vite, and TanStack Router, providing a modern web experience for NFT
trading and game entry:

```
landing/
├── src/
│   ├── routes/              # TanStack Router pages
│   │   ├── __root.tsx       # Root layout with navigation
│   │   ├── index.lazy.tsx   # Homepage
│   │   ├── claim.lazy.tsx   # NFT claiming interface
│   │   ├── data.lazy.tsx    # Game data and statistics
│   │   ├── mint.lazy.tsx    # Minting interface
│   │   └── trade/           # Trading routes
│   │       ├── index.lazy.tsx    # Marketplace main page
│   │       └── activity.lazy.tsx # Trading activity feed
│   ├── components/          # UI components
│   │   ├── layouts/         # Page layouts
│   │   │   └── dashboard-layout.tsx
│   │   ├── modules/         # Feature-specific components
│   │   │   ├── realm-card.tsx              # Realm NFT display
│   │   │   ├── token-card.tsx              # Generic token display
│   │   │   ├── collection-card.tsx         # Collection overview
│   │   │   ├── marketplace-*.tsx           # Marketplace components
│   │   │   ├── season-pass-mint-dialog.tsx # Season pass minting
│   │   │   └── realm-mint-dialog.tsx       # Realm minting
│   │   ├── providers/       # Context providers
│   │   │   ├── starknet-provider.tsx # Blockchain connection
│   │   │   └── theme-provider.tsx    # Theme management
│   │   └── ui/              # shadcn/ui components
│   ├── hooks/               # Custom hooks
│   │   ├── gql/             # GraphQL generated types
│   │   ├── query/           # Query hooks
│   │   ├── use-marketplace.tsx     # Marketplace operations
│   │   ├── use-lords.tsx          # Lords token interactions
│   │   └── use-mint-*.tsx         # Minting operations
│   ├── abi/                 # Smart contract interfaces
│   │   ├── Lords.ts         # Lords token contract
│   │   └── SeasonPass.ts    # Season pass contract
│   └── assets/              # Static resources
│       └── icons/           # SVG icons and graphics
```

### Key Features

- **NFT Marketplace**: Full-featured marketplace for trading Eternum NFTs

  - Realm NFTs with detailed attributes
  - Season passes for game access
  - Listing creation and management
  - Sweep buying functionality
  - Activity feed and trading history

- **Minting Interface**: Direct minting for new NFTs

  - Realm minting with randomized attributes
  - Season pass purchases
  - Test realm creation for development

- **Game Entry**: Multiple entry points to the game

  - Direct launch from owned NFTs
  - Season pass validation
  - Controller wallet connection

- **Data Dashboard**: Game statistics and leaderboards
  - Player rankings
  - Economic metrics
  - Collection statistics

### Technology Stack

- **Frontend Framework**: React 18 with TypeScript
- **Routing**: TanStack Router for type-safe routing
- **Styling**: Tailwind CSS with shadcn/ui components
- **Blockchain**: StarkNet integration with starknet-react
- **GraphQL**: Type-safe queries with generated types
- **State Management**: React hooks and context
- **Build Tool**: Vite for fast development and optimized builds

### Smart Contract Integration

The app integrates with several on-chain contracts:

- **Lords Token**: ERC-20 token for in-game currency
- **Season Pass**: NFT collection for game access
- **Realm NFTs**: The main game assets
- **Marketplace**: On-chain trading logic

### Environment Configuration

Configure the following in your `.env` file:

- `VITE_PUBLIC_GRAPHQL_ENDPOINT`: GraphQL API endpoint
- `VITE_PUBLIC_NODE_URL`: StarkNet RPC endpoint
- `VITE_PUBLIC_TORII`: Torii indexer endpoint
- Additional blockchain and API configurations
