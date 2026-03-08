# Automation Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the agent's existing dry-run automation (build-order, runner, production) into a live background loop that executes transactions across all owned realms.

**Architecture:** A `createAutomationLoop()` runs on a 60s interval. Each tick: discover owned realms via SQL, fetch balances+buildings in parallel, run planners, execute build/upgrade/production calls in parallel via the provider. Status written to `automation-status.txt` for the LLM agent.

**Tech Stack:** `@bibliothecadao/client` (ViewClient, SqlApi), `@bibliothecadao/torii` (SQL queries, RESOURCE_BALANCE_COLUMNS), `@bibliothecadao/types` (Direction, getNeighborHexes, BUILDINGS_CENTER), EternumProvider

---

### Task 1: Snapshot Parser — `src/automation/snapshot.ts`

Parse raw SQL balance+production rows into typed maps the planners consume.

**Files:**
- Create: `src/automation/snapshot.ts`
- Test: `dev/test/automation/snapshot.test.ts`

**Step 1: Write the failing test**

```typescript
// dev/test/automation/snapshot.test.ts
import { describe, it, expect } from "vitest";
import { parseRealmSnapshot } from "../../../src/automation/snapshot.js";

describe("parseRealmSnapshot", () => {
  it("parses hex balance columns into resource ID map", () => {
    const row: Record<string, any> = {
      entity_id: 100,
      // Coal = ResourcesIds 2, hex for 5000 * 1000 (RESOURCE_PRECISION) = 5_000_000
      COAL_BALANCE: "0x4C4B40",
      WOOD_BALANCE: "0x0",
      WHEAT_BALANCE: "0x1E8480", // 2_000_000 = 2000
      // Production columns
      "COAL_PRODUCTION.building_count": 1,
      "WOOD_PRODUCTION.building_count": 0,
      "WHEAT_PRODUCTION.building_count": 2,
    };

    const snapshot = parseRealmSnapshot(row);

    expect(snapshot.balances.get(2)).toBe(5000); // Coal
    expect(snapshot.balances.has(3)).toBe(false); // Wood is 0, not included
    expect(snapshot.balances.get(35)).toBe(2000); // Wheat
    expect(snapshot.buildingCounts.get(4)).toBe(1); // Coal building type = 4
    expect(snapshot.activeBuildings.has(4)).toBe(true);
    expect(snapshot.activeBuildings.has(5)).toBe(false); // Wood building = 0
  });

  it("returns empty maps for null/undefined row", () => {
    const snapshot = parseRealmSnapshot(null);
    expect(snapshot.balances.size).toBe(0);
    expect(snapshot.buildingCounts.size).toBe(0);
    expect(snapshot.activeBuildings.size).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run dev/test/automation/snapshot.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/automation/snapshot.ts
import { RESOURCE_BALANCE_COLUMNS } from "@bibliothecadao/torii";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

export interface RealmSnapshot {
  balances: Map<number, number>;
  buildingCounts: Map<number, number>;
  activeBuildings: Set<number>;
}

// Resource column name → BuildingType mapping
// e.g. "COAL" → BuildingType.Coal (4)
const RESOURCE_NAME_TO_BUILDING: Record<string, number> = {
  COAL: 4, WOOD: 5, COPPER: 6, IRONWOOD: 7,
  GOLD: 9, MITHRAL: 11, COLD_IRON: 13,
  ADAMANTINE: 21, DRAGONHIDE: 24, WHEAT: 37,
};

function parseBalance(hex: string | null | undefined): number {
  if (!hex || hex === "0x0" || hex === "0x") return 0;
  try {
    return Number(BigInt(hex)) / RESOURCE_PRECISION;
  } catch {
    return 0;
  }
}

export function parseRealmSnapshot(row: Record<string, any> | null | undefined): RealmSnapshot {
  const balances = new Map<number, number>();
  const buildingCounts = new Map<number, number>();
  const activeBuildings = new Set<number>();

  if (!row) return { balances, buildingCounts, activeBuildings };

  for (const { column, resourceId } of RESOURCE_BALANCE_COLUMNS) {
    const amount = parseBalance(row[column]);
    if (amount > 0) {
      balances.set(resourceId, Math.floor(amount));
    }

    // Parse production building count
    const resourceName = column.replace("_BALANCE", "");
    const prodKey = `${resourceName}_PRODUCTION.building_count`;
    const count = Number(row[prodKey] ?? 0);
    const buildingType = RESOURCE_NAME_TO_BUILDING[resourceName];
    if (buildingType !== undefined && count > 0) {
      buildingCounts.set(buildingType, count);
      activeBuildings.add(buildingType);
    }
  }

  return { balances, buildingCounts, activeBuildings };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run dev/test/automation/snapshot.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/automation/snapshot.ts dev/test/automation/snapshot.test.ts
git commit -m "feat(automation): add snapshot parser for SQL balance+production rows"
```

---

### Task 2: Building Placement — `src/automation/placement.ts`

Find an open inner hex on a realm and compute directions from BUILDINGS_CENTER.

**Files:**
- Create: `src/automation/placement.ts`
- Test: `dev/test/automation/placement.test.ts`

**Step 1: Write the failing test**

```typescript
// dev/test/automation/placement.test.ts
import { describe, it, expect } from "vitest";
import { findOpenSlot, getDirectionsArray } from "../../../src/automation/placement.js";

describe("getDirectionsArray", () => {
  it("returns path from center to adjacent hex", () => {
    const dirs = getDirectionsArray([10, 10], [11, 10]);
    expect(dirs.length).toBe(1);
  });

  it("returns empty array for unreachable target", () => {
    // BFS with max depth should eventually return something or empty
    const dirs = getDirectionsArray([10, 10], [10, 10]);
    expect(dirs).toEqual([]);
  });
});

describe("findOpenSlot", () => {
  it("returns first open hex in ring 1 when all are free", () => {
    const occupied = new Set<string>();
    const result = findOpenSlot(occupied, 1);
    expect(result).not.toBeNull();
    expect(result!.directions.length).toBeGreaterThan(0);
  });

  it("skips occupied hexes", () => {
    // Occupy all ring 1 except one
    const ring1 = [[11, 10], [11, 11], [10, 11], [9, 10], [10, 9], [11, 9]];
    const occupied = new Set(ring1.slice(0, 5).map(([c, r]) => `${c},${r}`));
    const result = findOpenSlot(occupied, 1);
    expect(result).not.toBeNull();
  });

  it("returns null when all slots in range are occupied", () => {
    // Occupy all ring 1 hexes (Settlement has 6 slots)
    const ring1 = [[11, 10], [11, 11], [10, 11], [9, 10], [10, 9], [11, 9]];
    const occupied = new Set(ring1.map(([c, r]) => `${c},${r}`));
    const result = findOpenSlot(occupied, 1); // level 1 = ring 1 only
    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run dev/test/automation/placement.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/automation/placement.ts
import { getNeighborHexes, Direction } from "@bibliothecadao/types";

const CENTER: [number, number] = [10, 10];

// Max rings per realm level: Settlement=1, City=2, Kingdom=3, Empire=4
const LEVEL_TO_MAX_RING: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 4 };

/**
 * BFS from start to end on the inner hex grid, returning Direction[] path.
 * Same algorithm as game client's tile-manager.ts.
 */
export function getDirectionsArray(start: [number, number], end: [number, number]): Direction[] {
  const [startCol, startRow] = start;
  const [endCol, endRow] = end;

  if (startCol === endCol && startRow === endRow) return [];

  const queue: { col: number; row: number; path: Direction[] }[] = [
    { col: startCol, row: startRow, path: [] },
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { col, row, path } = queue.shift()!;

    if (col === endCol && row === endRow) return path;

    const key = `${col},${row}`;
    if (visited.has(key)) continue;
    visited.add(key);

    for (const neighbor of getNeighborHexes(col, row)) {
      if (!visited.has(`${neighbor.col},${neighbor.row}`)) {
        queue.push({
          col: neighbor.col,
          row: neighbor.row,
          path: [...path, neighbor.direction],
        });
      }
    }
  }

  return [];
}

/**
 * Generate all hex positions in concentric rings around center.
 * Ring 1 = 6 hexes, ring 2 = 12, ring 3 = 18, ring 4 = 24.
 */
function hexRings(maxRing: number): Array<{ col: number; row: number }> {
  const result: Array<{ col: number; row: number }> = [];
  const visited = new Set<string>();
  visited.add(`${CENTER[0]},${CENTER[1]}`); // exclude center itself

  let frontier = [{ col: CENTER[0], row: CENTER[1] }];

  for (let ring = 1; ring <= maxRing; ring++) {
    const nextFrontier: Array<{ col: number; row: number }> = [];
    for (const hex of frontier) {
      for (const neighbor of getNeighborHexes(hex.col, hex.row)) {
        const key = `${neighbor.col},${neighbor.row}`;
        if (!visited.has(key)) {
          visited.add(key);
          result.push({ col: neighbor.col, row: neighbor.row });
          nextFrontier.push({ col: neighbor.col, row: neighbor.row });
        }
      }
    }
    frontier = nextFrontier;
  }

  return result;
}

export interface SlotResult {
  col: number;
  row: number;
  directions: Direction[];
}

/**
 * Find the first open build slot on a realm.
 * @param occupied Set of "col,row" strings for already-built positions
 * @param level Realm level (1-4), determines how many rings are available
 */
export function findOpenSlot(occupied: Set<string>, level: number): SlotResult | null {
  const maxRing = LEVEL_TO_MAX_RING[level] ?? 1;
  const candidates = hexRings(maxRing);

  for (const { col, row } of candidates) {
    if (!occupied.has(`${col},${row}`)) {
      const directions = getDirectionsArray(CENTER, [col, row]);
      if (directions.length > 0) {
        return { col, row, directions };
      }
    }
  }

  return null;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run dev/test/automation/placement.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/automation/placement.ts dev/test/automation/placement.test.ts
git commit -m "feat(automation): add building placement with BFS direction finding"
```

---

### Task 3: Executor — `src/automation/executor.ts`

Execute build/upgrade/production calls via the provider for a single realm.

**Files:**
- Create: `src/automation/executor.ts`
- Test: `dev/test/automation/executor.test.ts`

**Step 1: Write the failing test**

```typescript
// dev/test/automation/executor.test.ts
import { describe, it, expect, vi } from "vitest";
import { executeRealmTick } from "../../../src/automation/executor.js";

function makeProvider() {
  return {
    create_building: vi.fn().mockResolvedValue({}),
    upgrade_realm: vi.fn().mockResolvedValue({}),
    execute_realm_production_plan: vi.fn().mockResolvedValue({}),
  };
}

describe("executeRealmTick", () => {
  it("executes a build intent", async () => {
    const provider = makeProvider();
    const signer = {} as any;

    const result = await executeRealmTick({
      provider: provider as any,
      signer,
      realmEntityId: 100,
      buildIntent: {
        action: "build" as const,
        step: { building: 4, label: "CoalMine" },
        index: 2,
        slot: { col: 11, row: 10, directions: [0] },
      },
      upgradeIntent: null,
      productionCalls: null,
    });

    expect(provider.create_building).toHaveBeenCalledOnce();
    expect(result.built).toBe("CoalMine");
  });

  it("executes an upgrade intent", async () => {
    const provider = makeProvider();
    const signer = {} as any;

    const result = await executeRealmTick({
      provider: provider as any,
      signer,
      realmEntityId: 100,
      buildIntent: null,
      upgradeIntent: { fromLevel: 1, fromName: "Settlement", toName: "City" },
      productionCalls: null,
    });

    expect(provider.upgrade_realm).toHaveBeenCalledOnce();
    expect(result.upgraded).toBe("Settlement → City");
  });

  it("executes production calls", async () => {
    const provider = makeProvider();
    const signer = {} as any;

    const result = await executeRealmTick({
      provider: provider as any,
      signer,
      realmEntityId: 100,
      buildIntent: null,
      upgradeIntent: null,
      productionCalls: {
        resourceToResource: [{ resource_id: 3, cycles: 10 }],
        laborToResource: [{ resource_id: 4, cycles: 5 }],
      },
    });

    expect(provider.execute_realm_production_plan).toHaveBeenCalledOnce();
    expect(result.produced).toBe(true);
  });

  it("returns idle when nothing to do", async () => {
    const provider = makeProvider();
    const signer = {} as any;

    const result = await executeRealmTick({
      provider: provider as any,
      signer,
      realmEntityId: 100,
      buildIntent: null,
      upgradeIntent: null,
      productionCalls: null,
    });

    expect(result.idle).toBe(true);
    expect(provider.create_building).not.toHaveBeenCalled();
    expect(provider.upgrade_realm).not.toHaveBeenCalled();
    expect(provider.execute_realm_production_plan).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run dev/test/automation/executor.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/automation/executor.ts
import type { EternumProvider } from "@bibliothecadao/provider";
import type { SlotResult } from "./placement.js";
import type { BuildStep } from "./build-order.js";
import type { ProductionCall } from "./production.js";

export interface BuildAction {
  action: "build";
  step: BuildStep;
  index: number;
  slot: SlotResult;
}

export interface UpgradeAction {
  fromLevel: number;
  fromName: string;
  toName: string;
}

export interface ProductionActions {
  resourceToResource: Array<{ resource_id: number; cycles: number }>;
  laborToResource: Array<{ resource_id: number; cycles: number }>;
}

export interface TickInput {
  provider: EternumProvider;
  signer: any;
  realmEntityId: number;
  buildIntent: BuildAction | null;
  upgradeIntent: UpgradeAction | null;
  productionCalls: ProductionActions | null;
}

export interface TickResult {
  realmEntityId: number;
  built: string | null;
  upgraded: string | null;
  produced: boolean;
  idle: boolean;
  errors: string[];
}

export async function executeRealmTick(input: TickInput): Promise<TickResult> {
  const { provider, signer, realmEntityId } = input;
  const result: TickResult = {
    realmEntityId,
    built: null,
    upgraded: null,
    produced: false,
    idle: true,
    errors: [],
  };

  // Build
  if (input.buildIntent) {
    try {
      await provider.create_building({
        entity_id: realmEntityId,
        directions: input.buildIntent.slot.directions,
        building_category: input.buildIntent.step.building,
        use_simple: false,
        signer,
      });
      result.built = input.buildIntent.step.label;
      result.idle = false;
    } catch (e: any) {
      result.errors.push(`Build failed: ${e.message ?? e}`);
    }
  }

  // Upgrade
  if (input.upgradeIntent) {
    try {
      await provider.upgrade_realm({
        realm_entity_id: realmEntityId,
        signer,
      });
      result.upgraded = `${input.upgradeIntent.fromName} → ${input.upgradeIntent.toName}`;
      result.idle = false;
    } catch (e: any) {
      result.errors.push(`Upgrade failed: ${e.message ?? e}`);
    }
  }

  // Production
  if (input.productionCalls) {
    const { resourceToResource, laborToResource } = input.productionCalls;
    if (resourceToResource.length > 0 || laborToResource.length > 0) {
      try {
        await provider.execute_realm_production_plan({
          realm_entity_id: realmEntityId,
          resource_to_resource: resourceToResource,
          labor_to_resource: laborToResource,
          signer,
        });
        result.produced = true;
        result.idle = false;
      } catch (e: any) {
        result.errors.push(`Production failed: ${e.message ?? e}`);
      }
    }
  }

  return result;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run dev/test/automation/executor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/automation/executor.ts dev/test/automation/executor.test.ts
git commit -m "feat(automation): add executor for build/upgrade/production calls"
```

---

### Task 4: Status Writer — `src/automation/status.ts`

Format per-realm tick results into a human-readable status file.

**Files:**
- Create: `src/automation/status.ts`
- Test: `dev/test/automation/status.test.ts`

**Step 1: Write the failing test**

```typescript
// dev/test/automation/status.test.ts
import { describe, it, expect } from "vitest";
import { formatStatus } from "../../../src/automation/status.js";

describe("formatStatus", () => {
  it("formats a tick with build + production", () => {
    const text = formatStatus({
      timestamp: new Date("2026-03-08T12:00:00Z"),
      realms: [
        {
          realmEntityId: 100,
          realmName: "Ironforge",
          biome: 11,
          level: 1,
          buildOrderProgress: "6/13",
          tickResult: {
            realmEntityId: 100,
            built: "CoalMine",
            upgraded: null,
            produced: true,
            idle: false,
            errors: [],
          },
          essencePulse: { balance: 200, sufficient: true },
          wheatPulse: { balance: 5000, low: false, movesRemaining: 250 },
        },
      ],
    });

    expect(text).toContain("Ironforge");
    expect(text).toContain("CoalMine");
    expect(text).toContain("6/13");
    expect(text).toContain("Production: executed");
  });

  it("formats idle realm", () => {
    const text = formatStatus({
      timestamp: new Date("2026-03-08T12:00:00Z"),
      realms: [{
        realmEntityId: 100,
        realmName: "Quiet",
        biome: 11,
        level: 4,
        buildOrderProgress: "13/13",
        tickResult: {
          realmEntityId: 100,
          built: null,
          upgraded: null,
          produced: false,
          idle: true,
          errors: [],
        },
        essencePulse: { balance: 0, sufficient: true },
        wheatPulse: { balance: 100, low: true, movesRemaining: 5 },
      }],
    });

    expect(text).toContain("Idle");
    expect(text).toContain("LOW");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run dev/test/automation/status.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/automation/status.ts
import type { TickResult } from "./executor.js";

export interface RealmStatus {
  realmEntityId: number;
  realmName: string;
  biome: number;
  level: number;
  buildOrderProgress: string;
  tickResult: TickResult;
  essencePulse: { balance: number; sufficient: boolean };
  wheatPulse: { balance: number; low: boolean; movesRemaining: number };
}

export interface StatusInput {
  timestamp: Date;
  realms: RealmStatus[];
}

export function formatStatus(input: StatusInput): string {
  const lines: string[] = [];
  lines.push(`=== Automation Status ===`);
  lines.push(`Last tick: ${input.timestamp.toISOString()}`);
  lines.push(`Realms: ${input.realms.length}`);
  lines.push("");

  for (const realm of input.realms) {
    const r = realm.tickResult;
    lines.push(`--- ${realm.realmName} (entity ${realm.realmEntityId}) ---`);
    lines.push(`Level: ${realm.level} | Build order: ${realm.buildOrderProgress}`);

    if (r.built) lines.push(`Built: ${r.built}`);
    if (r.upgraded) lines.push(`Upgraded: ${r.upgraded}`);
    lines.push(`Production: ${r.produced ? "executed" : "skipped"}`);
    if (r.idle) lines.push(`Status: Idle`);

    // Pulse
    const ess = realm.essencePulse;
    lines.push(`Essence: ${ess.balance}${ess.sufficient ? "" : " (INSUFFICIENT)"}`);
    const wh = realm.wheatPulse;
    lines.push(`Wheat: ${wh.balance} (~${wh.movesRemaining} moves)${wh.low ? " LOW" : ""}`);

    if (r.errors.length > 0) {
      lines.push(`Errors: ${r.errors.join("; ")}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run dev/test/automation/status.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/automation/status.ts dev/test/automation/status.test.ts
git commit -m "feat(automation): add status file formatter"
```

---

### Task 5: Automation Loop — `src/automation/loop.ts`

The main loop that ties everything together. Replaces the existing `loop.ts` placeholder if it conflicts, otherwise new file.

**Files:**
- Create: `src/automation/loop.ts` (this is the automation loop, distinct from `src/map/loop.ts`)
- No unit test — integration tested via the existing `runner`, `production`, `pulse` tests + manual

**Step 1: Write the implementation**

```typescript
// src/automation/loop.ts
import { writeFileSync } from "fs";
import { join } from "path";
import type { EternumClient } from "@bibliothecadao/client";
import type { EternumProvider } from "@bibliothecadao/provider";
import { parseRealmSnapshot } from "./snapshot.js";
import { resolveIntent } from "./runner.js";
import { buildOrderForBiome, troopPathForBiome } from "./build-order.js";
import { planProduction } from "./production.js";
import { findOpenSlot } from "./placement.js";
import { executeRealmTick, type BuildAction, type UpgradeAction, type ProductionActions } from "./executor.js";
import { formatStatus, type RealmStatus } from "./status.js";
import type { RealmState } from "./runner.js";

export interface AutomationLoop {
  start(): void;
  stop(): void;
  refresh(): Promise<void>;
  readonly isRunning: boolean;
}

export function createAutomationLoop(
  client: EternumClient,
  provider: EternumProvider,
  signer: any,
  playerAddress: string,
  dataDir: string,
  intervalMs = 60_000,
): AutomationLoop {
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;

  async function tick() {
    try {
      // Phase 1: Discover owned realms
      const sql = client.sql as any;
      if (typeof sql.fetchStructuresByOwner !== "function") return;

      const structures: { entity_id: number; category?: number }[] =
        await sql.fetchStructuresByOwner(playerAddress);

      // Filter to realms (category 1) and villages (category 5) if category is available
      // If category is not returned, process all structures
      const realmEntities = structures.map(s => Number(s.entity_id)).filter(id => id > 0);
      if (realmEntities.length === 0) return;

      // Phase 2: Fetch state in parallel
      const snapshotRows = await Promise.all(
        realmEntities.map(async (entityId) => {
          try {
            const rows = await sql.fetchResourceBalancesAndProduction([entityId]);
            return { entityId, row: rows?.[0] ?? null };
          } catch {
            return { entityId, row: null };
          }
        }),
      );

      // Fetch building positions for all realms in one query
      let buildingRows: { outer_entity_id: number; inner_col: number; inner_row: number; category: number }[] = [];
      try {
        if (typeof sql.fetchBuildingsByStructures === "function") {
          buildingRows = await sql.fetchBuildingsByStructures(realmEntities);
        }
      } catch {
        // Continue without building data — builds will be skipped
      }

      // Group buildings by realm
      const buildingsByRealm = new Map<number, Set<string>>();
      for (const b of buildingRows) {
        const key = b.outer_entity_id;
        if (!buildingsByRealm.has(key)) buildingsByRealm.set(key, new Set());
        buildingsByRealm.get(key)!.add(`${b.inner_col},${b.inner_row}`);
      }

      // Phase 3 & 4: Plan and execute in parallel
      const realmStatuses: RealmStatus[] = [];

      const results = await Promise.allSettled(
        snapshotRows.map(async ({ entityId, row }) => {
          const snapshot = parseRealmSnapshot(row);

          // Get realm info (biome, level, name) from structureAt
          const structureInfo = await client.view.structureAt(0, 0).catch(() => null);
          // Fallback: use biome 11 (Grassland) and level 1 if we can't fetch
          const biome = 11; // TODO: resolve from structure position
          const level = structureInfo?.level ?? 1;
          const realmName = `Realm ${entityId}`;

          // Build realm state for planners
          const realmState: RealmState = {
            biome,
            level,
            buildingCounts: snapshot.buildingCounts,
          };

          // Plan: building
          const buildOrder = buildOrderForBiome(biome);
          const intent = resolveIntent(buildOrder, realmState);

          let buildIntent: BuildAction | null = null;
          let upgradeIntent: UpgradeAction | null = null;

          if (intent.action === "build") {
            const occupied = buildingsByRealm.get(entityId) ?? new Set();
            const slot = findOpenSlot(occupied, level);
            if (slot) {
              buildIntent = {
                action: "build",
                step: intent.step,
                index: intent.index,
                slot,
              };
            }
          } else if (intent.action === "upgrade") {
            upgradeIntent = {
              fromLevel: intent.fromLevel,
              fromName: intent.fromName,
              toName: intent.toName,
            };
          }

          // Plan: production
          const troopPath = troopPathForBiome(biome);
          const plan = planProduction(snapshot.balances, snapshot.activeBuildings, troopPath);

          let productionCalls: ProductionActions | null = null;
          if (plan.calls.length > 0) {
            const resourceToResource = plan.calls
              .filter(c => c.method === "complex")
              .map(c => ({ resource_id: c.resourceId, cycles: c.cycles }));
            const laborToResource = plan.calls
              .filter(c => c.method === "simple")
              .map(c => ({ resource_id: c.resourceId, cycles: c.cycles }));

            if (resourceToResource.length > 0 || laborToResource.length > 0) {
              productionCalls = { resourceToResource, laborToResource };
            }
          }

          // Execute
          const tickResult = await executeRealmTick({
            provider,
            signer,
            realmEntityId: entityId,
            buildIntent,
            upgradeIntent,
            productionCalls,
          });

          // Build status
          const progress = `${intent.action === "idle" ? buildOrder.steps.length : (intent as any).index ?? 0}/${buildOrder.steps.length}`;

          return {
            realmEntityId: entityId,
            realmName,
            biome,
            level,
            buildOrderProgress: progress,
            tickResult,
            essencePulse: {
              balance: snapshot.balances.get(38) ?? 0, // Essence = 38
              sufficient: true, // simplified
            },
            wheatPulse: {
              balance: snapshot.balances.get(35) ?? 0, // Wheat = 35
              low: (snapshot.balances.get(35) ?? 0) < 200,
              movesRemaining: Math.floor((snapshot.balances.get(35) ?? 0) / 20),
            },
          } satisfies RealmStatus;
        }),
      );

      // Collect results
      for (const r of results) {
        if (r.status === "fulfilled") {
          realmStatuses.push(r.value);
        }
      }

      // Phase 5: Write status file
      const statusText = formatStatus({
        timestamp: new Date(),
        realms: realmStatuses,
      });

      try {
        writeFileSync(join(dataDir, "automation-status.txt"), statusText);
      } catch {
        // Non-critical
      }
    } catch {
      // Silently skip failed ticks — next cycle will retry
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      tick();
      timer = setInterval(tick, intervalMs);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      running = false;
    },
    async refresh() {
      await tick();
    },
    get isRunning() {
      return running;
    },
  };
}
```

**Step 2: Run all tests to verify nothing broke**

Run: `npx vitest run`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/automation/loop.ts
git commit -m "feat(automation): add main automation loop orchestrating all phases"
```

---

### Task 6: Wire into Entry Point

Connect the automation loop to the agent's startup in `src/entry/main.ts`.

**Files:**
- Modify: `src/entry/main.ts` (add automation loop start/stop alongside map loop)

**Step 1: Add automation loop initialization**

After the map loop is created and started, add:

```typescript
import { createAutomationLoop } from "../automation/loop.js";

// ... after mapLoop.start()
const automationLoop = createAutomationLoop(
  client,
  provider, // EternumProvider instance
  tx.signer,
  account.address,
  config.dataDir,
);
automationLoop.start();
```

And in the shutdown/cleanup, add `automationLoop.stop()`.

**Step 2: Run all tests**

Run: `npx vitest run`
Expected: All PASS

**Step 3: Commit**

```bash
git add src/entry/main.ts
git commit -m "feat(automation): wire automation loop into agent startup"
```

---

### Task 7: Resolve Biome per Realm (refinement)

The loop currently hardcodes biome=11. Fix by fetching structure positions and looking up biomes from map snapshot, or using `structureAt()` which returns position data we can cross-reference with tile biome.

**Files:**
- Modify: `src/automation/loop.ts`

**Step 1: Use structureAt to get position, then look up biome from map tiles**

Add a helper that resolves biome for each realm entity:

```typescript
async function resolveRealmBiome(
  client: EternumClient,
  entityId: number,
): Promise<{ biome: number; level: number; name: string }> {
  // structureAt needs x,y but we have entity ID
  // Use sql to get position, then fetch tile biome
  // Fallback to biome 11 if unavailable
}
```

This depends on what SQL queries are available for position lookup. Implement based on available `fetchStructuresByOwner` return data or `structureAt()` with known coordinates.

**Step 2: Commit**

```bash
git commit -m "feat(automation): resolve per-realm biome from world state"
```
