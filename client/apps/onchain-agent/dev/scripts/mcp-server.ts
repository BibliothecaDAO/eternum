/**
 * MCP server exposing the full Eternum agent toolkit.
 *
 * Connects to Torii, authenticates with Cartridge, starts the map loop,
 * and exposes all game tools + map protocol as native MCP tools that
 * Claude Code can call directly.
 *
 * Setup:
 *   claude mcp add eternum -- npx tsx client/apps/onchain-agent/dev/scripts/mcp-server.ts
 *
 * Requires .env in client/apps/onchain-agent/ with at minimum:
 *   CHAIN=slot
 *   WORLD_NAME=<world>
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { EternumClient } from "@bibliothecadao/client";
import { EternumProvider } from "@bibliothecadao/provider";
import { homedir } from "node:os";
import { join } from "node:path";

import { existsSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from the onchain-agent directory (not cwd) so this works
// regardless of where Claude Code launches the MCP server from.
{
  const agentDir = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const envPath = join(agentDir, ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
        value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

import { loadConfig } from "../../src/entry/config.js";
import { getManifest } from "../../src/auth/embedded-data.js";
import { discoverWorld, patchManifest } from "../../src/world/discovery.js";
import { getAccount } from "../../src/auth/session.js";
import { createMapLoop } from "../../src/map/loop.js";
import { createAutomationLoop } from "../../src/automation/loop.js";
import type { AutomationStatusMap } from "../../src/automation/status.js";
import type { MapContext } from "../../src/map/context.js";
import type { TxContext } from "../../src/tools/tx-context.js";
import { extractTxError, addressesEqual } from "../../src/tools/tx-context.js";
import { directionBetween } from "../../src/world/pathfinding.js";
import { findPathNative, gridIndexFromSnapshot, buildH3TileIndex, applyMapOverlays } from "../../src/world/pathfinding_v2.js";
import { isExplorer, isStructure, isChest } from "../../src/world/occupier.js";
import { calculateStrength, calculateGuardStrength } from "../../src/world/strength.js";
import { projectExplorerStamina } from "../../src/world/stamina.js";
import { simulateCombat } from "../../src/world/combat.js";
import { createMapProtocol } from "../../src/map/protocol.js";
import { packTileSeed, getNeighborHexes, Direction, BiomeIdToType, RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { GameConfig, StaminaConfig } from "@bibliothecadao/torii";

// ── Redirect ALL console output to stderr ──
// MCP protocol owns stdout. Any stray console.log (e.g. Cartridge SDK
// printing an auth URL) would corrupt the JSON-RPC stream. Redirect
// everything to stderr so auth URLs appear in the MCP server logs.
{
  const _warn = console.warn;
  const _error = console.error;
  const providerNoise = (msg: string) =>
    msg.includes("[provider]") || msg.includes("Failed to estimate") || msg.includes("Insufficient transaction");
  const toStderr = (...a: any[]) => process.stderr.write(a.map(String).join(" ") + "\n");
  console.log = toStderr;
  console.info = toStderr;
  console.debug = toStderr;
  console.warn = (...a: any[]) => { if (!providerNoise(String(a[0]))) toStderr(...a); };
  console.error = (...a: any[]) => { if (!providerNoise(String(a[0]))) toStderr(...a); };
}

/** Log to stderr with `[eternum-mcp]` prefix. MCP owns stdout. */
const log = (msg: string) => process.stderr.write(`[eternum-mcp] ${msg}\n`);

/**
 * Main entry point. Registers all MCP tools, connects the stdio transport
 * (completing the handshake immediately), then bootstraps the game connection
 * in the background. Tools return "not ready" until bootstrap completes.
 *
 * Architecture:
 *   1. Register tools (with readiness gates)
 *   2. Connect MCP transport (handshake completes instantly)
 *   3. Bootstrap: discover world → authenticate → load config → start map loop
 *   4. Tools become operational
 */
async function main() {
  log("Starting...");

  // ── Mutable state — filled by background bootstrap ──
  let client: EternumClient | null = null;
  let provider: EternumProvider | null = null;
  let account: any = null;
  let playerAddress = "";
  let gameConfig: GameConfig | null = null;
  const BASE_MAP_CENTER = 2147483646;
  let mapCenter = BASE_MAP_CENTER; // updated during bootstrap with map_center_offset
  let donkeyCapacityGrams = 50_000; // updated during bootstrap
  const resourceWeightGrams = new Map<number, number>(); // resource ID → grams per unit

  /** Convert raw contract X coordinate to small display coordinate. */
  const toDisplayX = (raw: number) => raw - mapCenter;
  /** Convert raw contract Y coordinate to small display coordinate (negated: positive = north). */
  const toDisplayY = (raw: number) => -(raw - mapCenter);
  /** Convert small display X coordinate to raw contract coordinate. */
  const toContractX = (display: number) => display + mapCenter;
  /** Convert small display Y coordinate to raw contract coordinate (negated back). */
  const toContractY = (display: number) => -display + mapCenter;
  /** Shorthand for action tools that convert display input to raw. */
  const toContract = toContractX;
  const toDisplay = toDisplayX;
  const mapCtx: MapContext = { snapshot: null, protocol: null, filePath: null };
  const automationStatus: AutomationStatusMap = new Map();
  let automationLoop: ReturnType<typeof createAutomationLoop> | null = null;
  let automationRunning = false;
  let bootstrapDone = false;
  let bootstrapError: string | null = null;
  let bootstrapPhase = "starting";
  let authUrl: string | null = null;

  /** Return an error string if the server isn't ready, or null if good to go. */
  const notReady = (): string | null => {
    if (bootstrapError) return `Server failed to start: ${bootstrapError}`;
    if (!bootstrapDone) {
      if (authUrl) return `Waiting for authentication. [Click here to login](${authUrl}), then retry.`;
      return `Server is ${bootstrapPhase}. Please wait a moment and retry.`;
    }
    return null;
  };

  // ── MCP Server + Tool Registration ──
  // Register tools BEFORE connecting the transport so the handshake
  // completes immediately. Tools gate on notReady() / mapCtx checks.
  //
  // Tools (22):
  //   Status:     status
  //   Map:        map_tile_info, map_nearby, map_entity_info, map_find, map_briefing
  //   Automation: automation
  //   Movement:   move_army
  //   Combat:     simulate_attack, attack_target, attack_from_guard, raid_target
  //   Army Mgmt:  create_army, open_chest
  //   Resources:  send_resources
  //   Guards:     guard_from_storage, guard_from_army, reinforce_army,
  //               transfer_troops, unguard_to_army
  //   Transfers:  transfer_to_structure, transfer_to_army
  //   Buffs:      apply_relic
  const server = new McpServer({ name: "eternum", version: "1.0.0" });

  // ── Status Tool (always works, even before bootstrap) ──

  server.tool(
    "status",
    "Check server status. If not authenticated yet, returns a login link. Call this first.",
    {},
    async () => {
      if (bootstrapError) return { content: [{ type: "text", text: `Failed: ${bootstrapError}` }], isError: true };
      if (authUrl) {
        const { exec } = await import("node:child_process");
        exec(`echo ${JSON.stringify(authUrl)} | pbcopy`);
        return { content: [{ type: "text", text: "Auth URL copied to clipboard. Paste in your browser to login." }] };
      }
      if (!bootstrapDone) return { content: [{ type: "text", text: `Starting up (${bootstrapPhase})...` }] };
      return { content: [{ type: "text", text: `Ready. Account: ${playerAddress}` }] };
    },
  );

  // ── Map Protocol Tools ──
  // The protocol handles coordinate conversion (display ↔ raw) internally.
  // Tools pass display coords directly — small numbers like (6,-4).

  server.tool(
    "map_tile_info",
    "What's at this position? Full details: biome, entity, guards, resources, strength.",
    { x: z.coerce.number().describe("Map X coordinate"), y: z.coerce.number().describe("Map Y coordinate") },
    async ({ x, y }) => {
      if (!mapCtx.protocol) return { content: [{ type: "text", text: notReady() ?? "Map not loaded yet." }] };
      const r = await mapCtx.protocol.tileInfo(x, y);
      return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
    },
  );

  server.tool(
    "map_nearby",
    "What's around this position? Returns grouped lists: your armies, enemies, structures, chests.",
    {
      x: z.coerce.number().describe("Map X coordinate"),
      y: z.coerce.number().describe("Map Y coordinate"),
      radius: z.coerce.number().optional().default(5).describe("Search radius in hexes"),
    },
    async ({ x, y, radius }) => {
      if (!mapCtx.protocol) return { content: [{ type: "text", text: notReady() ?? "Map not loaded yet." }] };
      const r = await mapCtx.protocol.nearby(x, y, radius);
      return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
    },
  );

  server.tool(
    "map_entity_info",
    "Full details on an entity by ID: troops, stamina, guards, resources, strength, owner.",
    { entity_id: z.coerce.number().describe("Entity ID") },
    async ({ entity_id }) => {
      if (!mapCtx.protocol) return { content: [{ type: "text", text: notReady() ?? "Map not loaded yet." }] };
      const r = await mapCtx.protocol.entityInfo(entity_id);
      if (!r) return { content: [{ type: "text", text: `Entity ${entity_id} not found.` }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
    },
  );

  server.tool(
    "map_find",
    "Find entities by type across the map. Types: hyperstructure, mine, village, chest, enemy_army, enemy_structure, own_army, own_structure. Sorted by distance from ref position.",
    {
      type: z.enum(["hyperstructure", "mine", "village", "chest", "enemy_army", "enemy_structure", "own_army", "own_structure"]),
      ref_x: z.coerce.number().optional().describe("Reference X for distance sorting"),
      ref_y: z.coerce.number().optional().describe("Reference Y for distance sorting"),
    },
    async ({ type, ref_x, ref_y }) => {
      if (!mapCtx.protocol) return { content: [{ type: "text", text: notReady() ?? "Map not loaded yet." }] };
      const ref = ref_x != null && ref_y != null ? { x: ref_x, y: ref_y } : undefined;
      const r = await mapCtx.protocol.find(type, ref);
      return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
    },
  );

  server.tool(
    "map_briefing",
    "Get the current game state briefing: your armies, structures, threats, opportunities.",
    {},
    async () => {
      if (!mapCtx.protocol) return { content: [{ type: "text", text: notReady() ?? "Map not loaded yet." }] };
      return { content: [{ type: "text", text: mapCtx.protocol.briefing() || "(No owned entities)" }] };
    },
  );

  // ── Automation Tools ──

  server.tool(
    "automation",
    "Toggle the background automation system (building, upgrading, production for all realms). " +
    "Use action='status' to check, 'start' to enable, 'stop' to disable.",
    { action: z.enum(["start", "stop", "status"]).describe("start, stop, or status") },
    async ({ action }) => {
      const err = notReady();
      if (err) return { content: [{ type: "text", text: err }] };

      if (action === "status") {
        const lines: string[] = [`Automation: ${automationRunning ? "RUNNING" : "STOPPED"}`];
        if (automationStatus.size > 0) {
          for (const s of automationStatus.values()) {
            const errs = s.errors.length > 0 ? ` | ERRORS: ${s.errors.join("; ")}` : "";
            const built = s.lastBuilt.length > 0 ? ` | built: ${s.lastBuilt.join(", ")}` : "";
            lines.push(`  ${s.name} | lv${s.level} | build ${s.buildOrderProgress} | Wheat: ${s.wheatBalance}, Essence: ${s.essenceBalance}${built}${errs}`);
          }
        } else {
          lines.push("  No realm data yet.");
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      }

      if (action === "start") {
        if (automationRunning) return { content: [{ type: "text", text: "Automation is already running." }] };
        automationLoop!.start();
        automationRunning = true;
        log("Automation started.");
        return { content: [{ type: "text", text: "Automation started. Building, upgrading, and production will run every 60s for all owned realms." }] };
      }

      if (action === "stop") {
        if (!automationRunning) return { content: [{ type: "text", text: "Automation is already stopped." }] };
        automationLoop!.stop();
        automationRunning = false;
        log("Automation stopped.");
        return { content: [{ type: "text", text: "Automation stopped." }] };
      }

      return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
    },
  );

  // ── Movement Tools ──

  server.tool(
    "move_army",
    "Move one of your armies to a target position. Pathfinds automatically. Explores unexplored tiles.",
    {
      army_id: z.coerce.number().describe("Entity ID of your army"),
      target_x: z.coerce.number().describe("Target map X"),
      target_y: z.coerce.number().describe("Target map Y"),
    },
    async ({ army_id, target_x: dispX, target_y: dispY }) => {
      const err = notReady();
      if (err) return { content: [{ type: "text", text: err }], isError: true };
      if (!mapCtx.snapshot) return { content: [{ type: "text", text: "Map not loaded yet." }], isError: true };

      // Convert display coords to raw for all internal operations
      const target_x = toContractX(dispX);
      const target_y = toContractY(dispY);

      const explorer = await client!.view.explorerInfo(army_id);
      if (!explorer) return { content: [{ type: "text", text: `Army ${army_id} not found.` }], isError: true };
      if (!addressesEqual(explorer.ownerAddress ?? "", playerAddress)) {
        return { content: [{ type: "text", text: `Army ${army_id} is not yours.` }], isError: true };
      }

      const target = { x: target_x, y: target_y };
      const start = explorer.position;
      if (start.x === target.x && start.y === target.y) {
        return { content: [{ type: "text", text: `Already at (${dispX},${dispY}).` }], isError: true };
      }

      const projectedStamina = projectExplorerStamina(explorer, gameConfig!.stamina);
      if (projectedStamina <= 0) {
        return { content: [{ type: "text", text: `No stamina (${projectedStamina}). Wait for regen.` }], isError: true };
      }

      // Build grid index from snapshot + inject unexplored tiles toward target.
      // Uses native offset hex A* — no H3 dependency, guaranteed correct adjacency.
      const snapshotGrid = mapCtx.snapshot.gridIndex;
      const syntheticTiles = new Map<string, number>(); // "x,y" → biome (1 = generic explored)

      // Inject unexplored tiles: BFS outward from explored frontier toward target
      {
        const explored = new Set<string>();
        for (const t of mapCtx.snapshot.tiles) {
          if (t.biome !== 0) explored.add(`${t.position.x},${t.position.y}`);
        }
        const { getNeighborHexes: getNbrs } = await import("@bibliothecadao/types");
        const maxDist = Math.abs(target_x - start.x) + Math.abs(target_y - start.y) + 5;
        const frontier = [...explored];
        for (let wave = 0; wave < maxDist && frontier.length > 0; wave++) {
          const next: string[] = [];
          for (const key of frontier) {
            const [fx, fy] = key.split(",").map(Number);
            for (const n of getNbrs(fx, fy)) {
              const nk = `${n.col},${n.row}`;
              if (explored.has(nk) || syntheticTiles.has(nk)) continue;
              syntheticTiles.set(nk, 1);
              next.push(nk);
            }
          }
          frontier.length = 0;
          frontier.push(...next);
          if (syntheticTiles.has(`${target_x},${target_y}`)) break;
        }
      }

      // Wrap snapshot + synthetic tiles into GridIndex
      const grid = gridIndexFromSnapshot(snapshotGrid);
      const augmentedGrid = {
        getBiome: (x: number, y: number) => {
          const b = grid.getBiome(x, y);
          if (b > 0) return b;
          return syntheticTiles.get(`${x},${y}`) ?? 0;
        },
        getOccupier: (x: number, y: number) => grid.getOccupier(x, y),
        has: (x: number, y: number) => grid.has(x, y) || syntheticTiles.has(`${x},${y}`),
        isSynthetic: (x: number, y: number) => syntheticTiles.has(`${x},${y}`),
      };
      // Unblock self position
      const selfKey = `${start.x},${start.y}`;
      const selfOccupier = grid.getOccupier(start.x, start.y);
      const gridForPath = {
        ...augmentedGrid,
        getOccupier: (x: number, y: number) => {
          if (x === start.x && y === start.y) return 0;
          return augmentedGrid.getOccupier(x, y);
        },
      };

      const staminaConfig = {
        gainPerTick: gameConfig!.stamina.gainPerTick,
        travelCost: gameConfig!.stamina.travelCost,
        exploreCost: gameConfig!.stamina.exploreCost,
        bonusValue: gameConfig!.stamina.bonusValue,
        maxKnight: gameConfig!.stamina.knightMaxStamina,
        maxPaladin: gameConfig!.stamina.paladinMaxStamina,
        maxCrossbowman: gameConfig!.stamina.crossbowmanMaxStamina,
      };

      const pathOptions = { troop: explorer.troopType as any, maxStamina: projectedStamina, staminaConfig };

      // Check if target is occupied — pathfind to adjacent instead
      const targetTile = snapshotGrid.get(`${target_x},${target_y}`);
      const targetIsOccupied = targetTile && targetTile.occupierType !== 0;

      let pathResult: any = null;
      if (targetIsOccupied) {
        const { getNeighborHexes: getNbrs } = await import("@bibliothecadao/types");
        const neighbors = getNbrs(target_x, target_y);
        for (const n of neighbors) {
          const adjKey = `${n.col},${n.row}`;
          const adjTile = snapshotGrid.get(adjKey);
          const inSynthetic = syntheticTiles.has(adjKey);
          if (!adjTile && !inSynthetic) continue;
          if (adjTile && adjTile.occupierType !== 0) continue;
          const candidate = findPathNative(start, { x: n.col, y: n.row }, gridForPath, pathOptions);
          if (candidate) {
            if (!pathResult || candidate.staminaCost < pathResult.staminaCost) pathResult = candidate;
          }
        }
        if (!pathResult) return { content: [{ type: "text", text: `No path to any tile adjacent to (${dispX},${dispY}).` }], isError: true };
      } else {
        pathResult = findPathNative(start, target, gridForPath, pathOptions);
      }

      if (!pathResult) return { content: [{ type: "text", text: `No path to (${dispX},${dispY}).` }], isError: true };

      // If path exceeds stamina budget, truncate to what we can afford
      if (pathResult.reachedLimit && projectedStamina > 0) {
        let cost = 0;
        let truncateAt = 0;
        for (let i = 0; i < pathResult.directions.length; i++) {
          const stepPos = pathResult.path[i + 1];
          const stepKey = `${stepPos.x},${stepPos.y}`;
          const isExplore = !(mapCtx.snapshot.gridIndex.get(stepKey)?.biome);
          const stepCost = isExplore ? (staminaConfig.exploreCost || 30) : (staminaConfig.travelCost || 20);
          if (cost + stepCost > projectedStamina) break;
          cost += stepCost;
          truncateAt = i + 1;
        }
        if (truncateAt === 0) {
          return { content: [{ type: "text", text: `Not enough stamina (${projectedStamina}) for even 1 step. Need ${staminaConfig.exploreCost || 30}.` }], isError: true };
        }
        pathResult = {
          ...pathResult,
          path: pathResult.path.slice(0, truncateAt + 1),
          directions: pathResult.directions.slice(0, truncateAt),
          distance: truncateAt,
          staminaCost: cost,
          reachedLimit: true,
        };
      }

      // Build explored set for segment splitting
      const explored = new Set<string>();
      for (const t of mapCtx.snapshot.tiles) { if (t.biome !== 0) explored.add(`${t.position.x},${t.position.y}`); }

      // Execute movement segments — track progress so partial moves report correctly
      let exploreCount = 0;
      let travelCount = 0;
      let lastReachedIdx = 0; // index into pathResult.path of last confirmed position
      let stoppedEarly = false;
      let stopReason = "";

      let segStart = 0;
      while (segStart < pathResult.directions.length) {
        const nextPos = pathResult.path[segStart + 1];
        const nextKey = `${nextPos.x},${nextPos.y}`;
        const isUnexplored = !explored.has(nextKey);

        try {
          if (!isUnexplored) {
            let segEnd = segStart + 1;
            while (segEnd < pathResult.directions.length) {
              const futurePos = pathResult.path[segEnd + 1];
              if (!explored.has(`${futurePos.x},${futurePos.y}`)) break;
              segEnd++;
            }
            await provider!.explorer_travel({ explorer_id: army_id, directions: pathResult.directions.slice(segStart, segEnd), signer: account });
            travelCount += segEnd - segStart;
            lastReachedIdx = segEnd;
            segStart = segEnd;
          } else {
            const dir = pathResult.directions[segStart];
            const vrf_source_salt = packTileSeed({ alt: false, col: nextPos.x, row: nextPos.y });
            try {
              await provider!.explorer_explore({ explorer_id: army_id, directions: [dir], signer: account, vrf_source_salt });
              exploreCount++;
            } catch (err: any) {
              if (extractTxError(err).includes("already explored")) {
                await provider!.explorer_travel({ explorer_id: army_id, directions: [dir], signer: account });
                travelCount++;
              } else throw err;
            }
            lastReachedIdx = segStart + 1;
            segStart++;
          }
        } catch (err: any) {
          stoppedEarly = true;
          stopReason = extractTxError(err);
          break;
        }
      }

      const totalSteps = exploreCount + travelCount;
      const endPos = pathResult.path[lastReachedIdx];
      const stepsDetail = exploreCount > 0 && travelCount > 0
        ? `${totalSteps} steps (${exploreCount} explored, ${travelCount} traveled)`
        : exploreCount > 0
        ? `${totalSteps} steps (all explored)`
        : `${totalSteps} steps (all traveled)`;

      if (totalSteps === 0 && stoppedEarly) {
        return { content: [{ type: "text", text: `Move failed: ${stopReason}` }], isError: true };
      }

      let msg = `Moved ${stepsDetail} to (${toDisplayX(endPos.x)},${toDisplayY(endPos.y)}).`;
      if (stoppedEarly) {
        const remaining = pathResult.directions.length - lastReachedIdx;
        msg += ` Ran out of stamina — ${remaining} steps remaining to target.`;
      }
      return { content: [{ type: "text", text: msg }] };
    },
  );

  // ── Combat Tools ──

  server.tool(
    "simulate_attack",
    "Preview a battle outcome WITHOUT executing it. Shows predicted casualties, winner, and biome advantage. " +
    "Use this before attack_target to decide whether to commit. " +
    "NOTE: Larger armies are disproportionately stronger due to combat scaling.",
    {
      army_id: z.coerce.number().describe("Entity ID of your army"),
      target_x: z.coerce.number().describe("Target map X"),
      target_y: z.coerce.number().describe("Target map Y"),
    },
    async ({ army_id, target_x: dispX, target_y: dispY }) => {
      const err = notReady();
      if (err) return { content: [{ type: "text", text: err }], isError: true };

      const target_x = toContractX(dispX);
      const target_y = toContractY(dispY);

      const explorer = await client!.view.explorerInfo(army_id);
      if (!explorer) return { content: [{ type: "text", text: `Army ${army_id} not found.` }], isError: true };

      const projectedStamina = projectExplorerStamina(explorer, gameConfig!.stamina);
      const tile = mapCtx.snapshot?.gridIndex.get(`${target_x},${target_y}`);
      if (!tile || tile.occupierType === 0) {
        return { content: [{ type: "text", text: `Nothing to attack at (${dispX},${dispY}).` }], isError: true };
      }

      const attackerInput = {
        troopCount: explorer.troopCount,
        troopType: explorer.troopType,
        troopTier: explorer.troopTier,
        stamina: projectedStamina,
      };

      let defenderInput: { troopCount: number; troopType: string; troopTier: string; stamina: number } | null = null;
      let defenderLabel = "target";

      if (isExplorer(tile.occupierType)) {
        const defExplorer = await client!.view.explorerInfo(tile.occupierId);
        if (defExplorer) {
          const defStamina = projectExplorerStamina(defExplorer, gameConfig!.stamina);
          defenderInput = { troopCount: defExplorer.troopCount, troopType: defExplorer.troopType, troopTier: defExplorer.troopTier, stamina: defStamina };
          defenderLabel = `${defExplorer.troopCount.toLocaleString()} ${defExplorer.troopType} ${defExplorer.troopTier}`;
        }
      } else if (isStructure(tile.occupierType)) {
        const structure = await client!.view.structureAt(target_x, target_y);
        if (structure) {
          const guard = structure.guards?.find((g: any) => g.count > 0);
          if (guard) {
            defenderInput = { troopCount: guard.count, troopType: guard.troopType, troopTier: guard.troopTier, stamina: 100 };
            defenderLabel = `${guard.count.toLocaleString()} ${guard.troopType} ${guard.troopTier}`;
          } else {
            return { content: [{ type: "text", text: `${structure.category} at (${dispX},${dispY}) is unguarded — free capture.` }] };
          }
        }
      }

      if (!defenderInput || defenderInput.troopCount <= 0) {
        return { content: [{ type: "text", text: `No troops to fight at (${dispX},${dispY}).` }] };
      }

      const simResult = simulateCombat(attackerInput, defenderInput, tile.biome);

      const lines = [
        `SIMULATION — ${simResult.winner === "attacker" ? "YOU WIN" : simResult.winner === "defender" ? "YOU LOSE" : "DRAW"}`,
        `  Your ${explorer.troopCount.toLocaleString()} ${explorer.troopType} ${explorer.troopTier} vs ${defenderLabel}`,
        `  Biome: ${simResult.biomeAdvantage}`,
        `  Your casualties: ${simResult.attackerCasualties.toLocaleString()} | Surviving: ${simResult.attackerSurviving.toLocaleString()}`,
        `  Enemy casualties: ${simResult.defenderCasualties.toLocaleString()} | Surviving: ${simResult.defenderSurviving.toLocaleString()}`,
      ];

      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  server.tool(
    "attack_target",
    "Attack a target adjacent to your army. Reports battle outcome including casualties. " +
    "NOTE: Larger armies are disproportionately stronger due to combat scaling — always attack with your biggest army. " +
    "Use simulate_attack first to preview the outcome before committing.",
    {
      army_id: z.coerce.number().describe("Entity ID of your army"),
      target_x: z.coerce.number().describe("Target map X"),
      target_y: z.coerce.number().describe("Target map Y"),
    },
    async ({ army_id, target_x: dispX, target_y: dispY }) => {
      const err = notReady();
      if (err) return { content: [{ type: "text", text: err }], isError: true };

      const target_x = toContractX(dispX);
      const target_y = toContractY(dispY);

      const explorer = await client!.view.explorerInfo(army_id);
      if (!explorer) return { content: [{ type: "text", text: `Army ${army_id} not found.` }], isError: true };
      if (!addressesEqual(explorer.ownerAddress ?? "", playerAddress)) {
        return { content: [{ type: "text", text: `Army ${army_id} is not yours.` }], isError: true };
      }

      const projectedStamina = projectExplorerStamina(explorer, gameConfig!.stamina);
      const targetHex = { x: target_x, y: target_y };
      const direction = directionBetween(explorer.position, targetHex);
      if (direction === null) {
        return { content: [{ type: "text", text: `Army not adjacent to (${dispX},${dispY}). Move first.` }], isError: true };
      }

      const tile = mapCtx.snapshot?.gridIndex.get(`${target_x},${target_y}`);
      if (!tile || tile.occupierType === 0) {
        return { content: [{ type: "text", text: `Nothing to attack at (${dispX},${dispY}).` }], isError: true };
      }

      // Build attacker input for simulation
      const attackerInput = {
        troopCount: explorer.troopCount,
        troopType: explorer.troopType,
        troopTier: explorer.troopTier,
        stamina: projectedStamina,
      };

      // Build defender input — explorer or structure guard
      let defenderInput: { troopCount: number; troopType: string; troopTier: string; stamina: number } | null = null;
      let isStructureTarget = false;

      if (isExplorer(tile.occupierType)) {
        const defExplorer = await client!.view.explorerInfo(tile.occupierId);
        if (defExplorer) {
          const defStamina = projectExplorerStamina(defExplorer, gameConfig!.stamina);
          defenderInput = { troopCount: defExplorer.troopCount, troopType: defExplorer.troopType, troopTier: defExplorer.troopTier, stamina: defStamina };
        }
      } else if (isStructure(tile.occupierType)) {
        isStructureTarget = true;
        const structure = await client!.view.structureAt(target_x, target_y);
        if (structure) {
          const guard = structure.guards?.find((g: any) => g.count > 0);
          if (guard) {
            defenderInput = { troopCount: guard.count, troopType: guard.troopType, troopTier: guard.troopTier, stamina: 100 };
          }
        }
      }

      // Simulate the battle
      let simResult: ReturnType<typeof simulateCombat> | null = null;
      if (defenderInput && defenderInput.troopCount > 0) {
        simResult = simulateCombat(attackerInput, defenderInput, tile.biome);
      }

      // Execute the attack
      try {
        if (isExplorer(tile.occupierType)) {
          await provider!.attack_explorer_vs_explorer({ aggressor_id: army_id, defender_id: tile.occupierId, defender_direction: direction, steal_resources: [], signer: account });
        } else if (isStructureTarget) {
          const structure = await client!.view.structureAt(target_x, target_y);
          if (!structure) return { content: [{ type: "text", text: "Structure not found." }], isError: true };
          await provider!.attack_explorer_vs_guard({ explorer_id: army_id, structure_id: structure.entityId, structure_direction: direction, signer: account });
        }
      } catch (err: any) {
        return { content: [{ type: "text", text: `Attack failed: ${extractTxError(err)}` }], isError: true };
      }

      // Report outcome from simulation (deterministic — matches on-chain)
      if (!simResult) {
        // Unguarded — free capture
        return { content: [{ type: "text", text: `Captured unguarded ${isStructureTarget ? "structure" : "target"} at (${dispX},${dispY}). ${explorer.troopCount.toLocaleString()} troops intact.` }] };
      }

      const lines = [
        `Battle at (${dispX},${dispY}) — ${simResult.winner === "attacker" ? "VICTORY" : simResult.winner === "defender" ? "DEFEAT" : "DRAW"}`,
        `  Your ${explorer.troopCount.toLocaleString()} ${explorer.troopType} ${explorer.troopTier} vs ${defenderInput!.troopCount.toLocaleString()} ${defenderInput!.troopType} ${defenderInput!.troopTier}`,
        `  Biome: ${simResult.biomeAdvantage}`,
        `  Your casualties: ${simResult.attackerCasualties.toLocaleString()} | Surviving: ${simResult.attackerSurviving.toLocaleString()}`,
        `  Enemy casualties: ${simResult.defenderCasualties.toLocaleString()} | Surviving: ${simResult.defenderSurviving.toLocaleString()}`,
      ];
      if (simResult.winner === "attacker" && isStructureTarget && simResult.defenderSurviving <= 0) {
        lines.push(`  Structure captured!`);
      }
      if (simResult.winner === "defender") {
        lines.push(`  Your army was destroyed.`);
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  server.tool(
    "attack_from_guard",
    "Attack an adjacent enemy army using your structure's guards. Defensive strike — no army needed. " +
    "NOTE: Larger groups in one slot are disproportionately stronger.",
    {
      structure_id: z.coerce.number().describe("Entity ID of your structure"),
      slot: z.coerce.number().min(0).max(3).describe("Guard slot to attack with (0=Alpha, 1=Bravo, 2=Charlie, 3=Delta)"),
      target_army_id: z.coerce.number().describe("Entity ID of the enemy army to attack"),
    },
    async ({ structure_id, slot, target_army_id }) => {
      const err = notReady();
      if (err) return { content: [{ type: "text", text: err }], isError: true };

      // Find structure position
      let structPos: { x: number; y: number } | null = null;
      for (const t of mapCtx.snapshot?.tiles ?? []) {
        if (t.occupierId === structure_id) { structPos = t.position; break; }
      }
      if (!structPos) return { content: [{ type: "text", text: `Structure ${structure_id} not found.` }], isError: true };

      const targetExplorer = await client!.view.explorerInfo(target_army_id);
      if (!targetExplorer) return { content: [{ type: "text", text: `Enemy army ${target_army_id} not found.` }], isError: true };

      const direction = directionBetween(structPos, targetExplorer.position);
      if (direction === null) {
        return { content: [{ type: "text", text: `Enemy army is not adjacent to structure. ` }], isError: true };
      }

      // Simulate: get guard info for this slot
      const structInfo = await client!.view.structureAt(structPos.x, structPos.y);
      const slotNames = ["Alpha", "Bravo", "Charlie", "Delta"];
      const guard = structInfo?.guards?.find((g: any) => g.slot === slotNames[slot]);
      const tile = mapCtx.snapshot?.gridIndex.get(`${structPos.x},${structPos.y}`);
      const biome = tile?.biome ?? 0;

      let simResult: ReturnType<typeof simulateCombat> | null = null;
      if (guard && guard.count > 0) {
        const defStamina = projectExplorerStamina(targetExplorer, gameConfig!.stamina);
        simResult = simulateCombat(
          { troopCount: guard.count, troopType: guard.troopType, troopTier: guard.troopTier, stamina: 100 },
          { troopCount: targetExplorer.troopCount, troopType: targetExplorer.troopType, troopTier: targetExplorer.troopTier, stamina: defStamina },
          biome,
        );
      }

      try {
        await provider!.attack_guard_vs_explorer({
          structure_id,
          structure_guard_slot: slot,
          explorer_id: target_army_id,
          explorer_direction: direction,
          signer: account,
        });
      } catch (err: any) {
        return { content: [{ type: "text", text: `Attack failed: ${extractTxError(err)}` }], isError: true };
      }

      if (!simResult) {
        return { content: [{ type: "text", text: `Attacked enemy army ${target_army_id} from ${slotNames[slot]} guard.` }] };
      }

      const lines = [
        `Guard attack — ${simResult.winner === "attacker" ? "VICTORY" : simResult.winner === "defender" ? "DEFEAT" : "DRAW"}`,
        `  Your ${guard!.count.toLocaleString()} ${guard!.troopType} ${guard!.troopTier} (${slotNames[slot]}) vs ${targetExplorer.troopCount.toLocaleString()} ${targetExplorer.troopType} ${targetExplorer.troopTier}`,
        `  Your casualties: ${simResult.attackerCasualties.toLocaleString()} | Surviving: ${simResult.attackerSurviving.toLocaleString()}`,
        `  Enemy casualties: ${simResult.defenderCasualties.toLocaleString()} | Surviving: ${simResult.defenderSurviving.toLocaleString()}`,
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  server.tool(
    "raid_target",
    "Raid an adjacent structure for resources. Deals only 10% of normal battle damage but can steal loot on success. " +
    "Success if your damage > 2x defender's, fail if < 0.5x, chance-based in between. " +
    "NOTE: Larger armies are disproportionately stronger.",
    {
      army_id: z.coerce.number().describe("Entity ID of your raiding army"),
      target_x: z.coerce.number().describe("Target structure map X"),
      target_y: z.coerce.number().describe("Target structure map Y"),
      steal_resources: z.array(z.object({
        resource_id: z.coerce.number().describe("Resource type ID to steal"),
        amount: z.coerce.number().describe("Amount to steal (human-readable)"),
      })).optional().default([]).describe("Resources to steal on success"),
    },
    async ({ army_id, target_x: dispX, target_y: dispY, steal_resources: stealList }) => {
      const err = notReady();
      if (err) return { content: [{ type: "text", text: err }], isError: true };

      const target_x = toContractX(dispX);
      const target_y = toContractY(dispY);

      const explorer = await client!.view.explorerInfo(army_id);
      if (!explorer) return { content: [{ type: "text", text: `Army ${army_id} not found.` }], isError: true };

      const targetHex = { x: target_x, y: target_y };
      const direction = directionBetween(explorer.position, targetHex);
      if (direction === null) {
        return { content: [{ type: "text", text: `Army not adjacent to (${dispX},${dispY}). Move first.` }], isError: true };
      }

      const tile = mapCtx.snapshot?.gridIndex.get(`${target_x},${target_y}`);
      if (!tile || !isStructure(tile.occupierType)) {
        return { content: [{ type: "text", text: `No structure at (${dispX},${dispY}). Raids only work on structures.` }], isError: true };
      }

      const structure = await client!.view.structureAt(target_x, target_y);
      if (!structure) return { content: [{ type: "text", text: "Structure not found." }], isError: true };

      const scaledSteal = stealList.map((r) => ({
        resourceId: r.resource_id,
        amount: Math.floor(r.amount * RESOURCE_PRECISION),
      }));

      try {
        await provider!.raid_explorer_vs_guard({
          explorer_id: army_id,
          structure_id: structure.entityId,
          structure_direction: direction,
          steal_resources: scaledSteal,
          signer: account,
        });
      } catch (err: any) {
        return { content: [{ type: "text", text: `Raid failed: ${extractTxError(err)}` }], isError: true };
      }

      const stealSummary = stealList.length > 0
        ? ` Attempted to steal: ${stealList.map((r) => `${r.amount} of resource ${r.resource_id}`).join(", ")}.`
        : "";
      return { content: [{ type: "text", text: `Raided structure at (${dispX},${dispY}). 10% damage dealt to guards.${stealSummary}` }] };
    },
  );

  // ── Army Management Tools ──

  server.tool(
    "create_army",
    "Create a new army at one of your realms. Auto-selects troop type by biome. " +
    "NOTE: Larger armies are disproportionately stronger — 1 army of 2000 beats 2 armies of 1000. Prefer fewer, bigger armies.",
    {
      structure_id: z.coerce.number().describe("Entity ID of your realm"),
      troop_type: z.enum(["Knight", "Paladin", "Crossbowman"]).optional().describe("Override troop type"),
      tier: z.coerce.number().min(1).max(3).optional().default(1).describe("Troop tier (1-3)"),
      amount: z.coerce.number().optional().describe("Number of troops (default: all available, max 10000)"),
    },
    async ({ structure_id, troop_type, tier, amount: requestedAmount }) => {
      const err = notReady();
      if (err) return { content: [{ type: "text", text: err }], isError: true };

      // Find tile by entity ID
      let structTile = null as any;
      for (const t of mapCtx.snapshot?.tiles ?? []) {
        if (t.occupierId === structure_id) { structTile = t; break; }
      }
      if (!structTile) return { content: [{ type: "text", text: `Structure ${structure_id} not found.` }], isError: true };

      const info = await client!.view.structureAt(structTile.position.x, structTile.position.y);
      if (!info) return { content: [{ type: "text", text: `Structure ${structure_id} not found.` }], isError: true };
      if (info.category !== "Realm") return { content: [{ type: "text", text: `${info.category} is not a realm.` }], isError: true };
      if (!addressesEqual(info.ownerAddress, playerAddress)) return { content: [{ type: "text", text: "Not yours." }], isError: true };

      const BIOME_BEST: Record<number, string> = { 1:"Crossbowman",2:"Crossbowman",3:"Crossbowman",4:"Crossbowman",7:"Crossbowman",5:"Paladin",6:"Paladin",8:"Paladin",9:"Paladin",11:"Paladin",14:"Paladin",10:"Knight",12:"Knight",13:"Knight",15:"Knight",16:"Knight" };
      const troopName = troop_type ?? BIOME_BEST[structTile.biome] ?? "Knight";
      const category = { Knight: 0, Paladin: 1, Crossbowman: 2 }[troopName] ?? 0;
      const tierValue = (tier ?? 1) - 1;
      const tierSuffix = ["T1", "T2", "T3"][tierValue];
      const resName = `${troopName} ${tierSuffix}`;
      const available = info.resources.find((r) => r.name === resName)?.amount ?? 0;
      if (available <= 0) return { content: [{ type: "text", text: `No ${resName} available. Resources: ${info.resources.filter(r => r.amount > 0).map(r => `${r.amount.toLocaleString()} ${r.name}`).join(", ")}` }], isError: true };

      const troopCount = requestedAmount ?? Math.min(10_000, available);
      if (troopCount > available) return { content: [{ type: "text", text: `Only ${available.toLocaleString()} ${resName} available, requested ${troopCount.toLocaleString()}.` }], isError: true };
      const amount = Math.floor(troopCount * RESOURCE_PRECISION);

      // Find open spawn hex
      const neighbors = getNeighborHexes(structTile.position.x, structTile.position.y);
      let spawnDir: number | null = null;
      for (const n of neighbors) {
        const nt = mapCtx.snapshot?.gridIndex.get(`${n.col},${n.row}`);
        if (nt && nt.occupierType === 0) { spawnDir = n.direction; break; }
      }
      if (spawnDir === null) return { content: [{ type: "text", text: "No open spawn hex." }], isError: true };

      try {
        await provider!.explorer_create({ for_structure_id: structure_id, category, tier: tierValue, amount, spawn_direction: spawnDir, signer: account });
      } catch (err: any) {
        return { content: [{ type: "text", text: `Create failed: ${extractTxError(err)}` }], isError: true };
      }

      return { content: [{ type: "text", text: `Army created: ${troopCount.toLocaleString()} ${resName} at ${Direction[spawnDir]} of realm. Armies: ${info.explorerCount + 1}/${info.maxExplorerCount}` }] };
    },
  );

  server.tool(
    "open_chest",
    "Open a chest adjacent to your army for relics and victory points.",
    {
      army_id: z.coerce.number().describe("Entity ID of your army"),
      chest_x: z.coerce.number().describe("Chest map X"),
      chest_y: z.coerce.number().describe("Chest map Y"),
    },
    async ({ army_id, chest_x: dispCX, chest_y: dispCY }) => {
      const err = notReady();
      if (err) return { content: [{ type: "text", text: err }], isError: true };

      const chest_x = toContractX(dispCX);
      const chest_y = toContractY(dispCY);

      const explorer = await client!.view.explorerInfo(army_id);
      if (!explorer) return { content: [{ type: "text", text: `Army ${army_id} not found.` }], isError: true };

      const chestHex = { x: chest_x, y: chest_y };
      const direction = directionBetween(explorer.position, chestHex);
      if (direction === null) return { content: [{ type: "text", text: "Army not adjacent to chest." }], isError: true };

      try {
        await provider!.open_chest({ explorer_id: army_id, chest_coord: { alt: false, x: chest_x, y: chest_y }, signer: account });
      } catch (err: any) {
        return { content: [{ type: "text", text: `Open chest failed: ${extractTxError(err)}` }], isError: true };
      }

      return { content: [{ type: "text", text: `Opened chest at (${dispCX},${dispCY}). Relics granted!` }] };
    },
  );

  // ── Resource Transfer Tools ──

  server.tool(
    "send_resources",
    "Transfer resources between your structures via donkey caravan. " +
    "Automatically uses sender's donkeys, or recipient's donkeys (pickup) if sender has none. " +
    "Resources arrive after travel time. Automation will offload arrivals automatically.",
    {
      from_structure_id: z.coerce.number().describe("Entity ID of source structure"),
      to_structure_id: z.coerce.number().describe("Entity ID of destination structure"),
      resources: z.array(z.object({
        resource_id: z.coerce.number().describe("Resource type ID (e.g. 38=Essence, 3=Wood, 4=Copper, 7=Gold, 25=Donkey)"),
        amount: z.coerce.number().describe("Amount to send (human-readable, not precision-scaled)"),
      })).describe("Resources to send"),
    },
    async ({ from_structure_id, to_structure_id, resources: resourceList }) => {
      const err = notReady();
      if (err) return { content: [{ type: "text", text: err }], isError: true };

      if (from_structure_id === to_structure_id) {
        return { content: [{ type: "text", text: "Cannot send to the same structure." }], isError: true };
      }
      if (resourceList.length === 0) {
        return { content: [{ type: "text", text: "No resources specified." }], isError: true };
      }

      const scaledResources = resourceList.map((r) => ({
        resource: r.resource_id,
        amount: Math.floor(r.amount * RESOURCE_PRECISION),
      }));

      // Calculate donkey cost from resource weights
      let totalWeightGrams = 0;
      for (const r of resourceList) {
        const weightPerUnit = resourceWeightGrams.get(r.resource_id) ?? 0;
        totalWeightGrams += r.amount * weightPerUnit;
      }
      const donkeysNeeded = donkeyCapacityGrams > 0 ? Math.ceil(totalWeightGrams / donkeyCapacityGrams) : 0;

      // Check donkey balance on both structures to decide send vs pickup
      let senderDonkeys = 0;
      let recipientDonkeys = 0;
      try {
        for (const t of mapCtx.snapshot?.tiles ?? []) {
          if (t.occupierId === from_structure_id) {
            const info = await client!.view.structureAt(t.position.x, t.position.y);
            senderDonkeys = info?.resources.find((r) => r.name === "Donkey")?.amount ?? 0;
            break;
          }
        }
        for (const t of mapCtx.snapshot?.tiles ?? []) {
          if (t.occupierId === to_structure_id) {
            const info = await client!.view.structureAt(t.position.x, t.position.y);
            recipientDonkeys = info?.resources.find((r) => r.name === "Donkey")?.amount ?? 0;
            break;
          }
        }
      } catch { /* non-critical — will try send first */ }

      // Check if either side has enough donkeys
      if (donkeysNeeded > 0 && senderDonkeys < donkeysNeeded && recipientDonkeys < donkeysNeeded) {
        return { content: [{ type: "text", text: `Need ${donkeysNeeded} donkeys but sender has ${senderDonkeys} and recipient has ${recipientDonkeys}. Produce more donkeys first.` }], isError: true };
      }

      const summary = resourceList.map((r) => `${r.amount.toLocaleString()} of resource ${r.resource_id}`).join(", ");
      const donkeyNote = donkeysNeeded > 0 ? ` (${donkeysNeeded} donkeys burned)` : "";

      // Use sender's donkeys if available, otherwise pickup with recipient's
      if (senderDonkeys >= donkeysNeeded) {
        try {
          await provider!.send_resources({
            sender_entity_id: from_structure_id,
            recipient_entity_id: to_structure_id,
            resources: scaledResources,
            signer: account,
          });
          return { content: [{ type: "text", text: `Sent ${summary} from ${from_structure_id} → ${to_structure_id}${donkeyNote}. Sender's donkeys dispatched.` }] };
        } catch (err: any) {
          const msg = extractTxError(err);
          if (!msg.toLowerCase().includes("donkey")) {
            return { content: [{ type: "text", text: `Send failed: ${msg}` }], isError: true };
          }
        }
      }

      // Pickup mode — recipient's donkeys fetch the resources
      if (recipientDonkeys >= donkeysNeeded) {
        try {
          await provider!.pickup_resources({
            recipient_entity_id: to_structure_id,
            owner_entity_id: from_structure_id,
            resources: scaledResources,
            signer: account,
          });
          return { content: [{ type: "text", text: `Picking up ${summary} from ${from_structure_id} → ${to_structure_id}${donkeyNote}. Recipient's donkeys dispatched.` }] };
        } catch (err: any) {
          return { content: [{ type: "text", text: `Pickup failed: ${extractTxError(err)}` }], isError: true };
        }
      }

      return { content: [{ type: "text", text: `Neither structure has enough donkeys (need ${donkeysNeeded}). Sender: ${senderDonkeys}, Recipient: ${recipientDonkeys}.` }], isError: true };
    },
  );

  // ── Guard & Troop Transfer Tools ──

  server.tool(
    "guard_from_storage",
    "Add troops from a structure's own resource storage into one of its guard slots. " +
    "Structures can have up to 4 guard slots (Alpha=0, Bravo=1, Charlie=2, Delta=3). " +
    "Check map_entity_info first to see which slots are occupied. " +
    "NOTE: Larger groups in one slot are disproportionately stronger — concentrate troops in fewer slots.",
    {
      structure_id: z.coerce.number().describe("Entity ID of the structure to guard"),
      slot: z.coerce.number().min(0).max(3).describe("Guard slot (0=Alpha, 1=Bravo, 2=Charlie, 3=Delta)"),
      troop_type: z.enum(["Knight", "Paladin", "Crossbowman"]).describe("Troop type"),
      tier: z.coerce.number().min(1).max(3).default(1).describe("Troop tier (1-3)"),
      amount: z.coerce.number().describe("Number of troops to assign as guards"),
    },
    async ({ structure_id, slot, troop_type, tier, amount: troopAmount }) => {
      const err = notReady();
      if (err) return { content: [{ type: "text", text: err }], isError: true };

      const category = { Knight: 0, Paladin: 1, Crossbowman: 2 }[troop_type] ?? 0;
      const tierValue = (tier ?? 1) - 1;
      const amount = Math.floor(troopAmount * RESOURCE_PRECISION);
      const slotNames = ["Alpha", "Bravo", "Charlie", "Delta"];
      const tierSuffix = ["T1", "T2", "T3"][tierValue];

      try {
        await provider!.guard_add({
          for_structure_id: structure_id,
          slot,
          category,
          tier: tierValue,
          amount,
          signer: account,
        });
      } catch (err: any) {
        return { content: [{ type: "text", text: `Guard failed: ${extractTxError(err)}` }], isError: true };
      }

      return { content: [{ type: "text", text: `Added ${troopAmount.toLocaleString()} ${troop_type} ${tierSuffix} to ${slotNames[slot] ?? `slot ${slot}`} guard on structure ${structure_id}.` }] };
    },
  );

  server.tool(
    "guard_from_army",
    "Move troops from an adjacent army into a structure's guard slot. " +
    "The army must be adjacent to the structure. " +
    "NOTE: Larger groups in one slot are disproportionately stronger — concentrate troops in fewer slots.",
    {
      army_id: z.coerce.number().describe("Entity ID of the army donating troops"),
      structure_id: z.coerce.number().describe("Entity ID of the structure to garrison"),
      slot: z.coerce.number().min(0).max(3).describe("Guard slot (0=Alpha, 1=Bravo, 2=Charlie, 3=Delta)"),
      amount: z.coerce.number().describe("Number of troops to move into the guard slot"),
    },
    async ({ army_id, structure_id, slot, amount: troopAmount }) => {
      const err = notReady();
      if (err) return { content: [{ type: "text", text: err }], isError: true };

      // Find structure position for adjacency check
      let structPos: { x: number; y: number } | null = null;
      for (const t of mapCtx.snapshot?.tiles ?? []) {
        if (t.occupierId === structure_id) { structPos = t.position; break; }
      }

      const explorer = await client!.view.explorerInfo(army_id);
      if (!explorer) return { content: [{ type: "text", text: `Army ${army_id} not found.` }], isError: true };

      if (structPos) {
        const direction = directionBetween(explorer.position, structPos);
        if (direction === null) {
          return { content: [{ type: "text", text: `Army ${army_id} is not adjacent to structure ${structure_id}. Move first.` }], isError: true };
        }
      }

      const scaledAmount = Math.floor(troopAmount * RESOURCE_PRECISION);
      const direction = structPos ? directionBetween(explorer.position, structPos) : null;

      if (direction === null) {
        return { content: [{ type: "text", text: `Cannot determine direction to structure.` }], isError: true };
      }

      const slotNames = ["Alpha", "Bravo", "Charlie", "Delta"];

      try {
        await provider!.explorer_guard_swap({
          from_explorer_id: army_id,
          to_structure_id: structure_id,
          to_structure_direction: direction,
          to_guard_slot: slot,
          count: scaledAmount,
          signer: account,
        });
      } catch (err: any) {
        return { content: [{ type: "text", text: `Garrison failed: ${extractTxError(err)}` }], isError: true };
      }

      return { content: [{ type: "text", text: `Garrisoned ${troopAmount.toLocaleString()} troops from army ${army_id} into ${slotNames[slot] ?? `slot ${slot}`} on structure ${structure_id}.` }] };
    },
  );

  server.tool(
    "reinforce_army",
    "Add more troops from the home structure's storage to an existing army. " +
    "The army must be adjacent to its home structure. " +
    "NOTE: Larger armies are disproportionately stronger — reinforce rather than create new armies.",
    {
      army_id: z.coerce.number().describe("Entity ID of the army to reinforce"),
      amount: z.coerce.number().describe("Number of troops to add"),
    },
    async ({ army_id, amount: troopAmount }) => {
      const err = notReady();
      if (err) return { content: [{ type: "text", text: err }], isError: true };

      const explorer = await client!.view.explorerInfo(army_id);
      if (!explorer) return { content: [{ type: "text", text: `Army ${army_id} not found.` }], isError: true };

      // Find the home structure — the explorer's owner field is the structure entity ID
      const ownerStructureId = explorer.entityId; // explorer.owner is the structure
      let homePos: { x: number; y: number } | null = null;
      for (const t of mapCtx.snapshot?.tiles ?? []) {
        // The owner of the explorer is stored differently — look for structures adjacent to the army
        if (t.occupierId > 0 && t.occupierType >= 1 && t.occupierType <= 14) {
          const dir = directionBetween(explorer.position, t.position);
          if (dir !== null) {
            // Check if this structure owns this explorer
            const structInfo = await client!.view.structureAt(t.position.x, t.position.y);
            if (structInfo && addressesEqual(structInfo.ownerAddress, playerAddress)) {
              homePos = t.position;
              break;
            }
          }
        }
      }

      if (!homePos) {
        return { content: [{ type: "text", text: `Army ${army_id} is not adjacent to any of your structures. Move it home first.` }], isError: true };
      }

      const homeDirection = directionBetween(explorer.position, homePos);
      if (homeDirection === null) {
        return { content: [{ type: "text", text: `Cannot determine direction to home structure.` }], isError: true };
      }

      const scaledAmount = Math.floor(troopAmount * RESOURCE_PRECISION);

      try {
        await provider!.explorer_add({
          to_explorer_id: army_id,
          amount: scaledAmount,
          home_direction: homeDirection,
          signer: account,
        });
      } catch (err: any) {
        return { content: [{ type: "text", text: `Reinforce failed: ${extractTxError(err)}` }], isError: true };
      }

      return { content: [{ type: "text", text: `Reinforced army ${army_id} with ${troopAmount.toLocaleString()} troops.` }] };
    },
  );

  server.tool(
    "transfer_troops",
    "Transfer troops between two adjacent armies of the same type and tier. " +
    "NOTE: Larger armies are disproportionately stronger — use this to consolidate small armies into one big one.",
    {
      from_army_id: z.coerce.number().describe("Entity ID of the army giving troops"),
      to_army_id: z.coerce.number().describe("Entity ID of the army receiving troops"),
      amount: z.coerce.number().describe("Number of troops to transfer"),
    },
    async ({ from_army_id, to_army_id, amount: troopAmount }) => {
      const err = notReady();
      if (err) return { content: [{ type: "text", text: err }], isError: true };

      const fromExplorer = await client!.view.explorerInfo(from_army_id);
      if (!fromExplorer) return { content: [{ type: "text", text: `Army ${from_army_id} not found.` }], isError: true };

      const toExplorer = await client!.view.explorerInfo(to_army_id);
      if (!toExplorer) return { content: [{ type: "text", text: `Army ${to_army_id} not found.` }], isError: true };

      const direction = directionBetween(fromExplorer.position, toExplorer.position);
      if (direction === null) {
        return { content: [{ type: "text", text: `Armies are not adjacent. Move them next to each other first.` }], isError: true };
      }

      const scaledAmount = Math.floor(troopAmount * RESOURCE_PRECISION);

      try {
        await provider!.explorer_explorer_swap({
          from_explorer_id: from_army_id,
          to_explorer_id: to_army_id,
          to_explorer_direction: direction,
          count: scaledAmount,
          signer: account,
        });
      } catch (err: any) {
        return { content: [{ type: "text", text: `Transfer failed: ${extractTxError(err)}` }], isError: true };
      }

      return { content: [{ type: "text", text: `Transferred ${troopAmount.toLocaleString()} troops from army ${from_army_id} to army ${to_army_id}.` }] };
    },
  );

  server.tool(
    "unguard_to_army",
    "Move troops from a structure's guard slot to an adjacent army. " +
    "The army must be adjacent to the structure and have the same troop type/tier.",
    {
      structure_id: z.coerce.number().describe("Entity ID of the structure"),
      slot: z.coerce.number().min(0).max(3).describe("Guard slot (0=Alpha, 1=Bravo, 2=Charlie, 3=Delta)"),
      army_id: z.coerce.number().describe("Entity ID of the receiving army"),
      amount: z.coerce.number().describe("Number of troops to move out of the guard slot"),
    },
    async ({ structure_id, slot, army_id, amount: troopAmount }) => {
      const err = notReady();
      if (err) return { content: [{ type: "text", text: err }], isError: true };

      // Find structure position
      let structPos: { x: number; y: number } | null = null;
      for (const t of mapCtx.snapshot?.tiles ?? []) {
        if (t.occupierId === structure_id) { structPos = t.position; break; }
      }

      const explorer = await client!.view.explorerInfo(army_id);
      if (!explorer) return { content: [{ type: "text", text: `Army ${army_id} not found.` }], isError: true };

      if (!structPos) {
        return { content: [{ type: "text", text: `Structure ${structure_id} not found on map.` }], isError: true };
      }

      const direction = directionBetween(structPos, explorer.position);
      if (direction === null) {
        return { content: [{ type: "text", text: `Army ${army_id} is not adjacent to structure ${structure_id}. Move first.` }], isError: true };
      }

      const scaledAmount = Math.floor(troopAmount * RESOURCE_PRECISION);
      const slotNames = ["Alpha", "Bravo", "Charlie", "Delta"];

      try {
        await provider!.guard_explorer_swap({
          from_structure_id: structure_id,
          from_guard_slot: slot,
          to_explorer_id: army_id,
          to_explorer_direction: direction,
          count: scaledAmount,
          signer: account,
        });
      } catch (err: any) {
        return { content: [{ type: "text", text: `Unguard failed: ${extractTxError(err)}` }], isError: true };
      }

      return { content: [{ type: "text", text: `Moved ${troopAmount.toLocaleString()} troops from ${slotNames[slot] ?? `slot ${slot}`} on structure ${structure_id} to army ${army_id}.` }] };
    },
  );

  server.tool(
    "transfer_to_structure",
    "Transfer resources (relics, loot, etc.) from an army to an adjacent structure. " +
    "The army must be adjacent to the structure.",
    {
      army_id: z.coerce.number().describe("Entity ID of the army carrying resources"),
      structure_id: z.coerce.number().describe("Entity ID of the receiving structure"),
      resources: z.array(z.object({
        resource_id: z.coerce.number().describe("Resource type ID"),
        amount: z.coerce.number().describe("Amount to transfer (human-readable)"),
      })).describe("Resources to transfer"),
    },
    async ({ army_id, structure_id, resources: resourceList }) => {
      const err = notReady();
      if (err) return { content: [{ type: "text", text: err }], isError: true };
      if (resourceList.length === 0) return { content: [{ type: "text", text: "No resources specified." }], isError: true };

      const explorer = await client!.view.explorerInfo(army_id);
      if (!explorer) return { content: [{ type: "text", text: `Army ${army_id} not found.` }], isError: true };

      let structPos: { x: number; y: number } | null = null;
      for (const t of mapCtx.snapshot?.tiles ?? []) {
        if (t.occupierId === structure_id) { structPos = t.position; break; }
      }
      if (!structPos) return { content: [{ type: "text", text: `Structure ${structure_id} not found.` }], isError: true };

      const direction = directionBetween(explorer.position, structPos);
      if (direction === null) {
        return { content: [{ type: "text", text: `Army not adjacent to structure. Move first.` }], isError: true };
      }

      const scaledResources = resourceList.map((r) => ({
        resourceId: r.resource_id,
        amount: Math.floor(r.amount * RESOURCE_PRECISION),
      }));

      try {
        await provider!.troop_structure_adjacent_transfer({
          from_explorer_id: army_id,
          to_structure_id: structure_id,
          resources: scaledResources,
          signer: account,
        });
      } catch (err: any) {
        return { content: [{ type: "text", text: `Transfer failed: ${extractTxError(err)}` }], isError: true };
      }

      const summary = resourceList.map((r) => `${r.amount.toLocaleString()} of resource ${r.resource_id}`).join(", ");
      return { content: [{ type: "text", text: `Transferred ${summary} from army ${army_id} to structure ${structure_id}.` }] };
    },
  );

  server.tool(
    "transfer_to_army",
    "Transfer resources (relics, loot, etc.) between two adjacent armies.",
    {
      from_army_id: z.coerce.number().describe("Entity ID of the army giving resources"),
      to_army_id: z.coerce.number().describe("Entity ID of the army receiving resources"),
      resources: z.array(z.object({
        resource_id: z.coerce.number().describe("Resource type ID"),
        amount: z.coerce.number().describe("Amount to transfer (human-readable)"),
      })).describe("Resources to transfer"),
    },
    async ({ from_army_id, to_army_id, resources: resourceList }) => {
      const err = notReady();
      if (err) return { content: [{ type: "text", text: err }], isError: true };
      if (resourceList.length === 0) return { content: [{ type: "text", text: "No resources specified." }], isError: true };

      const fromExplorer = await client!.view.explorerInfo(from_army_id);
      if (!fromExplorer) return { content: [{ type: "text", text: `Army ${from_army_id} not found.` }], isError: true };

      const toExplorer = await client!.view.explorerInfo(to_army_id);
      if (!toExplorer) return { content: [{ type: "text", text: `Army ${to_army_id} not found.` }], isError: true };

      const direction = directionBetween(fromExplorer.position, toExplorer.position);
      if (direction === null) {
        return { content: [{ type: "text", text: `Armies are not adjacent. Move them next to each other first.` }], isError: true };
      }

      const scaledResources = resourceList.map((r) => ({
        resourceId: r.resource_id,
        amount: Math.floor(r.amount * RESOURCE_PRECISION),
      }));

      try {
        await provider!.troop_troop_adjacent_transfer({
          from_troop_id: from_army_id,
          to_troop_id: to_army_id,
          resources: scaledResources,
          signer: account,
        });
      } catch (err: any) {
        return { content: [{ type: "text", text: `Transfer failed: ${extractTxError(err)}` }], isError: true };
      }

      const summary = resourceList.map((r) => `${r.amount.toLocaleString()} of resource ${r.resource_id}`).join(", ");
      return { content: [{ type: "text", text: `Transferred ${summary} from army ${from_army_id} to army ${to_army_id}.` }] };
    },
  );

  // ── Buff Tools ──

  server.tool(
    "apply_relic",
    "Apply a relic buff to an army, structure guards, or structure production. " +
    "Costs Essence. Relics come from opening chests. " +
    "Recipient types: 0=Explorer (army buff), 1=StructureGuard (guard buff), 2=StructureProduction (production buff).",
    {
      entity_id: z.coerce.number().describe("Entity ID of the army or structure to buff"),
      relic_resource_id: z.coerce.number().describe("Resource ID of the relic to apply"),
      recipient_type: z.coerce.number().min(0).max(2).describe("0=Explorer, 1=StructureGuard, 2=StructureProduction"),
    },
    async ({ entity_id, relic_resource_id, recipient_type }) => {
      const err = notReady();
      if (err) return { content: [{ type: "text", text: err }], isError: true };

      const recipientNames = ["Explorer (army)", "Structure Guard", "Structure Production"];

      try {
        await provider!.apply_relic({
          entity_id,
          relic_resource_id,
          recipient_type,
          signer: account,
        });
      } catch (err: any) {
        return { content: [{ type: "text", text: `Apply relic failed: ${extractTxError(err)}` }], isError: true };
      }

      return { content: [{ type: "text", text: `Applied relic ${relic_resource_id} to entity ${entity_id} as ${recipientNames[recipient_type] ?? `type ${recipient_type}`}.` }] };
    },
  );

  // ── Connect transport FIRST so the MCP handshake completes immediately ──
  log("Connecting MCP transport...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("MCP transport connected. Bootstrapping...");

  // Exit cleanly when Claude Code closes the connection
  process.stdin.on("end", () => { log("stdin closed — exiting."); process.exit(0); });
  process.on("SIGTERM", () => { log("SIGTERM — exiting."); process.exit(0); });
  process.on("SIGINT", () => { log("SIGINT — exiting."); process.exit(0); });

  // ── Bootstrap (runs AFTER handshake — no timeout risk) ──
  try {
    const config = loadConfig();

    let contractsBySelector: Record<string, string> | undefined;
    if (config.worldName && (!config.toriiUrl || !config.worldAddress)) {
      bootstrapPhase = "discovering world";
      log(`Discovering world "${config.worldName}"...`);
      const info = await discoverWorld(config.chain, config.worldName);
      config.toriiUrl = info.toriiUrl;
      config.worldAddress = info.worldAddress;
      config.rpcUrl = info.rpcUrl;
      contractsBySelector = info.contractsBySelector;
      config.dataDir = join(homedir(), ".axis", "worlds", info.worldAddress);
      log(`Discovered: ${info.toriiUrl}`);
    }

    let manifest = getManifest(config.chain);
    if (contractsBySelector) {
      manifest = patchManifest(manifest, config.worldAddress, contractsBySelector);
    }

    bootstrapPhase = "authenticating";
    // Intercept console.log to capture the auth URL the Cartridge SDK prints.
    // The URL is surfaced via tool responses as a clickable markdown link.
    const _origLog = console.log;
    console.log = (...a: any[]) => {
      const msg = a.map(String).join(" ");
      const urlMatch = msg.match(/https?:\/\/\S+/);
      if (urlMatch) {
        authUrl = urlMatch[0];
        log("Auth URL captured — call any tool to get the login link.");
      }
      _origLog(...a);
    };
    log("Authenticating...");
    account = await getAccount({
      chain: config.chain,
      rpcUrl: config.rpcUrl,
      chainId: config.chainId,
      basePath: join(config.dataDir, ".cartridge"),
      manifest,
    });
    console.log = _origLog; // restore after auth
    playerAddress = account.address;
    authUrl = null;
    log(`Account: ${playerAddress}`);

    bootstrapPhase = "loading game data";
    client = await EternumClient.create({ toriiUrl: config.toriiUrl });
    provider = new EternumProvider(manifest, config.rpcUrl, config.vrfProviderAddress);
    gameConfig = await (client.sql as any).fetchGameConfig();
    log(`Game config loaded. ${Object.keys(gameConfig!.buildingCosts).length} buildings.`);

    // Query map_center_offset for coordinate conversion
    try {
      const sql = client.sql as any;
      const baseUrl = sql.baseUrl ?? config.toriiUrl + "/sql";
      const res = await fetch(`${baseUrl}?query=${encodeURIComponent("SELECT `map_center_offset` FROM `s1_eternum-WorldConfig` LIMIT 1")}`);
      if (res.ok) {
        const rows = await res.json() as any[];
        if (rows[0]?.map_center_offset != null) {
          mapCenter = BASE_MAP_CENTER - Number(rows[0].map_center_offset);
          log(`Map center: ${mapCenter} (offset ${rows[0].map_center_offset})`);
        }
      }
    } catch { /* non-critical — coords will use raw values */ }

    // Query donkey capacity and resource weights for transport calculations
    try {
      const sql = client.sql as any;
      const baseUrl = sql.baseUrl ?? config.toriiUrl + "/sql";
      const capRes = await fetch(`${baseUrl}?query=${encodeURIComponent("SELECT `capacity_config.donkey_capacity` as cap FROM `s1_eternum-WorldConfig` LIMIT 1")}`);
      if (capRes.ok) {
        const rows = await capRes.json() as any[];
        if (rows[0]?.cap != null) donkeyCapacityGrams = Number(rows[0].cap);
      }
      const weightRes = await fetch(`${baseUrl}?query=${encodeURIComponent("SELECT resource_type, weight_gram FROM `s1_eternum-WeightConfig`")}`);
      if (weightRes.ok) {
        const rows = await weightRes.json() as any[];
        for (const row of rows) {
          resourceWeightGrams.set(Number(row.resource_type), Number(BigInt(row.weight_gram)));
        }
      }
      log(`Transport config: donkey capacity ${donkeyCapacityGrams}g, ${resourceWeightGrams.size} resource weights loaded`);
    } catch { /* non-critical */ }

    // Map loop
    const mapLoop = createMapLoop(client, mapCtx, playerAddress, 10_000, gameConfig!.stamina, undefined, mapCenter);
    mapLoop.start();

    bootstrapPhase = "loading map";
    log("Waiting for first map snapshot...");
    for (let i = 0; i < 30; i++) {
      if (mapCtx.snapshot) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    log(mapCtx.snapshot ? `Map loaded: ${mapCtx.snapshot.tiles.length} tiles` : "Map failed to load (tools will retry)");

    // Automation loop (off by default)
    automationLoop = createAutomationLoop(
      client, provider, account, playerAddress, config.dataDir, mapCtx, gameConfig!, 60_000, automationStatus,
    );

    bootstrapDone = true;
    log("Bootstrap complete. All tools ready.");
  } catch (err: any) {
    bootstrapError = err.message ?? String(err);
    log(`Bootstrap failed: ${bootstrapError}`);
  }
}

main().catch((err) => {
  log(`Fatal: ${err}`);
  process.exit(1);
});
