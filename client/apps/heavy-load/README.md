# Heavy Load

A load testing and performance benchmarking tool for Eternum, designed to simulate large-scale game interactions and
stress test the system.

## Getting Started

To install dependencies:

```bash
bun install
```

To run:

```bash
1. pnpm contract:start:local
2. bun --env-file=../game/.env.local run index.ts
```

## Architecture

The heavy-load tool is built to simulate realistic game scenarios with multiple concurrent players and complex
interactions:

```
heavy-load/
├── index.ts                 # Main entry point and orchestration
├── src/
│   ├── config.ts            # Configuration settings and parameters
│   ├── lords-process.ts     # Lords token management and transactions
│   ├── queries.ts           # GraphQL/Torii query definitions
│   ├── system-calls.ts      # Game system interactions
│   ├── utils.ts             # Utility functions and helpers
│   ├── worker-process.ts    # Multi-threaded worker implementation
│   ├── worker-steps.ts      # Sequential workflow steps for workers
│   └── world-population.ts  # World state generation and population
└── tsconfig.json            # TypeScript configuration
```

### Key Components

- **Worker Process System**: Multi-threaded architecture using worker threads to simulate concurrent players
- **World Population**: Generates realistic game world states with settlements, armies, and resources
- **Lords Process**: Handles Lords token operations for testing economic mechanics
- **System Calls**: Simulates all major game actions (building, trading, combat, etc.)
- **Query System**: Tests read performance with various query patterns

### Features

- **Concurrent User Simulation**: Spawn multiple worker threads to simulate many players simultaneously
- **Realistic Game Patterns**: Workers follow realistic gameplay patterns including:
  - Settlement creation and management
  - Resource production and trading
  - Army creation and movement
  - Combat interactions
- **Performance Metrics**: Tracks transaction throughput, latency, and system resource usage
- **Configurable Load Scenarios**: Adjust number of workers, action frequency, and test duration

### Test Scenarios

The tool can simulate various load scenarios:

- **Settlement Rush**: Many players creating settlements simultaneously
- **Trading Volume**: High-frequency market transactions
- **Combat Stress**: Large-scale battles with many armies
- **Mixed Gameplay**: Realistic mix of all game activities

### Configuration

Load test parameters can be configured in `config.ts` including:

- Number of worker threads
- Action intervals
- Test duration
- Target endpoints
