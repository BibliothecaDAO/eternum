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
import type { MapContext } from "../../src/map/context.js";
import type { TxContext } from "../../src/tools/tx-context.js";
import { extractTxError, addressesEqual } from "../../src/tools/tx-context.js";
import { findPath, buildTileIndex, directionBetween } from "../../src/world/pathfinding.js";
import { isExplorer, isStructure, isChest } from "../../src/world/occupier.js";
import { calculateStrength, calculateGuardStrength } from "../../src/world/strength.js";
import { projectExplorerStamina } from "../../src/world/stamina.js";
import { createMapProtocol } from "../../src/map/protocol.js";
import { packTileSeed, getNeighborHexes, Direction, BiomeIdToType, RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { GameConfig, StaminaConfig } from "@bibliothecadao/torii";

// Suppress noisy provider logs
{
  const _warn = console.warn;
  const _error = console.error;
  const providerNoise = (msg: string) =>
    msg.includes("[provider]") || msg.includes("Failed to estimate") || msg.includes("Insufficient transaction");
  console.warn = (...a: any[]) => { if (!providerNoise(String(a[0]))) _warn.apply(console, a); };
  console.error = (...a: any[]) => { if (!providerNoise(String(a[0]))) _error.apply(console, a); };
}

const log = (msg: string) => process.stderr.write(`[eternum-mcp] ${msg}\n`);

async function main() {
  log("Starting...");

  // ── Bootstrap (same as agent main.ts) ──
  const config = loadConfig();

  let contractsBySelector: Record<string, string> | undefined;
  if (config.worldName && (!config.toriiUrl || !config.worldAddress)) {
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

  const account = await getAccount({
    chain: config.chain,
    rpcUrl: config.rpcUrl,
    chainId: config.chainId,
    basePath: join(config.dataDir, ".cartridge"),
    manifest,
  });
  log(`Account: ${account.address}`);

  const client = await EternumClient.create({ toriiUrl: config.toriiUrl });
  const provider = new EternumProvider(manifest, config.rpcUrl, config.vrfProviderAddress);
  const gameConfig: GameConfig = await (client.sql as any).fetchGameConfig();
  log(`Game config loaded. ${Object.keys(gameConfig.buildingCosts).length} buildings.`);

  const mapCtx: MapContext = { snapshot: null, protocol: null, filePath: null };
  const txCtx: TxContext = { provider, signer: account };
  const playerAddress = account.address;

  // ── Map loop ──
  const mapLoop = createMapLoop(client, mapCtx, playerAddress, 10_000, gameConfig.stamina);
  mapLoop.start();

  log("Waiting for map...");
  for (let i = 0; i < 30; i++) {
    if (mapCtx.snapshot) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  log(mapCtx.snapshot ? `Map loaded: ${mapCtx.snapshot.tiles.length} tiles` : "Map failed to load");

  // ── MCP Server ──
  const server = new McpServer({ name: "eternum", version: "1.0.0" });

  // ── Map Protocol Tools ──

  server.tool(
    "map_tile_info",
    "What's at this position? Full details: biome, entity, guards, resources, strength.",
    { x: z.number().describe("World hex X"), y: z.number().describe("World hex Y") },
    async ({ x, y }) => {
      if (!mapCtx.protocol) return { content: [{ type: "text", text: "Map not loaded." }] };
      const r = await mapCtx.protocol.tileInfo(x, y);
      return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
    },
  );

  server.tool(
    "map_nearby",
    "What's around this position? Returns grouped lists: your armies, enemies, structures, chests.",
    {
      x: z.number().describe("World hex X"),
      y: z.number().describe("World hex Y"),
      radius: z.number().optional().default(5).describe("Search radius in hexes"),
    },
    async ({ x, y, radius }) => {
      if (!mapCtx.protocol) return { content: [{ type: "text", text: "Map not loaded." }] };
      const r = await mapCtx.protocol.nearby(x, y, radius);
      return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
    },
  );

  server.tool(
    "map_entity_info",
    "Full details on an entity by ID: troops, stamina, guards, resources, strength, owner.",
    { entity_id: z.number().describe("Entity ID") },
    async ({ entity_id }) => {
      if (!mapCtx.protocol) return { content: [{ type: "text", text: "Map not loaded." }] };
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
      ref_x: z.number().optional().describe("Reference X for distance sorting"),
      ref_y: z.number().optional().describe("Reference Y for distance sorting"),
    },
    async ({ type, ref_x, ref_y }) => {
      if (!mapCtx.protocol) return { content: [{ type: "text", text: "Map not loaded." }] };
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
      if (!mapCtx.protocol) return { content: [{ type: "text", text: "Map not loaded." }] };
      return { content: [{ type: "text", text: mapCtx.protocol.briefing() || "(No owned entities)" }] };
    },
  );

  // ── Action Tools ──

  server.tool(
    "move_army",
    "Move one of your armies to a target position. Pathfinds automatically. Explores unexplored tiles.",
    {
      army_id: z.number().describe("Entity ID of your army"),
      target_x: z.number().describe("Target world hex X"),
      target_y: z.number().describe("Target world hex Y"),
    },
    async ({ army_id, target_x, target_y }) => {
      if (!mapCtx.snapshot) return { content: [{ type: "text", text: "Map not loaded." }], isError: true };

      const explorer = await client.view.explorerInfo(army_id);
      if (!explorer) return { content: [{ type: "text", text: `Army ${army_id} not found.` }], isError: true };
      if (!addressesEqual(explorer.ownerAddress ?? "", playerAddress)) {
        return { content: [{ type: "text", text: `Army ${army_id} is not yours.` }], isError: true };
      }

      const target = { x: target_x, y: target_y };
      const start = explorer.position;
      if (start.x === target.x && start.y === target.y) {
        return { content: [{ type: "text", text: `Already at (${target_x},${target_y}).` }], isError: true };
      }

      const { explored, blocked } = buildTileIndex(mapCtx.snapshot.tiles);
      blocked.delete(`${start.x},${start.y}`);

      const biomeIndex = new Map<string, number>();
      for (const t of mapCtx.snapshot.tiles) biomeIndex.set(`${t.position.x},${t.position.y}`, t.biome);

      const tileCost = (key: string) => {
        const biome = biomeIndex.get(key) ?? 0;
        return gameConfig.stamina.travelCost; // simplified
      };

      const projectedStamina = projectExplorerStamina(explorer, gameConfig.stamina);
      const pathResult = findPath(start, target, explored, blocked, projectedStamina, tileCost, gameConfig.stamina.exploreCost);
      if (!pathResult) return { content: [{ type: "text", text: `No path to (${target_x},${target_y}).` }], isError: true };

      // Execute movement segments
      try {
        let segStart = 0;
        while (segStart < pathResult.directions.length) {
          const nextPos = pathResult.path[segStart + 1];
          const nextKey = `${nextPos.x},${nextPos.y}`;
          const isUnexplored = !explored.has(nextKey);

          if (!isUnexplored) {
            let segEnd = segStart + 1;
            while (segEnd < pathResult.directions.length) {
              const futurePos = pathResult.path[segEnd + 1];
              if (!explored.has(`${futurePos.x},${futurePos.y}`)) break;
              segEnd++;
            }
            await provider.explorer_travel({ explorer_id: army_id, directions: pathResult.directions.slice(segStart, segEnd), signer: account });
            segStart = segEnd;
          } else {
            const dir = pathResult.directions[segStart];
            const vrf_source_salt = packTileSeed({ alt: false, col: nextPos.x, row: nextPos.y });
            try {
              await provider.explorer_explore({ explorer_id: army_id, directions: [dir], signer: account, vrf_source_salt });
            } catch (err: any) {
              if (extractTxError(err).includes("already explored")) {
                await provider.explorer_travel({ explorer_id: army_id, directions: [dir], signer: account });
              } else throw err;
            }
            segStart++;
          }
        }
      } catch (err: any) {
        return { content: [{ type: "text", text: `Move failed: ${extractTxError(err)}` }], isError: true };
      }

      const endPos = pathResult.path[pathResult.path.length - 1];
      return { content: [{ type: "text", text: `Moved ${pathResult.distance} steps to (${endPos.x},${endPos.y}). Stamina: ~${Math.max(0, projectedStamina - pathResult.staminaCost)}` }] };
    },
  );

  server.tool(
    "attack_target",
    "Attack a target adjacent to your army. Captures unguarded structures for free.",
    {
      army_id: z.number().describe("Entity ID of your army"),
      target_x: z.number().describe("Target world hex X"),
      target_y: z.number().describe("Target world hex Y"),
    },
    async ({ army_id, target_x, target_y }) => {
      const explorer = await client.view.explorerInfo(army_id);
      if (!explorer) return { content: [{ type: "text", text: `Army ${army_id} not found.` }], isError: true };
      if (!addressesEqual(explorer.ownerAddress ?? "", playerAddress)) {
        return { content: [{ type: "text", text: `Army ${army_id} is not yours.` }], isError: true };
      }

      const targetHex = { x: target_x, y: target_y };
      const direction = directionBetween(explorer.position, targetHex);
      if (direction === null) {
        return { content: [{ type: "text", text: `Army not adjacent to (${target_x},${target_y}). Move first.` }], isError: true };
      }

      const tile = mapCtx.snapshot?.gridIndex.get(`${target_x},${target_y}`);
      if (!tile || tile.occupierType === 0) {
        return { content: [{ type: "text", text: `Nothing to attack at (${target_x},${target_y}).` }], isError: true };
      }

      try {
        if (isExplorer(tile.occupierType)) {
          await provider.attack_explorer_vs_explorer({ aggressor_id: army_id, defender_id: tile.occupierId, defender_direction: direction, steal_resources: [], signer: account });
        } else if (isStructure(tile.occupierType)) {
          const structure = await client.view.structureAt(target_x, target_y);
          if (!structure) return { content: [{ type: "text", text: "Structure not found." }], isError: true };
          await provider.attack_explorer_vs_guard({ explorer_id: army_id, structure_id: structure.entityId, structure_direction: direction, signer: account });
        }
      } catch (err: any) {
        return { content: [{ type: "text", text: `Attack failed: ${extractTxError(err)}` }], isError: true };
      }

      // Check outcome
      const after = await client.view.explorerInfo(army_id);
      const survived = after && after.troopCount > 0;
      return { content: [{ type: "text", text: survived ? `Attack complete. ${after!.troopCount.toLocaleString()} troops remaining.` : "Your army was destroyed." }] };
    },
  );

  server.tool(
    "create_army",
    "Create a new army at one of your realms. Auto-selects troop type by biome.",
    {
      structure_id: z.number().describe("Entity ID of your realm"),
      troop_type: z.enum(["Knight", "Paladin", "Crossbowman"]).optional().describe("Override troop type"),
      tier: z.number().min(1).max(3).optional().default(1).describe("Troop tier (1-3)"),
    },
    async ({ structure_id, troop_type, tier }) => {
      const structure = await client.view.structureAt(0, 0); // need to find by entity ID
      // Find tile by entity ID
      let structTile = null as any;
      for (const t of mapCtx.snapshot?.tiles ?? []) {
        if (t.occupierId === structure_id) { structTile = t; break; }
      }
      if (!structTile) return { content: [{ type: "text", text: `Structure ${structure_id} not found.` }], isError: true };

      const info = await client.view.structureAt(structTile.position.x, structTile.position.y);
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

      const amount = Math.min(10_000 * RESOURCE_PRECISION, Math.floor(available * RESOURCE_PRECISION));

      // Find open spawn hex
      const neighbors = getNeighborHexes(structTile.position.x, structTile.position.y);
      let spawnDir: number | null = null;
      for (const n of neighbors) {
        const nt = mapCtx.snapshot?.gridIndex.get(`${n.col},${n.row}`);
        if (nt && nt.occupierType === 0) { spawnDir = n.direction; break; }
      }
      if (spawnDir === null) return { content: [{ type: "text", text: "No open spawn hex." }], isError: true };

      try {
        await provider.explorer_create({ for_structure_id: structure_id, category, tier: tierValue, amount, spawn_direction: spawnDir, signer: account });
      } catch (err: any) {
        return { content: [{ type: "text", text: `Create failed: ${extractTxError(err)}` }], isError: true };
      }

      const troopCount = Math.floor(amount / RESOURCE_PRECISION);
      return { content: [{ type: "text", text: `Army created: ${troopCount.toLocaleString()} ${resName} at ${Direction[spawnDir]} of realm. Armies: ${info.explorerCount + 1}/${info.maxExplorerCount}` }] };
    },
  );

  server.tool(
    "open_chest",
    "Open a chest adjacent to your army for relics and victory points.",
    {
      army_id: z.number().describe("Entity ID of your army"),
      chest_x: z.number().describe("Chest world hex X"),
      chest_y: z.number().describe("Chest world hex Y"),
    },
    async ({ army_id, chest_x, chest_y }) => {
      const explorer = await client.view.explorerInfo(army_id);
      if (!explorer) return { content: [{ type: "text", text: `Army ${army_id} not found.` }], isError: true };

      const chestHex = { x: chest_x, y: chest_y };
      const direction = directionBetween(explorer.position, chestHex);
      if (direction === null) return { content: [{ type: "text", text: "Army not adjacent to chest." }], isError: true };

      try {
        await provider.open_chest({ explorer_id: army_id, chest_coord: { alt: false, x: chest_x, y: chest_y }, signer: account });
      } catch (err: any) {
        return { content: [{ type: "text", text: `Open chest failed: ${extractTxError(err)}` }], isError: true };
      }

      return { content: [{ type: "text", text: `Opened chest at (${chest_x},${chest_y}). Relics granted!` }] };
    },
  );

  server.tool(
    "inspect_tile",
    "Deep inspection of a tile: owner, guards, resources, strength, biome. Use map_tile_info instead for most cases.",
    { x: z.number().describe("World hex X"), y: z.number().describe("World hex Y") },
    async ({ x, y }) => {
      if (!mapCtx.protocol) return { content: [{ type: "text", text: "Map not loaded." }] };
      const r = await mapCtx.protocol.tileInfo(x, y);
      return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
    },
  );

  // ── Start ──

  log("Starting MCP server on stdio...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("MCP server connected.");
}

main().catch((err) => {
  log(`Fatal: ${err}`);
  process.exit(1);
});
