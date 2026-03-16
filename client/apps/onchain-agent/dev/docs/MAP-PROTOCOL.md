# Map Protocol

An LSP-like query interface for the Eternum game world. Instead of parsing an ASCII map, agents query structured operations and get structured answers back.

## Architecture

```
EternumClient (Torii SQL)
       ↓
   MapSnapshot (background refresh every 10s)
       ↓
   MapProtocol (query layer — sync cache + async live fetches)
       ↓
   ┌─────────────────────────────────────────┐
   │  MCP Server    │  Agent Tool  │  HTTP   │
   │  (Claude Code) │  (map_query) │  Server │
   └─────────────────────────────────────────┘
```

The protocol wraps `MapSnapshot` and provides typed queries. When an `EternumClient` is provided, it enriches results with live data (guards, resources, troops) that the snapshot cache may not have.

## Operations

| Operation | Analogy (LSP) | Description |
|---|---|---|
| `tileInfo(x, y)` | `hover` | Full details on a tile: biome, entity, guards, resources, strength |
| `nearby(x, y, radius)` | `findReferences` | Grouped nearby entities: your armies, enemies, structures, chests |
| `entityInfo(entityId)` | `goToDefinition` | Deep drill-down on any entity by ID |
| `find(type, ref?)` | `workspaceSymbol` | Global search by type, sorted by distance |
| `diagnostics()` | diagnostics (pushed) | Threats, opportunities, ready armies |
| `briefing()` | — | Compact tick context for the agent |

### Deep vs Lightweight

- **`tileInfo` and `entityInfo`** — deep drill-downs with full details (guards, resources, strength, owner). Async, may do live fetches.
- **`nearby` and `find`** — lightweight summaries for scanning many entities. Include strength via batch enrichment when a client is available.

## Setup

### Prerequisites

```bash
cd client/apps/onchain-agent
pnpm install
```

You need a `.env` file in `client/apps/onchain-agent/`:

```bash
CHAIN=slot
WORLD_NAME=<your-world>
# Or explicit:
# TORII_URL=https://api.cartridge.gg/x/<world>/torii
# WORLD_ADDRESS=0x...
```

### 1. MCP Server (Claude Code integration)

Exposes the full game toolkit — map queries + action tools — as native Claude Code tools.

**Register:**

```bash
claude mcp add eternum -- npx tsx /path/to/client/apps/onchain-agent/dev/scripts/mcp-server.ts
```

**First run** will prompt for Cartridge authentication (opens browser). Session is saved to `~/.axis/worlds/<address>/.cartridge/session.json` and reused on subsequent starts.

**Verify:**

```bash
claude mcp list       # Should show: eternum ✓ Connected
```

Then in Claude Code, use `/mcp` to see available tools. The following tools are exposed:

**Map Protocol (read-only):**
- `map_tile_info(x, y)` — what's at this position
- `map_nearby(x, y, radius?)` — what's around here
- `map_entity_info(entity_id)` — full entity details
- `map_find(type, ref_x?, ref_y?)` — global search
- `map_briefing()` — game state summary

**Action Tools (write):**
- `move_army(army_id, target_x, target_y)` — pathfind and move
- `attack_target(army_id, target_x, target_y)` — attack adjacent target
- `create_army(structure_id, troop_type?, tier?)` — spawn army at realm
- `open_chest(army_id, chest_x, chest_y)` — open adjacent chest
- `inspect_tile(x, y)` — deep tile inspection

**Remove:**

```bash
claude mcp remove eternum
```

### 2. Standalone HTTP Server

For testing, debugging, or wiring to other clients.

```bash
cd client/apps/onchain-agent
npx tsx dev/scripts/protocol-server.ts
```

Runs at `http://localhost:3117`. No auth required — read-only queries only.

**Endpoints:**

```
GET /                                        → list all endpoints
GET /tile_info?x=&y=                         → tile details
GET /nearby?x=&y=&radius=5                   → nearby entities
GET /entity_info?entity_id=                  → entity details
GET /find?type=&ref_x=&ref_y=               → global search
GET /diagnostics                             → threats & opportunities
GET /briefing                                → compact tick context (text)
GET /status                                  → server status
```

**With a player address** (for owned entity detection):

Edit `protocol-server.ts` and pass the player address to `createMapProtocol`.

### 3. View Briefing

See exactly what the agent receives each tick:

```bash
cd client/apps/onchain-agent
npx tsx dev/scripts/view-briefing.ts
```

With a player address to see the full experience:

```bash
npx tsx dev/scripts/view-briefing.ts --player 0xYourAddress
```

### 4. Protocol Quality Tests

Run the test suite against a running protocol server:

```bash
# Start the server first
npx tsx dev/scripts/protocol-server.ts &

# Then run tests
npx tsx dev/scripts/protocol-test.ts
```

Tests check for: duplication, gaps, consistency between endpoints, correct types, sorting, edge cases (empty tiles, unexplored, missing entities, chests).

## Coordinates

All coordinates are **world hex (x, y)** — not row:col. Coordinates come from:
- The tick briefing (pushed each turn)
- Previous query results (entity positions, nearby results)
- `find` results (entity positions with optional distance)

Entity IDs are stable identifiers for armies and structures. Use them for action tools (`move_army`, `attack_target`, `create_army`, etc.).

## Using in Code

```typescript
import { createMapProtocol } from "./src/map/protocol.js";
import { renderMap } from "./src/map/renderer.js";
import { EternumClient } from "@bibliothecadao/client";

const client = await EternumClient.create({ toriiUrl: "..." });
const area = await client.view.mapArea({ x: 0, y: 0, radius: 999999 });
const snapshot = renderMap(area.tiles);

// Without client — sync queries from cached snapshot only
const protocol = createMapProtocol(snapshot, ownedEntityIds);

// With client — async queries with live data enrichment
const protocol = createMapProtocol(snapshot, ownedEntityIds, staminaConfig, client);

// Query
const tile = await protocol.tileInfo(x, y);
const nearby = await protocol.nearby(x, y, 5);
const entity = await protocol.entityInfo(entityId);
const mines = await protocol.find("mine", { x, y });
const diags = protocol.diagnostics();
const brief = protocol.briefing();
```

## Multi-Agent Pattern

With the MCP server running, Claude Code subagents all share the same tools:

```
Main Agent
  ├── Defense Agent (watches threats, positions armies)
  ├── Explorer Agent (finds frontiers, explores for rewards)
  ├── Raider Agent (finds weak targets, captures structures)
  └── Scout Agent (monitors map_briefing, alerts on changes)
```

Each agent queries the same protocol, sees the same world state, and can execute real on-chain actions. They communicate via `SendMessage` to coordinate.
