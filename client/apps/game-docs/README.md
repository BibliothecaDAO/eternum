# Game Documentation

The official documentation site for Eternum, built with Vocs - a React-based documentation framework.

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

The documentation site follows a structured organization to provide clear and accessible game information:

```
game-docs/
├── docs/
│   ├── pages/               # Documentation content
│   │   ├── development/     # Developer guides
│   │   │   ├── client.mdx   # Client development guide
│   │   │   ├── contracts.mdx # Smart contract documentation
│   │   │   ├── sdk.mdx      # SDK usage guide
│   │   │   └── llm.mdx      # LLM integration docs
│   │   ├── mechanics/       # Game mechanics documentation
│   │   │   ├── achievements.mdx
│   │   │   ├── agents.mdx
│   │   │   ├── tribes.mdx
│   │   │   └── world-structures.mdx
│   │   └── overview/        # General game information
│   │       ├── introduction.mdx
│   │       ├── bridging.mdx
│   │       └── world-physics.mdx
│   ├── components/          # React components for documentation
│   │   ├── BiomeCombat.tsx  # Combat mechanics by biome
│   │   ├── BuildingCosts.tsx # Building cost tables
│   │   ├── ResourceTable.tsx # Resource information
│   │   └── [other game data components]
│   └── utils/               # Utilities and constants
│       ├── resources.ts     # Resource definitions
│       ├── constants.ts     # Game constants
│       └── formatting.ts    # Display formatting utilities
├── vocs.config.ts           # Vocs configuration
└── vite-plugin-llm-txt.mjs  # Plugin for LLM documentation generation
```

### Key Components

- **Documentation Pages (MDX)**: Written in MDX format, allowing for interactive React components within markdown
- **Interactive Components**: React components that display game data dynamically (building costs, resource tables,
  etc.)
- **Vocs Framework**: Provides navigation, search, and theming capabilities
- **LLM Integration**: Custom Vite plugin that generates documentation for AI/LLM consumption

### Documentation Structure

The documentation is organized into three main sections:

1. **Overview**: General game information, getting started guides, and world mechanics
2. **Mechanics**: Detailed explanations of game systems (combat, achievements, tribes, etc.)
3. **Development**: Technical documentation for developers building on Eternum

### Building and Deployment

The documentation site is built as a static site that can be deployed to any static hosting service. The build process
includes:

- MDX compilation
- Component bundling
- Static site generation
- Search index creation