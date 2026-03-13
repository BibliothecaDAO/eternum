# @bibliothecadao/client — PRD & Technical Design

## 1. Product Overview

### 1.1 Problem

Eternum's SDK is split across 5+ packages (`provider`, `types`, `torii`, `core`, `dojo`, `react`) that are tightly
coupled to React and RECS. To interact with Eternum programmatically — for bots, agents, analytics dashboards, CLI
tools, or custom UIs — developers must manually wire all packages together, understand their initialization order, and
pull in heavy browser/UI dependencies.

### 1.2 Solution

`@bibliothecadao/client` — a single, headless TypeScript package that exposes Eternum as a stateless client. No RECS, no
React, no sync engine. Just views (read) and transactions (write).

```typescript
const client = await EternumClient.create({
  rpcUrl: "https://rpc.cartridge.gg/starknet/eternum",
  toriiUrl: "https://torii.eternum.gg",
  worldAddress: "0x...",
  manifest: gameManifest,
});

client.connect(account);

// Read — one call returns everything about a realm
const realm = await client.view.realm(myRealmId);

// Write — grouped by domain
await client.trade.createOrder(account, { ... });
```

### 1.3 Target Users

| User              | Use Case                                                    |
| ----------------- | ----------------------------------------------------------- |
| AI agents         | Autonomous gameplay: observe via views, decide, execute txs |
| Bot developers    | Automated trading, resource management, combat              |
| Analytics tools   | Read-only dashboards, leaderboard trackers                  |
| Mobile/custom UIs | Use views as data layer, render with any framework          |
| CLI tools         | Script game actions from terminal                           |
| Integration tests | Headless test harness for contract development              |

### 1.4 Non-Goals

- No React hooks (stays in `@bibliothecadao/react`)
- No 3D rendering
- No wallet connector UI
- No RECS / reactive entity system
- No persistent sync engine or in-memory world state
- Does NOT replace existing packages — composes them

---

## 2. Architecture

### 2.1 Dependency Graph

```
@bibliothecadao/client (NEW)
├── @bibliothecadao/provider    — Transaction execution, batching, events
├── @bibliothecadao/torii       — SQL queries, Torii client queries, parsers
├── @bibliothecadao/types       — Props interfaces, constants, enums
└── @bibliothecadao/eternum     — ConfigManager, CombatSimulator, MarketManager, StaminaManager
    ├── @bibliothecadao/provider
    ├── @bibliothecadao/torii
    └── @bibliothecadao/types
```

**NOT** depended on:

- `@bibliothecadao/dojo` (RECS wiring, setup orchestration — skipped entirely)
- `@bibliothecadao/react` (React hooks — consumer layer)
- `@dojoengine/recs`, `@dojoengine/sdk`, `@dojoengine/state` (reactive UI primitives)

### 2.2 Core Design: Stateless Views

The client is **stateless**. There is no in-memory world. Each `view.*()` call queries Torii, computes derived values,
and returns a fully-hydrated object. A simple TTL cache prevents redundant network calls within the same tick.

```
Agent tick loop:
  1. client.view.realm(id)     →  SQL query  →  compute  →  RealmView
  2. client.view.market()      →  SQL query  →  compute  →  MarketView
  3. Agent logic (pure functions over view data)
  4. client.trade.createOrder(...)  →  EternumProvider  →  tx hash
```

### 2.3 Package Structure

```
packages/client/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── src/
│   ├── index.ts                     # Public API exports
│   ├── client.ts                    # EternumClient class
│   ├── config.ts                    # EternumClientConfig type
│   ├── cache.ts                     # ViewCache (TTL map)
│   │
│   ├── views/                       # View builders (read layer)
│   │   ├── index.ts                 # ViewClient class
│   │   ├── realm.ts                 # RealmView builder
│   │   ├── explorer.ts              # ExplorerView builder
│   │   ├── map-area.ts              # MapAreaView builder
│   │   ├── market.ts                # MarketView builder
│   │   ├── player.ts                # PlayerView builder
│   │   ├── hyperstructure.ts        # HyperstructureView builder
│   │   ├── leaderboard.ts           # LeaderboardView builder
│   │   ├── bank.ts                  # BankView builder
│   │   └── events.ts                # EventsView builder
│   │
│   ├── transactions/                # Transaction methods (write layer)
│   │   ├── index.ts                 # TransactionClient grouping
│   │   ├── resources.ts             # Resource transfers, burns, claims
│   │   ├── troops.ts                # Explorer/guard management
│   │   ├── combat.ts                # Attack, raid
│   │   ├── trade.ts                 # Orders (create, accept, cancel)
│   │   ├── buildings.ts             # Create, destroy, pause, resume
│   │   ├── bank.ts                  # AMM swap, liquidity
│   │   ├── hyperstructure.ts        # Contribute, allocate, initialize
│   │   ├── guild.ts                 # Create, join, leave, whitelist
│   │   └── realm.ts                 # Upgrade, settle, village
│   │
│   ├── compute/                     # Pure computation functions (no IO)
│   │   ├── resources.ts             # Production rates, depletion, storage
│   │   ├── combat.ts                # Battle sim, raid sim, strength
│   │   ├── market.ts                # AMM pricing, slippage, quotes
│   │   ├── stamina.ts               # Regen with boosts
│   │   ├── buildings.ts             # Costs with scaling, population
│   │   └── movement.ts              # Travel time, distance, stamina cost
│   │
│   └── types/                       # View return types
│       ├── views.ts                 # All view interfaces
│       ├── common.ts                # Shared sub-types
│       └── config.ts                # Config sub-types per view
│
└── tests/
    ├── client.test.ts               # Integration: client creation
    ├── cache.test.ts                # Unit: cache TTL behavior
    ├── views/
    │   ├── realm.test.ts            # Unit: realm view builder
    │   ├── explorer.test.ts         # Unit: explorer view builder
    │   ├── map-area.test.ts         # Unit: map area view builder
    │   ├── market.test.ts           # Unit: market view builder
    │   ├── player.test.ts           # Unit: player view builder
    │   ├── hyperstructure.test.ts   # Unit: hyperstructure view builder
    │   ├── leaderboard.test.ts      # Unit: leaderboard view builder
    │   └── bank.test.ts             # Unit: bank view builder
    ├── compute/
    │   ├── resources.test.ts        # Unit: resource computations
    │   ├── combat.test.ts           # Unit: combat simulator
    │   ├── market.test.ts           # Unit: AMM math
    │   ├── stamina.test.ts          # Unit: stamina regen
    │   └── buildings.test.ts        # Unit: cost scaling
    └── transactions/
        └── grouping.test.ts         # Unit: tx method delegation
```

---

## 3. Public API Specification

### 3.1 Client Lifecycle

```typescript
// --- Creation ---
interface EternumClientConfig {
  rpcUrl: string; // Starknet RPC endpoint
  toriiUrl: string; // Torii SQL API base URL
  worldAddress: string; // Eternum world contract address
  manifest: any; // Dojo manifest (contract addresses)
  cacheUrl?: string; // Optional cache server for heavy queries
  cacheTtlMs?: number; // View cache TTL (default: 5000ms)
}

class EternumClient {
  // Factory — initializes provider, SqlApi, ConfigManager
  static async create(config: EternumClientConfig): Promise<EternumClient>;

  // Connect an account for transactions
  connect(account: Account | AccountInterface): void;

  // Disconnect account
  disconnect(): void;

  // Check if account is connected
  get isConnected(): boolean;

  // Direct access to underlying pieces (escape hatch)
  get provider(): EternumProvider;
  get sql(): SqlApi;
  get config(): ClientConfigManager;
  get cache(): ViewCache;

  // Views (read)
  readonly view: ViewClient;

  // Transactions (write) — grouped by domain
  readonly resources: ResourceTransactions;
  readonly troops: TroopTransactions;
  readonly combat: CombatTransactions;
  readonly trade: TradeTransactions;
  readonly buildings: BuildingTransactions;
  readonly bank: BankTransactions;
  readonly hyperstructure: HyperstructureTransactions;
  readonly guild: GuildTransactions;
  readonly realm: RealmTransactions;

  // Transaction lifecycle events
  on(event: "transactionSubmitted", cb: (info: TxSubmittedInfo) => void): () => void;
  on(event: "transactionComplete", cb: (info: TxCompleteInfo) => void): () => void;
  on(event: "transactionFailed", cb: (info: TxFailedInfo) => void): () => void;
  on(event: "transactionPending", cb: (info: TxPendingInfo) => void): () => void;
}
```

### 3.2 View Client

```typescript
class ViewClient {
  realm(entityId: ID): Promise<RealmView>;
  explorer(entityId: ID): Promise<ExplorerView>;
  mapArea(opts: { x: number; y: number; radius: number }): Promise<MapAreaView>;
  market(resourceType?: ResourcesIds): Promise<MarketView>;
  player(address: ContractAddress): Promise<PlayerView>;
  hyperstructure(entityId: ID): Promise<HyperstructureView>;
  leaderboard(opts?: { limit?: number; offset?: number }): Promise<LeaderboardView>;
  bank(bankEntityId: ID): Promise<BankView>;
  events(opts?: {
    entityId?: ID;
    owner?: string;
    since?: number;
    limit?: number;
    offset?: number;
  }): Promise<EventsView>;
}
```

---

## 4. View Specifications

### 4.1 RealmView

**Purpose:** Everything an agent needs to manage a realm — resources, production, buildings, defense, armies, trade,
arrivals.

**Data sources:**

- `getStructureFromToriiClient(entityId)` → structure + resources + production boosts
- `fetchGuardsByStructure(entityId)` → guard slot data
- `fetchAllArmiesMapData()` filtered by owner structure → explorers
- ConfigManager → costs, limits, tick rates

```typescript
interface RealmView {
  // --- Identity ---
  entityId: ID;
  realmId: number; // Realm number (1-8000)
  name: string; // Player-set name or default
  owner: ContractAddress;
  ownerName: string;
  order: number; // Realm order (0-16, e.g. "Giants")
  orderName: string; // "Giants", "Titans", etc.
  position: Position; // { x, y }
  level: number; // 0=Settlement, 1=City, 2=Kingdom, 3=Empire
  levelName: string; // "Settlement", "City", etc.
  category: StructureType; // Always StructureType.Realm
  hasWonder: boolean;
  villageCount: number;

  // --- Resources (all resources with computed balances) ---
  resources: ResourceState[];

  // --- Storage ---
  storage: {
    capacityKg: number; // Total storage (storehouses * capacity)
    usedKg: number; // Current usage
    freeKg: number; // capacityKg - usedKg
    storehouseCount: number;
  };

  // --- Active Productions ---
  productions: ProductionState[]; // Only resources being produced

  // --- Buildings ---
  buildings: BuildingState[];
  buildableSlots: number; // Remaining hex slots (level-based: 6/18/36/60)
  totalBuildings: number;

  // --- Population ---
  population: {
    current: number;
    capacity: number; // Base + workers huts
    free: number; // capacity - current
  };

  // --- Defense (4 guard slots) ---
  guards: GuardState[];

  // --- Explorers (armies spawned from this realm) ---
  explorers: ExplorerSummary[];

  // --- Incoming Arrivals (donkey caravans) ---
  arrivals: ArrivalState[];

  // --- Active Trade Orders ---
  orders: TradeOrderState[];

  // --- Applied Relics ---
  relics: RelicState[];

  // --- Battle Status ---
  battle: {
    isImmune: boolean;
    immunityEndsAt: number | null; // Unix timestamp (null if not immune)
    immunityRemainingSeconds: number; // Computed, 0 if not immune
    lastAttack: BattleReference | null;
    lastDefense: BattleReference | null;
  };

  // --- Relevant Config for Agent Decisions ---
  config: {
    upgradeCost: ResourceCost[] | null; // null if at max level
    nextLevel: number | null; // null if at max
    maxLevel: number;
    maxGuardSlots: number;
    maxExplorerSlots: number;
    nearestBank: {
      entityId: ID;
      position: Position;
      distance: number;
      travelTimeMinutes: number;
    } | null;
    buildingCosts: Record<BuildingType, ResourceCost[]>; // All building costs at current scale
    wonderBonus: { active: boolean; bonusPercent: number }; // Nearby wonder buff
  };
}
```

**Sub-types:**

```typescript
interface ResourceState {
  resourceId: ResourcesIds;
  name: string; // "Wood", "Stone", etc.
  tier: string; // "common", "uncommon", "rare", etc.
  balance: number; // Human-readable (divided by PRECISION)
  rawBalance: bigint; // Raw on-chain value

  production: {
    rate: number; // Per second (human-readable)
    ratePerTick: number; // Per game tick
    buildingCount: number;
    isActive: boolean;
    isPaused: boolean;
    outputRemaining: number; // Remaining producible amount
    timeRemainingSeconds: number; // Until production exhausted (Infinity for food)
    depletesAt: number | null; // Unix timestamp, null for food/inactive
    inputs: ResourceCost[]; // What this production consumes
  } | null; // null if not producing

  atMaxCapacity: boolean; // Storage full for this resource
  weightKg: number; // Weight per unit in kg
}

interface ProductionState {
  resourceId: ResourcesIds;
  name: string;
  rate: number; // Per second (human-readable)
  buildingCount: number;
  isActive: boolean;
  outputRemaining: number;
  timeRemainingSeconds: number;
  inputs: ResourceCost[];
}

interface BuildingState {
  type: BuildingType;
  name: string; // "Farm", "Barracks", etc.
  coord: { x: number; y: number };
  paused: boolean;
  produces: ResourcesIds | null;
  populationCost: number;
}

interface GuardState {
  slot: number; // 0-3
  slotName: string; // "Alpha", "Bravo", "Charlie", "Delta"
  isEmpty: boolean;

  troops: {
    category: string; // "Knight", "Paladin", "Crossbowman"
    tier: string; // "T1", "T2", "T3"
    count: number; // Human-readable
  } | null;

  stamina: {
    current: number; // Computed with regen + boosts
    max: number;
  } | null;

  isOnCooldown: boolean;
  cooldownEndsAt: number | null; // Unix timestamp
  destroyedTick: number;
  resurrectionCooldownEndsAt: number | null;

  // Combat effectiveness
  strength: number; // Relative combat power (computed)
}

interface ExplorerSummary {
  entityId: ID;
  position: Position;
  troops: { category: string; tier: string; count: number };
  stamina: { current: number; max: number };
  isHome: boolean; // Adjacent to this realm
  isOnCooldown: boolean;
  carryingKg: number;
  capacityKg: number;
  freeCapacityKg: number;
}

interface ArrivalState {
  fromEntityId: ID;
  resources: ResourceCost[];
  arrivesAt: number; // Unix timestamp
  arrivesInSeconds: number; // Computed: arrivesAt - now (0 if arrived)
  hasArrived: boolean;
}

interface TradeOrderState {
  tradeId: ID;
  selling: { resourceId: ResourcesIds; name: string; amountPerUnit: number; maxUnits: number };
  asking: { resourceId: ResourcesIds; name: string; amountPerUnit: number };
  totalSellingAmount: number; // amountPerUnit * maxUnits
  totalAskingAmount: number; // amountPerUnit * maxUnits
  ratio: number; // asking / selling
  expiresAt: number;
  expiresInSeconds: number; // Computed
  isExpired: boolean;
  takerId: ID; // 0 = open to anyone
  isOpenOrder: boolean; // takerId === 0
}

interface RelicState {
  resourceId: ResourcesIds;
  name: string;
  effectDescription: string; // "+20% resource production rate"
  expiresAtTick: number | null;
  usagesLeft: number | null;
  isActive: boolean;
}

interface BattleReference {
  entityId: ID;
  position: Position | null;
  timestamp: number;
  timeSinceSeconds: number; // Computed: now - timestamp
}

interface ResourceCost {
  resourceId: ResourcesIds;
  name: string;
  amount: number;
}
```

### 4.2 ExplorerView

**Purpose:** Full state of a mobile army — troops, stamina, cargo, nearby entities, combat previews.

**Data sources:**

- `getExplorerFromToriiClient(entityId)` → troops + resources
- `fetchChestsNearPosition()` → nearby chests
- Tile queries for biome, nearby entities
- `CombatSimulator.simulateBattle()` for combat previews
- `StaminaManager.getStamina()` for live stamina

```typescript
interface ExplorerView {
  entityId: ID;
  owner: ContractAddress;
  ownerName: string;
  homeStructureId: ID;
  position: Position;

  troops: {
    category: string;
    tier: string;
    count: number;
    rawCount: bigint;
  };

  stamina: {
    current: number; // Computed with regen + boosts
    max: number;
    regenPerTick: number; // Base + boost
    ticksUntilFull: number;
    secondsUntilFull: number;
  };

  carrying: {
    resources: ResourceCost[];
    totalWeightKg: number;
    capacityKg: number;
    freeKg: number;
  };

  boosts: {
    damageDealt: { percentIncrease: number; endsTick: number; isActive: boolean } | null;
    damageReduction: { percentDecrease: number; endsTick: number; isActive: boolean } | null;
    staminaRegen: { percentIncrease: number; ticksRemaining: number; isActive: boolean } | null;
    exploreReward: { multiplier: number; endsTick: number; isActive: boolean } | null;
  };

  combat: {
    battleCooldownEndsAt: number | null;
    isOnCooldown: boolean;
    canAttack: boolean; // stamina >= threshold && !onCooldown
    strength: number; // Relative power rating (computed)
  };

  movement: {
    isHome: boolean; // Adjacent to home structure
    currentBiome: string;
    staminaCostToMove: number; // For current biome + troop type
    canMove: boolean; // stamina >= cost
    foodCostPerMove: { wheat: number; fish: number };
    foodCostPerExplore: { wheat: number; fish: number };
  };

  nearby: {
    structures: NearbyEntity[];
    armies: NearbyEntity[];
    chests: { position: Position; distance: number }[];
    unexploredTileCount: number;
  };

  recentBattles: {
    opponentEntityId: ID;
    opponentPosition: Position | null;
    timestamp: number;
    wasAttacker: boolean;
    won: boolean;
  }[];

  config: {
    minTroopsForBattle: number; // 100,000
    exploreStaminaCost: number;
    travelStaminaCost: number; // For current biome
    exploreReward: { resourceId: ResourcesIds; amount: number };
    biomeCombatBonus: number; // For current biome
  };
}

interface NearbyEntity {
  entityId: ID;
  position: Position;
  distance: number; // Hex distance
  owner: ContractAddress;
  ownerName: string;
  isMine: boolean;
  isBandit: boolean;
  type: "structure" | "army";

  structureType?: StructureType;
  level?: number;
  troops?: { category: string; tier: string; count: number };
  stamina?: { current: number; max: number };

  combatPreview: {
    estimatedDamageDealt: number; // Troops I would kill
    estimatedDamageTaken: number; // Troops I would lose
    winLikelihood: "certain" | "likely" | "even" | "unlikely" | "impossible";
    staminaCost: number;
  } | null; // null if friendly
}
```

### 4.3 MapAreaView

**Purpose:** Hex region snapshot — tiles, structures, armies, chests.

**Data sources:**

- `fetchTilesByCoords()` for tile biomes and occupancy
- `fetchAllStructuresMapData()` filtered to bounding box
- `fetchAllArmiesMapData()` filtered to bounding box
- `fetchChestsNearPosition()` for chests

```typescript
interface MapAreaView {
  center: Position;
  radius: number;

  tiles: TileState[];
  structures: MapStructure[];
  armies: MapArmy[];

  summary: {
    totalTiles: number;
    exploredTiles: number;
    unexploredTiles: number;
    myStructures: number;
    enemyStructures: number;
    myArmies: number;
    enemyArmies: number;
    banditArmies: number;
    chests: number;
  };
}

interface TileState {
  position: Position;
  biome: string; // BiomeType name
  isExplored: boolean;
  occupierType: "none" | "structure" | "army" | "chest";
  occupierId: ID | null;
}

interface MapStructure {
  entityId: ID;
  position: Position;
  type: StructureType;
  typeName: string; // "Realm", "Bank", etc.
  level: number;
  owner: ContractAddress;
  ownerName: string;
  isMine: boolean;
  realmId: number | null;

  guardStrength: {
    totalTroops: number;
    filledSlots: number;
    maxSlots: number;
  };

  activeProductions: ResourcesIds[];
  lastAttack: BattleReference | null;
  lastDefense: BattleReference | null;
}

interface MapArmy {
  entityId: ID;
  position: Position;
  owner: ContractAddress;
  ownerName: string;
  isMine: boolean;
  isBandit: boolean;
  homeStructureId: ID;

  troops: { category: string; tier: string; count: number };
  stamina: { current: number; max: number };
  isOnCooldown: boolean;

  lastAttack: BattleReference | null;
  lastDefense: BattleReference | null;
}
```

### 4.4 MarketView

**Purpose:** Full market state — AMM pools with computed prices/slippage, P2P orders, recent swaps.

**Data sources:**

- Torii client queries for Market model (per-resource pool reserves)
- `fetchSwapEvents()` for recent trades
- `MarketManager` for AMM computations
- ConfigManager for fee structure

```typescript
interface MarketView {
  pools: AmmPoolState[];
  orders: MarketOrder[];
  recentSwaps: SwapEvent[];
}

interface AmmPoolState {
  resourceId: ResourcesIds;
  name: string;

  reserves: {
    lords: number;
    resource: number;
  };

  price: {
    lordsPerResource: number;
    resourcePerLords: number;
  };

  quotes: {
    buy100: { lordsNeeded: number; slippagePercent: number };
    buy1000: { lordsNeeded: number; slippagePercent: number };
    buy10000: { lordsNeeded: number; slippagePercent: number };
    sell100: { lordsReceived: number; slippagePercent: number };
    sell1000: { lordsReceived: number; slippagePercent: number };
    sell10000: { lordsReceived: number; slippagePercent: number };
  };

  liquidity: {
    totalLiquidity: number; // sqrt(lords * resource)
    totalShares: number;
  };

  fees: {
    lpFeePercent: number;
    ownerFeePercent: number;
  };
}

interface MarketOrder {
  tradeId: ID;
  makerId: ID;
  makerAddress: ContractAddress;
  takerId: ID;
  isOpenOrder: boolean;

  selling: { resourceId: ResourcesIds; name: string; amountPerUnit: number; maxUnits: number };
  asking: { resourceId: ResourcesIds; name: string; amountPerUnit: number };

  ratio: number;
  expiresAt: number;
  expiresInSeconds: number;
  isExpired: boolean;

  ammComparison: number | null; // % better(+) or worse(-) than AMM spot price
}

interface SwapEvent {
  resourceId: ResourcesIds;
  name: string;
  isBuy: boolean;
  lordsAmount: number;
  resourceAmount: number;
  effectivePrice: number;
  trader: ContractAddress;
  timestamp: number;
}
```

### 4.5 PlayerView

**Purpose:** A player's entire portfolio — structures, armies, guild, aggregated resources, points.

**Data sources:**

- `fetchGlobalStructureExplorerAndGuildDetails()` filtered to player
- `fetchPlayerStructures(owner)` for structure details
- `fetchPlayerLeaderboard()` + shareholder points pipeline

```typescript
interface PlayerView {
  address: ContractAddress;
  name: string;

  structures: {
    realms: PlayerStructureSummary[];
    villages: PlayerStructureSummary[];
    hyperstructures: ID[];
    banks: ID[];
    mines: ID[];
    total: number;
  };

  armies: {
    explorers: PlayerArmySummary[];
    totalTroopCount: number;
  };

  guild: {
    guildId: ContractAddress;
    guildName: string;
  } | null;

  totalResources: AggregatedResource[];

  points: {
    registered: number;
    unregistered: number;
    total: number;
    rank: number | null;
    prizeClaimed: boolean;
    breakdown: {
      exploration: { points: number; count: number };
      relicChests: { points: number; count: number };
      hyperstructureBandits: { points: number; count: number };
      otherBandits: { points: number; count: number };
      hyperstructureShares: { points: number };
    };
  };
}

interface PlayerStructureSummary {
  entityId: ID;
  realmId: number | null;
  position: Position;
  level: number;
  hasWonder: boolean;
  category: StructureType;
}

interface PlayerArmySummary {
  entityId: ID;
  position: Position;
  homeStructureId: ID;
  troops: { category: string; tier: string; count: number };
  stamina: { current: number; max: number };
}

interface AggregatedResource {
  resourceId: ResourcesIds;
  name: string;
  totalBalance: number; // Sum across all structures
  totalProductionRate: number; // Net per second across all structures
}
```

### 4.6 HyperstructureView

**Data sources:**

- `getStructureFromToriiClient(entityId)` + Hyperstructure model
- `fetchHyperstructuresWithRealmCount()` for nearby realms
- `getHyperstructureTotalContributableAmounts()` for randomized requirements
- `getHyperstructureProgress()` for completion %

```typescript
interface HyperstructureView {
  entityId: ID;
  name: string; // Generated fantasy name
  position: Position;
  owner: ContractAddress;
  ownerName: string;

  status: {
    initialized: boolean;
    completed: boolean;
    access: "Public" | "Private" | "GuildOnly";
  };

  progress: {
    percentage: number; // 0-100
    currentTotal: number;
    neededTotal: number;
  };

  requirements: {
    resourceId: ResourcesIds;
    name: string;
    needed: number;
    contributed: number;
    remaining: number;
    percentComplete: number;
  }[];

  shareholders: {
    address: ContractAddress;
    name: string;
    percentage: number; // Basis points (0-10000)
    percentageDisplay: number; // 0-100
  }[];

  pointsMultiplier: number;
  nearbyRealmCount: number;

  guards: GuardState[];
  lastAttack: BattleReference | null;
  lastDefense: BattleReference | null;

  config: {
    pointsPerCycle: number;
    timeBetweenSharesChange: number;
    constructionCost: ResourceCost;
  };
}
```

### 4.7 LeaderboardView

```typescript
interface LeaderboardView {
  players: LeaderboardEntry[];
  totalPlayers: number;

  season: {
    startedAt: number;
    endsAt: number;
    timeRemainingSeconds: number;
    hasEnded: boolean;
    winner: ContractAddress | null;
  };

  hyperstructures: {
    created: number;
    completed: number;
    pointsPerSecond: number;
  };
}

interface LeaderboardEntry {
  rank: number;
  address: ContractAddress;
  name: string;
  registeredPoints: number;
  unregisteredPoints: number;
  totalPoints: number;
  prizeClaimed: boolean;
  breakdown: {
    exploration: { points: number; count: number };
    relicChests: { points: number; count: number };
    hyperstructureBandits: { points: number; count: number };
    otherBandits: { points: number; count: number };
    hyperstructureShares: { points: number };
  };
}
```

### 4.8 BankView

```typescript
interface BankView {
  entityId: ID;
  position: Position;
  owner: ContractAddress;

  pools: AmmPoolState[]; // Same as MarketView

  fees: {
    ownerSwapFeePercent: number;
    lpFeePercent: number;
  };

  myPositions: LpPosition[] | null; // null if no account connected
}

interface LpPosition {
  resourceId: ResourcesIds;
  name: string;
  shares: number;
  sharePercent: number;
  currentValue: { lords: number; resource: number };
  earnedFees: { lords: number; resource: number };
}
```

### 4.9 EventsView

```typescript
interface EventsView {
  events: GameEvent[];
  totalCount: number;
}

interface GameEvent {
  type: string; // Story type discriminator
  entityId: ID | null;
  owner: ContractAddress | null;
  timestamp: number;
  txHash: string;
  summary: string; // Human-readable: "Player X attacked Structure Y"
  data: Record<string, unknown>; // Raw story-specific fields
}
```

---

## 5. Transaction Specifications

All transaction methods follow the pattern:

```typescript
method(signer: Account | AccountInterface, props: MethodProps): Promise<void>
```

The `signer` is always the first arg. Methods delegate directly to `EternumProvider` methods, inheriting batching, event
emission, and telemetry.

### 5.1 Resource Transactions

```typescript
interface ResourceTransactions {
  send(
    signer,
    props: {
      fromStructureId: ID;
      toStructureId: ID;
      resources: ResourceCost[];
    },
  ): Promise<void>;

  pickup(
    signer,
    props: {
      recipientStructureId: ID;
      ownerStructureId: ID;
      resources: ResourceCost[];
    },
  ): Promise<void>;

  claimArrivals(
    signer,
    props: {
      structureId: ID;
      day: number;
      slot: number;
      resourceCount: number;
    },
  ): Promise<void>;

  approve(
    signer,
    props: {
      structureId: ID;
      recipientStructureId: ID;
      resources: ResourceCost[];
    },
  ): Promise<void>;

  transferBetweenExplorers(
    signer,
    props: {
      fromExplorerId: ID;
      toExplorerId: ID;
      resources: ResourceCost[];
    },
  ): Promise<void>;

  transferExplorerToStructure(
    signer,
    props: {
      fromExplorerId: ID;
      toStructureId: ID;
      resources: ResourceCost[];
    },
  ): Promise<void>;

  transferStructureToExplorer(
    signer,
    props: {
      fromStructureId: ID;
      toExplorerId: ID;
      resources: ResourceCost[];
    },
  ): Promise<void>;
}
```

### 5.2 Troop Transactions

```typescript
interface TroopTransactions {
  createExplorer(
    signer,
    props: {
      structureId: ID;
      category: TroopType;
      tier: TroopTier;
      count: number;
      direction: Direction;
    },
  ): Promise<void>;

  addToExplorer(
    signer,
    props: {
      explorerId: ID;
      count: number;
      homeDirection: Direction;
    },
  ): Promise<void>;

  deleteExplorer(signer, props: { explorerId: ID }): Promise<void>;

  addGuard(
    signer,
    props: {
      structureId: ID;
      slot: number;
      category: TroopType;
      tier: TroopTier;
      count: number;
    },
  ): Promise<void>;

  deleteGuard(
    signer,
    props: {
      structureId: ID;
      slot: number;
    },
  ): Promise<void>;

  move(
    signer,
    props: {
      explorerId: ID;
      directions: Direction[];
      explore: boolean;
    },
  ): Promise<void>;

  travel(
    signer,
    props: {
      explorerId: ID;
      directions: Direction[];
    },
  ): Promise<void>;

  explore(
    signer,
    props: {
      explorerId: ID;
      directions: Direction[];
    },
  ): Promise<void>;

  swapExplorerToExplorer(
    signer,
    props: {
      fromExplorerId: ID;
      toExplorerId: ID;
      direction: Direction;
      count: number;
    },
  ): Promise<void>;

  swapExplorerToGuard(
    signer,
    props: {
      fromExplorerId: ID;
      toStructureId: ID;
      direction: Direction;
      guardSlot: number;
      count: number;
    },
  ): Promise<void>;

  swapGuardToExplorer(
    signer,
    props: {
      fromStructureId: ID;
      guardSlot: number;
      toExplorerId: ID;
      direction: Direction;
      count: number;
    },
  ): Promise<void>;
}
```

### 5.3 Combat Transactions

```typescript
interface CombatTransactions {
  attackExplorer(
    signer,
    props: {
      aggressorId: ID;
      defenderId: ID;
      direction: Direction;
      stealResources: ResourceCost[];
    },
  ): Promise<void>;

  attackGuard(
    signer,
    props: {
      explorerId: ID;
      structureId: ID;
      direction: Direction;
    },
  ): Promise<void>;

  guardAttackExplorer(
    signer,
    props: {
      structureId: ID;
      guardSlot: number;
      explorerId: ID;
      direction: Direction;
    },
  ): Promise<void>;

  raid(
    signer,
    props: {
      explorerId: ID;
      structureId: ID;
      direction: Direction;
      stealResources: ResourceCost[];
    },
  ): Promise<void>;
}
```

### 5.4 Trade Transactions

```typescript
interface TradeTransactions {
  createOrder(
    signer,
    props: {
      makerId: ID;
      takerId?: ID; // 0 or omit for open order
      sellingResourceType: ResourcesIds;
      sellingAmountPerUnit: number;
      sellingMaxUnits: number;
      askingResourceType: ResourcesIds;
      askingAmountPerUnit: number;
      expiresAt: number;
    },
  ): Promise<void>;

  acceptOrder(
    signer,
    props: {
      takerId: ID;
      tradeId: ID;
      count: number;
    },
  ): Promise<void>;

  cancelOrder(
    signer,
    props: {
      tradeId: ID;
    },
  ): Promise<void>;
}
```

### 5.5 Building Transactions

```typescript
interface BuildingTransactions {
  create(
    signer,
    props: {
      structureId: ID;
      directions: Direction[];
      category: BuildingType;
      useSimpleCost: boolean;
    },
  ): Promise<void>;

  destroy(
    signer,
    props: {
      structureId: ID;
      buildingCoord: { x: number; y: number };
    },
  ): Promise<void>;

  pauseProduction(
    signer,
    props: {
      structureId: ID;
      buildingCoord: { x: number; y: number };
    },
  ): Promise<void>;

  resumeProduction(
    signer,
    props: {
      structureId: ID;
      buildingCoord: { x: number; y: number };
    },
  ): Promise<void>;
}
```

### 5.6 Bank Transactions

```typescript
interface BankTransactions {
  buy(
    signer,
    props: {
      bankEntityId: ID;
      entityId: ID;
      resourceType: ResourcesIds;
      amount: number;
    },
  ): Promise<void>;

  sell(
    signer,
    props: {
      bankEntityId: ID;
      entityId: ID;
      resourceType: ResourcesIds;
      amount: number;
    },
  ): Promise<void>;

  addLiquidity(
    signer,
    props: {
      bankEntityId: ID;
      entityId: ID;
      calls: any[]; // Liquidity add calls
    },
  ): Promise<void>;

  removeLiquidity(
    signer,
    props: {
      bankEntityId: ID;
      entityId: ID;
      resourceType: ResourcesIds;
      shares: number;
    },
  ): Promise<void>;
}
```

### 5.7 Hyperstructure Transactions

```typescript
interface HyperstructureTransactions {
  initialize(signer, props: { hyperstructureId: ID }): Promise<void>;

  contribute(
    signer,
    props: {
      hyperstructureId: ID;
      fromStructureId: ID;
      contributions: ResourceCost[];
    },
  ): Promise<void>;

  allocateShares(
    signer,
    props: {
      hyperstructureId: ID;
      shareholders: { address: ContractAddress; percentage: number }[];
    },
  ): Promise<void>;

  setAccess(
    signer,
    props: {
      hyperstructureId: ID;
      access: "Public" | "Private" | "GuildOnly";
    },
  ): Promise<void>;
}
```

### 5.8 Guild Transactions

```typescript
interface GuildTransactions {
  create(
    signer,
    props: {
      isPublic: boolean;
      name: string;
    },
  ): Promise<void>;

  join(signer, props: { guildId: ContractAddress }): Promise<void>;
  leave(signer): Promise<void>;

  updateWhitelist(
    signer,
    props: {
      address: ContractAddress;
      whitelisted: boolean;
    },
  ): Promise<void>;

  removeMember(signer, props: { address: ContractAddress }): Promise<void>;
  disband(signer): Promise<void>;
}
```

### 5.9 Realm Transactions

```typescript
interface RealmTransactions {
  upgrade(signer, props: { realmEntityId: ID }): Promise<void>;

  createVillage(
    signer,
    props: {
      villagePassTokenId: number;
      connectedRealmId: ID;
      direction: Direction;
      villagePassAddress: ContractAddress;
    },
  ): Promise<void>;

  setName(
    signer,
    props: {
      entityId: ID;
      name: string;
    },
  ): Promise<void>;

  setPlayerName(signer, props: { name: string }): Promise<void>;

  transferOwnership(
    signer,
    props: {
      structureId: ID;
      newOwner: ContractAddress;
    },
  ): Promise<void>;
}
```

---

## 6. Computation Module

Pure functions with no IO. All formulas extracted from existing managers/utils. Independently testable.

### 6.1 Resource Computations

```typescript
// Compute current balance factoring in production since last update
function computeBalance(params: {
  rawBalance: bigint;
  production: { rate: bigint; lastUpdatedAt: number; outputAmountLeft: bigint; buildingCount: number };
  currentTick: number;
  isFood: boolean;
  storageCapacityKg: number;
  storageUsedKg: number;
  resourceWeightKg: number;
}): {
  balance: number;
  atMaxCapacity: boolean;
  amountProduced: number;
};

// Time until production exhausted
function computeDepletionTime(params: {
  outputAmountLeft: bigint;
  productionRate: bigint;
  lastUpdatedAt: number;
  currentTick: number;
  tickIntervalSeconds: number;
  isFood: boolean;
}): {
  timeRemainingSeconds: number; // Infinity for food
  depletesAt: number | null; // Unix timestamp
};

// Net production rate (production - consumption)
function computeNetProductionRate(params: { productionRate: number; consumptionRate: number }): number;
```

### 6.2 Combat Computations

```typescript
// Full battle simulation
function simulateBattle(params: {
  attacker: CombatUnit;
  defender: CombatUnit;
  biome: string;
  currentTimestamp: number;
  attackerRelics: RelicBoosts;
  defenderRelics: RelicBoosts;
  config: CombatConfig;
}): {
  attackerDamage: number;
  defenderDamage: number;
  attackerStaminaCost: number;
  defenderStaminaCost: number;
  winLikelihood: string;
};

// Raid simulation
function simulateRaid(params: { raider: CombatUnit; defenders: CombatUnit[]; biome: string; config: CombatConfig }): {
  raiderDamageTaken: number;
  defenderDamageTaken: number;
  successChance: number;
  outcome: "Success" | "Failure" | "Chance";
};

// Relative combat strength rating (for quick comparison)
function computeStrength(troops: { category: string; tier: string; count: number }): number;
```

### 6.3 Market Computations

```typescript
// Uniswap-style constant product AMM
function computeOutputAmount(params: {
  inputAmount: number;
  inputReserve: number;
  outputReserve: number;
  feeNumerator: number;
  feeDenominator: number;
}): number;

// Slippage for a given trade size
function computeSlippage(params: {
  inputAmount: number;
  inputReserve: number;
  outputReserve: number;
  isBuy: boolean;
}): number; // Percentage

// Generate quotes at multiple amounts
function computeQuotes(
  pool: { lordsReserve: number; resourceReserve: number; feeNum: number; feeDenom: number },
  amounts: number[],
): { amount: number; cost: number; slippage: number }[];
```

### 6.4 Stamina Computations

```typescript
function computeStamina(params: {
  currentAmount: number;
  lastUpdateTick: number;
  currentTick: number;
  maxStamina: number;
  regenPerTick: number;
  boost?: { percent: number; ticksRemaining: number };
}): {
  current: number;
  max: number;
  ticksUntilFull: number;
};
```

### 6.5 Building Cost Computations

```typescript
// Building cost with quadratic scaling
function computeBuildingCost(params: {
  baseCosts: ResourceCost[];
  existingBuildingCount: number;
  costPercentIncrease: number; // From config
}): ResourceCost[];
```

---

## 7. Cache Specification

```typescript
class ViewCache {
  constructor(ttlMs: number = 5000);

  get<T>(key: string): T | null;
  set<T>(key: string, data: T): void;
  invalidate(key: string): void;
  invalidateAll(): void;
  invalidatePattern(pattern: string): void; // e.g. "realm:*"

  // Stats
  get size(): number;
  get hitRate(): number;
}
```

**Cache key conventions:** | View | Key Pattern | |------|-------------| | realm | `realm:{entityId}` | | explorer |
`explorer:{entityId}` | | mapArea | `mapArea:{x}:{y}:{radius}` | | market | `market` or `market:{resourceId}` | | player
| `player:{address}` | | hyperstructure | `hyperstructure:{entityId}` | | leaderboard | `leaderboard:{limit}:{offset}` |
| bank | `bank:{entityId}` | | events | `events:{hash(opts)}` |

**Cache invalidation after transactions:** When a transaction completes, the client automatically invalidates relevant
cache entries. E.g., after `trade.createOrder()`, invalidate `market*` and `realm:{makerId}`.

---

## 8. Implementation Plan (TDD)

### Phase 1: Foundation

**Files:** `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `src/index.ts`, `src/config.ts`,
`src/cache.ts`

**Tests first:**

- `tests/cache.test.ts` — TTL expiry, get/set, invalidation, pattern matching
- `tests/client.test.ts` — `EternumClient.create()` initialization, `connect()`/`disconnect()`

**Implementation:**

1. Create package with workspace dependencies
2. Implement `ViewCache` (pure, no deps)
3. Implement `EternumClient` shell — wires up `EternumProvider`, `SqlApi`, `ConfigManager`
4. Export public API from `src/index.ts`
5. Verify `pnpm --dir packages/client build` produces valid output

### Phase 2: Compute Module

**Files:** `src/compute/*.ts`

**Tests first:**

- `tests/compute/resources.test.ts` — balance with production, depletion time, net rate
- `tests/compute/combat.test.ts` — battle simulation, raid simulation, strength rating
- `tests/compute/market.test.ts` — output amount, slippage, quotes
- `tests/compute/stamina.test.ts` — regen, boosts, ticks until full
- `tests/compute/buildings.test.ts` — cost scaling with quadratic formula

**Implementation:**

1. Extract pure functions from existing managers/utils
2. Remove all RECS/component dependencies — accept plain data params
3. Validate against existing test cases (e.g., `stamina-manager.test.ts`)

### Phase 3: View Types

**Files:** `src/types/*.ts`

**No tests** (type-only, compile-time checked).

**Implementation:**

1. Define all view interfaces documented in Section 4
2. Define all sub-types (ResourceState, GuardState, etc.)
3. Ensure they compile with `--strict`

### Phase 4: Transaction Layer

**Files:** `src/transactions/*.ts`

**Tests first:**

- `tests/transactions/grouping.test.ts` — verify each domain method delegates to correct provider method with correct
  args

**Implementation:**

1. Create transaction group classes (ResourceTransactions, TroopTransactions, etc.)
2. Each method maps clean props → provider method props (adding signer)
3. No new logic — thin wrappers
4. Wire into `EternumClient`

### Phase 5: View Builders (Core)

**Files:** `src/views/realm.ts`, `src/views/explorer.ts`, `src/views/map-area.ts`

**Tests first:**

- `tests/views/realm.test.ts` — mock SqlApi + ToriiClient, verify RealmView shape, computed fields
- `tests/views/explorer.test.ts` — mock data, verify stamina computation, combat previews, nearby entities
- `tests/views/map-area.test.ts` — mock tile + structure + army data, verify filtering and summaries

**Implementation:**

1. RealmView builder — fetches structure, resources, guards, explorers, arrivals; runs compute functions; assembles view
2. ExplorerView builder — fetches explorer, nearby tiles/entities; runs stamina + combat compute
3. MapAreaView builder — fetches tiles in bounding box, filters structures/armies by distance

### Phase 6: View Builders (Secondary)

**Files:** `src/views/market.ts`, `src/views/player.ts`, `src/views/hyperstructure.ts`, `src/views/leaderboard.ts`,
`src/views/bank.ts`, `src/views/events.ts`

**Tests first:**

- `tests/views/market.test.ts` — mock pool data, verify quotes, slippage, AMM comparison
- `tests/views/player.test.ts` — mock aggregated data, verify portfolio
- `tests/views/hyperstructure.test.ts` — mock requirements, verify progress computation
- `tests/views/leaderboard.test.ts` — mock ranked data
- `tests/views/bank.test.ts` — mock pool + LP position data

**Implementation:**

1. MarketView — fetches pools + orders + swaps; runs AMM computations
2. PlayerView — fetches aggregated player data; computes totals
3. HyperstructureView — fetches structure + requirements; computes progress
4. LeaderboardView — uses existing pipeline from torii package
5. BankView — fetches pool data for specific bank
6. EventsView — wraps story event queries with summary generation

### Phase 7: Integration & Cache Wiring

**Files:** `src/views/index.ts` (ViewClient), cache invalidation in transactions

**Tests:**

- Integration test: create client → call views → verify cache behavior
- Transaction cache invalidation tests

**Implementation:**

1. Wire ViewClient with cache layer
2. Add cache invalidation hooks to transaction completion events
3. End-to-end smoke test against live Torii (optional, behind env flag)

---

## 9. Testing Strategy

### Unit Tests (vitest)

- **Compute functions:** Pure input/output, no mocks needed. Use known game values.
- **View builders:** Mock `SqlApi` and `ToriiClient` responses. Verify view shape and computed fields.
- **Cache:** Test TTL expiry, invalidation patterns, hit rate tracking.
- **Transaction grouping:** Verify prop mapping to provider methods.

### Test Data

Create fixtures from real Torii responses:

```
tests/fixtures/
├── structure-response.json      # Real getStructureFromToriiClient response
├── explorer-response.json       # Real getExplorerFromToriiClient response
├── guards-response.json         # Real fetchGuardsByStructure response
├── market-pools.json            # Real pool reserve data
├── leaderboard-rows.json        # Real leaderboard query response
└── tiles-response.json          # Real tile data
```

### Coverage Targets

- Compute module: 100% branch coverage (deterministic math)
- View builders: 90%+ (all code paths with mocked data)
- Transaction layer: 80%+ (delegation verification)
- Cache: 100% (simple, critical)

---

## 10. Package Configuration

### package.json

```json
{
  "name": "@bibliothecadao/client",
  "version": "0.1.0",
  "description": "Headless Eternum client for bots, agents, and custom UIs",
  "license": "MIT",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "main": "./dist/index.js",
  "scripts": {
    "build": "tsup",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  },
  "dependencies": {
    "@bibliothecadao/provider": "workspace:*",
    "@bibliothecadao/torii": "workspace:*",
    "@bibliothecadao/types": "workspace:*",
    "@bibliothecadao/eternum": "workspace:*",
    "starknet": "catalog:"
  },
  "devDependencies": {
    "@types/node": "^20.11.10",
    "tsup": "^8.0.2",
    "typescript": "^5.4.4",
    "vitest": "^2.0.5"
  }
}
```

### Public Exports (src/index.ts)

```typescript
// Client
export { EternumClient } from "./client";
export type { EternumClientConfig } from "./config";

// Views
export type {
  RealmView,
  ExplorerView,
  MapAreaView,
  MarketView,
  PlayerView,
  HyperstructureView,
  LeaderboardView,
  BankView,
  EventsView,
} from "./types/views";

// Common sub-types
export type {
  ResourceState,
  ProductionState,
  BuildingState,
  GuardState,
  ExplorerSummary,
  ArrivalState,
  TradeOrderState,
  RelicState,
  BattleReference,
  ResourceCost,
  NearbyEntity,
  AmmPoolState,
  TileState,
  MapStructure,
  MapArmy,
  SwapEvent,
  MarketOrder,
  GameEvent,
} from "./types/common";

// Computation functions (for advanced users)
export {
  computeBalance,
  computeDepletionTime,
  simulateBattle,
  simulateRaid,
  computeStrength,
  computeOutputAmount,
  computeSlippage,
  computeStamina,
  computeBuildingCost,
} from "./compute";

// Cache (for manual control)
export { ViewCache } from "./cache";

// Re-export key types from dependencies
export { ResourcesIds, BuildingType, StructureType, TroopType, TroopTier, Direction } from "@bibliothecadao/types";
```

---

## 11. Usage Examples

### AI Agent (Tick-Based)

```typescript
import { EternumClient, ResourcesIds } from "@bibliothecadao/client";
import { Account } from "starknet";

const client = await EternumClient.create({
  rpcUrl: "https://rpc.cartridge.gg/starknet/eternum",
  toriiUrl: "https://torii.eternum.gg",
  worldAddress: "0x...",
  manifest: require("./manifest.json"),
});

const account = new Account(provider, address, privateKey);
client.connect(account);

// Agent loop — runs every game tick (60s)
setInterval(async () => {
  const realm = await client.view.realm(myRealmId);
  const market = await client.view.market();

  // Sell excess wood if price is good
  const wood = realm.resources.find((r) => r.resourceId === ResourcesIds.Wood);
  const woodPool = market.pools.find((p) => p.resourceId === ResourcesIds.Wood);

  if (wood && wood.balance > 5000 && woodPool && woodPool.price.lordsPerResource > 2.0) {
    await client.bank.sell(account, {
      bankEntityId: ADMIN_BANK_ENTITY_ID,
      entityId: myRealmId,
      resourceType: ResourcesIds.Wood,
      amount: 1000,
    });
  }

  // Reinforce guards if any are empty
  for (const guard of realm.guards) {
    if (guard.isEmpty) {
      await client.troops.addGuard(account, {
        structureId: myRealmId,
        slot: guard.slot,
        category: TroopType.Knight,
        tier: TroopTier.T1,
        count: 50000,
      });
      break;
    }
  }

  // Claim arrived resources
  for (const arrival of realm.arrivals) {
    if (arrival.hasArrived) {
      await client.resources.claimArrivals(account, {
        structureId: myRealmId,
        day: arrival.day,
        slot: arrival.slot,
        resourceCount: arrival.resources.length,
      });
    }
  }
}, 60_000);
```

### Read-Only Dashboard

```typescript
const client = await EternumClient.create({
  rpcUrl: "https://rpc.cartridge.gg/starknet/eternum",
  toriiUrl: "https://torii.eternum.gg",
  worldAddress: "0x...",
  manifest: require("./manifest.json"),
});
// No connect() needed for read-only

const leaderboard = await client.view.leaderboard({ limit: 100 });
const hyperstructures = await Promise.all(leaderboard.hyperstructures.ids.map((id) => client.view.hyperstructure(id)));

console.log("Season ends in:", leaderboard.season.timeRemainingSeconds, "seconds");
console.log("Leader:", leaderboard.players[0].name, leaderboard.players[0].totalPoints, "pts");
```

### Combat Scout Bot

```typescript
// Scout nearby area, assess threats, report
async function scoutArea(client: EternumClient, center: Position, radius: number) {
  const area = await client.view.mapArea({ x: center.x, y: center.y, radius });

  const threats = area.armies
    .filter((a) => !a.isMine && !a.isBandit && a.troops.count > 50000)
    .sort((a, b) => a.distance - b.distance);

  const opportunities = area.armies.filter((a) => a.isBandit && a.troops.count < 20000);

  return { threats, opportunities, summary: area.summary };
}
```

---

## 12. Migration Path

### For Existing Game Client

The game client (`client/apps/game`) continues using `@bibliothecadao/react` hooks and RECS. No changes needed. The
headless client is **additive**.

### For Bot Developers

Previously required assembling 5+ packages manually. Now:

```
Before: provider + types + torii + core + dojo + recs + manual wiring
After:  client
```

### Future: React Package Simplification

Eventually, `@bibliothecadao/react` hooks could be refactored to use `@bibliothecadao/client` internally:

```typescript
// Future: hooks become thin wrappers
function useRealmView(entityId: ID) {
  const client = useEternumClient();
  return useQuery(["realm", entityId], () => client.view.realm(entityId));
}
```

This is a future consideration, not part of this PRD.

---

## 13. Success Criteria

1. **`pnpm --dir packages/client build`** produces valid ESM output
2. **All tests pass** with `pnpm --dir packages/client test`
3. **Zero RECS dependency** — `@dojoengine/recs` not in dependency tree
4. **Complete API coverage:**
   - 9 views covering all game domains
   - Transaction methods for all 100+ system calls
   - All computed values from existing managers reproduced
5. **Agent can play a full game tick** using only `@bibliothecadao/client`:
   - Read realm state → make decisions → execute transactions
6. **Read-only mode works** without calling `connect()`
7. **Cache reduces Torii load** — same view called 2x in <5s hits cache
