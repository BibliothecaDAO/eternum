# Agent Intelligence Improvements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inject fresh game state into every LLM call, steer on defensive threats, track tool failures, and use token-aware compaction.

**Architecture:** `transformContext` rebuilds the system prompt with live game state (structures, armies, automation, tool errors) on every LLM call. The map loop detects enemy threats and calls `agent.steer()`. Tool failures are tracked in a rolling window and surfaced in the system prompt. Compaction thresholds are derived from `model.contextWindow`.

**Tech Stack:** pi-agent-core (Agent, steer, transformContext), pi-ai (Model), @bibliothecadao/client (ExplorerInfo, StructureInfo)

---

## File Structure

| File | Responsibility |
|---|---|
| `src/entry/game-state.ts` | **New** — Builds the `<game_state>` XML block from map snapshot + automation status + tool errors |
| `src/map/threat-detection.ts` | **New** — Scans for enemy armies within 1 hex of owned structures, with dedup cooldown |
| `src/map/renderer.ts` | **Modify** — Store `explorerDetails` and `structureDetails` on `MapSnapshot` so `game-state.ts` can read them |
| `src/map/loop.ts` | **Modify** — Accept `onThreat` callback, run threat detection after each refresh |
| `src/automation/loop.ts` | **Modify** — Write to shared `AutomationStatusMap` after each tick |
| `src/automation/status.ts` | **Modify** — Export `AutomationStatusMap` type and shared mutable map |
| `src/entry/main.ts` | **Modify** — Wire game state into `transformContext`, track tool errors, connect threat detection to `agent.steer()`, token-aware compaction |
| `dev/test/entry/game-state.test.ts` | **New** — Tests for `buildGameStateBlock` |
| `dev/test/map/threat-detection.test.ts` | **New** — Tests for `detectThreats` |

---

## Chunk 1: Store Details on MapSnapshot + Automation Status Sharing

### Task 1: Add explorerDetails and structureDetails to MapSnapshot

**Files:**
- Modify: `src/map/renderer.ts:99-130` (MapSnapshot interface + renderMap return)

- [ ] **Step 1: Add fields to MapSnapshot interface**

```typescript
// In MapSnapshot interface, add:
/** Per-explorer metadata for owned armies (troop count, type, stamina). */
explorerDetails: Map<number, any>;
/** Per-structure metadata for owned structures (resources, level, guards). */
structureDetails: Map<number, any>;
```

- [ ] **Step 2: Store details in renderMap return value**

In `renderMap()`, after building the snapshot object, add the maps:

```typescript
return {
  text, headerLines, rowCount, colCount, tiles, gridIndex,
  resolve, tileAt, anchor,
  explorerDetails: explorerDetails ?? new Map(),
  structureDetails: structureDetailMap ?? new Map(),
};
```

- [ ] **Step 3: Run tests**

Run: `pnpm test`
Expected: All 220 tests pass (no test references these new fields yet)

- [ ] **Step 4: Commit**

```bash
git add src/map/renderer.ts
git commit -m "feat: store explorer and structure details on MapSnapshot"
```

### Task 2: Export shared AutomationStatusMap from status.ts

**Files:**
- Modify: `src/automation/status.ts`

- [ ] **Step 1: Add AutomationRealmStatus type and shared map**

```typescript
/** Live automation status for a single realm, updated each automation tick. */
export interface AutomationRealmStatus {
  entityId: number;
  name: string;
  level: number;
  buildOrderProgress: string;
  lastBuilt: string[];
  lastUpgrade: string | null;
  produced: boolean;
  errors: string[];
  wheatBalance: number;
  essenceBalance: number;
}

/** Shared mutable map updated by the automation loop, read by transformContext. */
export type AutomationStatusMap = Map<number, AutomationRealmStatus>;
```

- [ ] **Step 2: Run tests**

Run: `pnpm test`
Expected: All 220 pass

- [ ] **Step 3: Commit**

```bash
git add src/automation/status.ts
git commit -m "feat: export AutomationStatusMap type for shared state"
```

### Task 3: Automation loop writes to shared AutomationStatusMap

**Files:**
- Modify: `src/automation/loop.ts`

- [ ] **Step 1: Accept AutomationStatusMap in createAutomationLoop params**

Add `automationStatus?: AutomationStatusMap` to the function signature. After each realm tick completes, write to it:

```typescript
if (automationStatus) {
  automationStatus.set(entityId, {
    entityId,
    name: realmName,
    level,
    buildOrderProgress: progress,
    lastBuilt: tickResult.built,
    lastUpgrade: tickResult.upgraded,
    produced: tickResult.produced,
    errors: tickResult.errors,
    wheatBalance: snapshot.balances.get(35) ?? 0,
    essenceBalance: snapshot.balances.get(38) ?? 0,
  });
}
```

- [ ] **Step 2: Run tests**

Run: `pnpm test`
Expected: All 220 pass (existing tests don't pass automationStatus)

- [ ] **Step 3: Commit**

```bash
git add src/automation/loop.ts
git commit -m "feat: automation loop writes to shared AutomationStatusMap"
```

---

## Chunk 2: Game State Block Builder

### Task 4: Write failing tests for buildGameStateBlock

**Files:**
- Create: `dev/test/entry/game-state.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from "vitest";
import { buildGameStateBlock } from "../../../src/entry/game-state.js";
import type { MapContext } from "../../../src/map/context.js";
import type { AutomationStatusMap } from "../../../src/automation/status.js";

function makeMapCtx(overrides: Partial<MapContext> = {}): MapContext {
  return { snapshot: null, filePath: null, ...overrides };
}

describe("buildGameStateBlock", () => {
  it("returns empty block when no data available", () => {
    const result = buildGameStateBlock(makeMapCtx(), new Map(), []);
    expect(result).toContain("<game_state>");
    expect(result).toContain("</game_state>");
    expect(result).toContain("No structures");
    expect(result).toContain("No armies");
  });

  it("includes automation status for each realm", () => {
    const status: AutomationStatusMap = new Map();
    status.set(165, {
      entityId: 165,
      name: "Realm 165",
      level: 3,
      buildOrderProgress: "44/45",
      lastBuilt: ["KnightT3"],
      lastUpgrade: null,
      produced: true,
      errors: [],
      wheatBalance: 105000,
      essenceBalance: 5600,
    });
    const result = buildGameStateBlock(makeMapCtx(), status, []);
    expect(result).toContain("Realm 165");
    expect(result).toContain("lv3");
    expect(result).toContain("44/45");
    expect(result).toContain("Wheat: 105K");
  });

  it("includes tool errors grouped by tool name", () => {
    const errors = [
      { tool: "move_army", error: "No army at position", tick: 1 },
      { tool: "move_army", error: "No army at position", tick: 2 },
      { tool: "attack_target", error: "Insufficient stamina", tick: 3 },
    ];
    const result = buildGameStateBlock(makeMapCtx(), new Map(), errors);
    expect(result).toContain("move_army");
    expect(result).toContain("2x");
    expect(result).toContain("attack_target");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- dev/test/entry/game-state.test.ts`
Expected: FAIL — module not found

### Task 5: Implement buildGameStateBlock

**Files:**
- Create: `src/entry/game-state.ts`

- [ ] **Step 1: Implement the function**

```typescript
import type { MapContext } from "../map/context.js";
import type { AutomationStatusMap } from "../automation/status.js";

interface ToolError {
  tool: string;
  error: string;
  tick: number;
}

function formatBalance(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.floor(n));
}

export function buildGameStateBlock(
  mapCtx: MapContext,
  automationStatus: AutomationStatusMap,
  toolErrors: ToolError[],
): string {
  const sections: string[] = ["<game_state>"];

  // Structures
  sections.push("<structures>");
  if (automationStatus.size === 0) {
    sections.push("  No structures tracked yet.");
  } else {
    for (const s of automationStatus.values()) {
      const errs = s.errors.length > 0 ? ` | ERRORS: ${s.errors[0]}` : "";
      sections.push(
        `  ${s.name} | lv${s.level} | build ${s.buildOrderProgress} | Wheat: ${formatBalance(s.wheatBalance)}, Essence: ${formatBalance(s.essenceBalance)}${errs}`,
      );
    }
  }
  sections.push("</structures>");

  // Armies from map snapshot
  sections.push("<armies>");
  const snapshot = mapCtx.snapshot;
  if (!snapshot || !snapshot.explorerDetails || snapshot.explorerDetails.size === 0) {
    sections.push("  No armies visible.");
  } else {
    for (const [entityId, info] of snapshot.explorerDetails) {
      // Find tile position for this explorer
      const tile = snapshot.tiles.find((t) => t.occupierId === entityId);
      if (!tile) continue;
      const pos = `${tile.row ?? "?"}:${tile.col ?? "?"}`;
      const troops = info.troops ?? [];
      const troopStr = troops.length > 0
        ? troops.map((t: any) => `${t.count?.toLocaleString() ?? "?"} ${t.name ?? "troops"}`).join(", ")
        : "unknown troops";
      const stam = info.stamina != null ? ` | stamina ${info.stamina}` : "";
      sections.push(`  ${pos} | ${troopStr}${stam}`);
    }
  }
  sections.push("</armies>");

  // Automation
  sections.push("<automation>");
  if (automationStatus.size === 0) {
    sections.push("  No automation data yet.");
  } else {
    for (const s of automationStatus.values()) {
      const parts: string[] = [];
      if (s.lastBuilt.length > 0) parts.push(`built ${s.lastBuilt.join(", ")}`);
      if (s.lastUpgrade) parts.push(`upgraded ${s.lastUpgrade}`);
      if (s.produced) parts.push("production ran");
      if (parts.length === 0) parts.push("idle");
      sections.push(`  ${s.name}: ${parts.join(", ")}`);
    }
  }
  sections.push("</automation>");

  // Tool errors
  if (toolErrors.length > 0) {
    sections.push("<tool_errors>");
    const grouped = new Map<string, { count: number; lastError: string }>();
    for (const e of toolErrors) {
      const entry = grouped.get(e.tool);
      if (entry) {
        entry.count++;
        entry.lastError = e.error;
      } else {
        grouped.set(e.tool, { count: 1, lastError: e.error });
      }
    }
    for (const [tool, { count, lastError }] of grouped) {
      sections.push(`  ${tool} ${count}x: ${lastError}`);
    }
    sections.push("</tool_errors>");
  }

  sections.push("</game_state>");
  return sections.join("\n");
}
```

- [ ] **Step 2: Run tests**

Run: `pnpm test -- dev/test/entry/game-state.test.ts`
Expected: All 3 tests pass

- [ ] **Step 3: Commit**

```bash
git add src/entry/game-state.ts dev/test/entry/game-state.test.ts
git commit -m "feat: buildGameStateBlock for injecting live state into system prompt"
```

---

## Chunk 3: Threat Detection

### Task 6: Write failing tests for detectThreats

**Files:**
- Create: `dev/test/map/threat-detection.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from "vitest";
import { detectThreats, type ThreatAlert } from "../../../src/map/threat-detection.js";

// Minimal tile shape matching what the snapshot provides
function makeTile(x: number, y: number, occupierId: number, occupierType: number, isOwned: boolean) {
  return { x, y, occupierId, occupierType, occupierIsStructure: occupierType >= 1 && occupierType <= 6, isOwned };
}

describe("detectThreats", () => {
  it("returns empty when no enemies near structures", () => {
    const ownedStructures = [makeTile(10, 10, 1, 1, true)]; // realm at 10,10
    const allTiles = [makeTile(10, 10, 1, 1, true), makeTile(12, 12, 2, 33, false)]; // enemy far away
    const alerts = detectThreats(ownedStructures, allTiles, new Set());
    expect(alerts).toHaveLength(0);
  });

  it("detects enemy army adjacent to owned structure", () => {
    const ownedStructures = [makeTile(10, 10, 1, 1, true)];
    const allTiles = [
      makeTile(10, 10, 1, 1, true),
      makeTile(11, 10, 99, 33, false), // enemy explorer adjacent
    ];
    const alerts = detectThreats(ownedStructures, allTiles, new Set());
    expect(alerts).toHaveLength(1);
    expect(alerts[0].enemyX).toBe(11);
    expect(alerts[0].enemyY).toBe(10);
  });

  it("skips already-alerted positions", () => {
    const ownedStructures = [makeTile(10, 10, 1, 1, true)];
    const allTiles = [
      makeTile(10, 10, 1, 1, true),
      makeTile(11, 10, 99, 33, false),
    ];
    const recentAlerts = new Set(["11,10"]);
    const alerts = detectThreats(ownedStructures, allTiles, recentAlerts);
    expect(alerts).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- dev/test/map/threat-detection.test.ts`
Expected: FAIL — module not found

### Task 7: Implement detectThreats

**Files:**
- Create: `src/map/threat-detection.ts`

- [ ] **Step 1: Implement**

```typescript
import { getNeighborHexes } from "@bibliothecadao/types";

export interface ThreatAlert {
  enemyX: number;
  enemyY: number;
  enemyEntityId: number;
  structureX: number;
  structureY: number;
  structureEntityId: number;
}

interface TileInput {
  x: number;
  y: number;
  occupierId: number;
  occupierType: number;
  isOwned?: boolean;
}

function isExplorerType(type: number): boolean {
  return type >= 30 && type <= 35;
}

/**
 * Scan for enemy armies within 1 hex of any owned structure.
 *
 * @param ownedStructures - Tiles with owned structures.
 * @param allTiles - All explored tiles.
 * @param recentAlerts - Set of "x,y" keys for recently alerted positions (skip these).
 * @returns New threat alerts not in the recent set.
 */
export function detectThreats(
  ownedStructures: TileInput[],
  allTiles: TileInput[],
  recentAlerts: Set<string>,
): ThreatAlert[] {
  const tileIndex = new Map<string, TileInput>();
  for (const t of allTiles) {
    tileIndex.set(`${t.x},${t.y}`, t);
  }

  const alerts: ThreatAlert[] = [];

  for (const structure of ownedStructures) {
    const neighbors = getNeighborHexes(structure.x, structure.y);
    for (const n of neighbors) {
      const key = `${n.col},${n.row}`;
      if (recentAlerts.has(key)) continue;

      const tile = tileIndex.get(key);
      if (!tile) continue;
      if (tile.occupierId <= 0) continue;
      if (tile.isOwned) continue;
      if (!isExplorerType(tile.occupierType)) continue;

      alerts.push({
        enemyX: tile.x,
        enemyY: tile.y,
        enemyEntityId: tile.occupierId,
        structureX: structure.x,
        structureY: structure.y,
        structureEntityId: structure.occupierId,
      });
    }
  }

  return alerts;
}
```

- [ ] **Step 2: Run tests**

Run: `pnpm test -- dev/test/map/threat-detection.test.ts`
Expected: All 3 pass

- [ ] **Step 3: Commit**

```bash
git add src/map/threat-detection.ts dev/test/map/threat-detection.test.ts
git commit -m "feat: threat detection for enemy armies near owned structures"
```

---

## Chunk 4: Wire Everything into main.ts

### Task 8: Add onThreat callback to map loop

**Files:**
- Modify: `src/map/loop.ts`

- [ ] **Step 1: Accept onThreat callback in createMapLoop**

Add optional `onThreat?: (alerts: ThreatAlert[]) => void` parameter. After `ctx.snapshot = snapshot`, run threat detection:

```typescript
import { detectThreats, type ThreatAlert } from "./threat-detection.js";

// After ctx.snapshot = snapshot:
if (onThreat) {
  const ownedStructures = snapshot.tiles.filter(
    (t) => t.occupierId > 0 && ownedEntityIds?.has(t.occupierId) && t.occupierIsStructure,
  );
  const alerts = detectThreats(ownedStructures, snapshot.tiles, recentThreatAlerts);
  if (alerts.length > 0) {
    for (const a of alerts) {
      recentThreatAlerts.add(`${a.enemyX},${a.enemyY}`);
      setTimeout(() => recentThreatAlerts.delete(`${a.enemyX},${a.enemyY}`), 60_000);
    }
    onThreat(alerts);
  }
}
```

Add `const recentThreatAlerts = new Set<string>();` at the top of `createMapLoop`.

- [ ] **Step 2: Run tests**

Run: `pnpm test`
Expected: All 220 pass (existing tests don't pass onThreat)

- [ ] **Step 3: Commit**

```bash
git add src/map/loop.ts
git commit -m "feat: map loop runs threat detection and fires onThreat callback"
```

### Task 9: Wire game state, tool errors, threats, and compaction into main.ts

**Files:**
- Modify: `src/entry/main.ts`

- [ ] **Step 1: Import new modules**

```typescript
import { buildGameStateBlock } from "./game-state.js";
import type { AutomationStatusMap } from "../automation/status.js";
import type { ThreatAlert } from "../map/threat-detection.js";
```

- [ ] **Step 2: Create shared state objects**

After the `txCtx` declaration:

```typescript
const automationStatus: AutomationStatusMap = new Map();
const toolErrors: Array<{ tool: string; error: string; tick: number }> = [];
```

- [ ] **Step 3: Update transformContext to inject game state**

Replace the existing `transformContext`:

```typescript
transformContext: async (messages) => {
  const gameState = buildGameStateBlock(mapCtx, automationStatus, toolErrors);
  agent.setSystemPrompt(buildSystemPrompt(config.dataDir) + "\n\n" + gameState);

  // Token-aware compaction
  const maxChars = (model.contextWindow ?? 200_000) * 3;
  const pruneTarget = Math.floor(maxChars * 0.5);
  return pruneMessages(messages, model, maxChars, pruneTarget);
},
```

- [ ] **Step 4: Update pruneMessages to accept thresholds**

Change the function signature:

```typescript
async function pruneMessages(
  messages: AgentMessage[],
  model: Model<any>,
  maxChars: number = MAX_CONTEXT_CHARS,
  pruneTarget: number = PRUNE_TARGET_CHARS,
): Promise<AgentMessage[]> {
```

And update `splitMessages` to accept `pruneTarget`:

```typescript
function splitMessages(messages: AgentMessage[], target: number): ...
```

Remove the hardcoded constants at the top (keep them as fallback defaults in the function signature).

- [ ] **Step 5: Track tool errors in subscribe handler**

In the `tool_execution_end` case:

```typescript
case "tool_execution_end": {
  // ... existing logging ...
  if (event.isError) {
    const errorText = event.result?.content
      ?.filter((b: any) => b.type === "text")
      ?.map((b: any) => b.text)
      ?.join("")
      ?.slice(0, 100) ?? "unknown error";
    toolErrors.push({ tool: event.toolName, error: errorText, tick: tickCount });
    // Keep last 20 errors
    while (toolErrors.length > 20) toolErrors.shift();
  }
  break;
}
```

- [ ] **Step 6: Pass automationStatus to createAutomationLoop**

```typescript
const automationLoop = createAutomationLoop(
  client, provider, account, account.address,
  config.dataDir, mapCtx, gameConfig, automationStatus,
);
```

- [ ] **Step 7: Wire threat detection into map loop**

```typescript
const mapLoop = createMapLoop(client, mapCtx, account.address, undefined, gameConfig.stamina, (alerts) => {
  for (const alert of alerts) {
    const msg = `DEFENSIVE ALERT: Enemy army detected at ${alert.enemyX}:${alert.enemyY}, adjacent to your structure at ${alert.structureX}:${alert.structureY}. Assess threat and respond.`;
    console.log(`[THREAT] ${msg}`);
    agent.steer({ role: "user", content: msg, timestamp: Date.now() } as AgentMessage);
  }
});
```

- [ ] **Step 8: Run all tests**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 9: Commit**

```bash
git add src/entry/main.ts src/entry/game-state.ts src/automation/loop.ts src/automation/status.ts src/map/loop.ts
git commit -m "feat: wire game state injection, threat steering, tool tracking, token-aware compaction"
```

---

## Chunk 5: Integration Test

### Task 10: Manual smoke test

- [ ] **Step 1: Run the agent**

```bash
pnpm dev
```

Expected output includes:
- `<game_state>` block visible if you inspect the system prompt (add temporary `console.log` in `transformContext`)
- `[THREAT]` log lines if enemies are near structures
- Tool errors appear in subsequent turns' system prompt
- No `[AGENT] model error` on first tick

- [ ] **Step 2: Clean up and final commit**

```bash
pnpm test
git add -A
git commit -m "chore: agent intelligence improvements complete"
git push
```
