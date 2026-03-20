/**
 * Quick test: does findPathNative pick the cheapest path from (1,1) to adjacent (15,0)?
 *
 * Loads the live map snapshot from Torii, builds the grid, and runs the pathfinder.
 * Prints each step with biome, cost, and cumulative stamina.
 *
 * Usage: npx tsx dev/scripts/test-pathfinder.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env
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

import { EternumClient } from "@bibliothecadao/client";
import { BiomeIdToType, TroopType } from "@bibliothecadao/types";
import { loadConfig } from "../../src/entry/config.js";
import { discoverWorld } from "../../src/world/discovery.js";
import { renderMap } from "../../src/map/renderer.js";
import {
  findPathNative,
  gridIndexFromSnapshot,
  travelStaminaCostById,
  DEFAULT_STAMINA_CONFIG,
  type GridIndex,
  type StaminaConfig,
} from "../../src/world/pathfinding_v2.js";

async function main() {
  const config = loadConfig();

  if (config.worldName && (!config.toriiUrl || !config.worldAddress)) {
    console.log(`Discovering world "${config.worldName}"...`);
    const info = await discoverWorld(config.chain, config.worldName);
    config.toriiUrl = info.toriiUrl;
    config.worldAddress = info.worldAddress;
  }

  console.log("Connecting to Torii...");
  const client = await EternumClient.create({ toriiUrl: config.toriiUrl });

  // Fetch game config for stamina values
  const gameConfig = await (client.sql as any).fetchGameConfig();
  const staminaConfig: StaminaConfig = {
    gainPerTick: gameConfig.stamina.gainPerTick,
    travelCost: gameConfig.stamina.travelCost,
    exploreCost: gameConfig.stamina.exploreCost,
    bonusValue: gameConfig.stamina.bonusValue,
    maxKnight: gameConfig.stamina.knightMaxStamina,
    maxPaladin: gameConfig.stamina.paladinMaxStamina,
    maxCrossbowman: gameConfig.stamina.crossbowmanMaxStamina,
  };
  console.log("Stamina config:", staminaConfig);

  // Query map center offset
  const BASE_MAP_CENTER = 2147483646;
  let mapCenter = BASE_MAP_CENTER;
  try {
    const sql = client.sql as any;
    const baseUrl = sql.baseUrl ?? config.toriiUrl + "/sql";
    const res = await fetch(`${baseUrl}?query=${encodeURIComponent("SELECT `map_center_offset` FROM `s1_eternum-WorldConfig` LIMIT 1")}`);
    if (res.ok) {
      const rows = await res.json() as any[];
      if (rows[0]?.map_center_offset != null) {
        mapCenter = BASE_MAP_CENTER - Number(rows[0].map_center_offset);
      }
    }
  } catch {}

  const toContractX = (d: number) => d + mapCenter;
  const toContractY = (d: number) => -d + mapCenter;
  const toDisplayX = (r: number) => r - mapCenter;
  const toDisplayY = (r: number) => -(r - mapCenter);

  // Fetch tiles
  console.log("Fetching map...");
  const area = await client.view.mapArea({ x: 0, y: 0, radius: 999_999 });
  console.log(`Got ${area.tiles.length} tiles`);

  const snapshot = renderMap(area.tiles);

  // Build grid
  const baseGrid = gridIndexFromSnapshot(snapshot.gridIndex);

  // Inject synthetic tiles (same as move.ts does)
  const start = { x: toContractX(1), y: toContractY(1) };    // army at (1,1) display
  const end = { x: toContractX(14), y: toContractY(0) };      // adjacent to target — (14,0) display

  console.log(`\nRaw coords: start=(${start.x},${start.y}), end=(${end.x},${end.y})`);
  console.log(`Display coords: start=(1,1), end=(14,0) (adjacent to Hyperstructure at 15,0)`);

  const explored = new Set<string>();
  for (const t of area.tiles) {
    if (t.biome !== 0) explored.add(`${t.position.x},${t.position.y}`);
  }

  const syntheticTiles = new Map<string, number>();
  {
    const { getNeighborHexes } = await import("@bibliothecadao/types");
    const maxDist = Math.abs(end.x - start.x) + Math.abs(end.y - start.y) + 5;
    const frontier = [...explored];
    for (let wave = 0; wave < maxDist && frontier.length > 0; wave++) {
      const next: string[] = [];
      for (const key of frontier) {
        const [fx, fy] = key.split(",").map(Number);
        for (const n of getNeighborHexes(fx, fy)) {
          const nk = `${n.col},${n.row}`;
          if (explored.has(nk) || syntheticTiles.has(nk)) continue;
          syntheticTiles.set(nk, 1);
          next.push(nk);
        }
      }
      frontier.length = 0;
      frontier.push(...next);
      if (syntheticTiles.has(`${end.x},${end.y}`)) break;
    }
  }
  console.log(`Injected ${syntheticTiles.size} synthetic tiles`);

  // Build augmented grid (same as move.ts)
  const augmentedGrid: GridIndex = {
    getBiome: (x, y) => {
      const b = baseGrid.getBiome(x, y);
      if (b > 0) return b;
      return syntheticTiles.get(`${x},${y}`) ?? 0;
    },
    getOccupier: (x, y) => {
      // Unblock self position
      if (x === start.x && y === start.y) return 0;
      return baseGrid.getOccupier(x, y);
    },
    has: (x, y) => baseGrid.has(x, y) || syntheticTiles.has(`${x},${y}`),
    isSynthetic: (x, y) => syntheticTiles.has(`${x},${y}`),
  };

  // Run pathfinder — Paladin troop type
  console.log("\n=== findPathNative (Paladin, maxStamina=160) ===\n");
  const result = findPathNative(start, end, augmentedGrid, {
    troop: TroopType.Paladin,
    maxStamina: 160,
    staminaConfig,
  });

  if (!result) {
    console.log("No path found!");
    process.exit(1);
  }

  console.log(`Path: ${result.distance} steps, ${result.staminaCost} stamina, reachedLimit=${result.reachedLimit}\n`);

  let cumCost = 0;
  console.log("Step | Display Coord | Biome                        | Step Cost | Cumulative | Synthetic?");
  console.log("-----|---------------|------------------------------|-----------|------------|----------");
  for (let i = 0; i < result.path.length; i++) {
    const p = result.path[i];
    const dx = toDisplayX(p.x);
    const dy = toDisplayY(p.y);
    const biomeId = augmentedGrid.getBiome(p.x, p.y);
    const biomeName = BiomeIdToType[biomeId] ?? "Unknown";
    const isSynth = syntheticTiles.has(`${p.x},${p.y}`);

    let stepCost = 0;
    if (i > 0) {
      if (isSynth) {
        stepCost = staminaConfig.exploreCost;
      } else if (biomeId > 0) {
        stepCost = travelStaminaCostById(biomeId, TroopType.Paladin, staminaConfig);
      } else {
        stepCost = staminaConfig.travelCost;
      }
      cumCost += stepCost;
    }

    const stepStr = i === 0 ? "START" : String(stepCost).padStart(9);
    const cumStr = String(cumCost).padStart(10);
    console.log(
      `${String(i).padStart(4)} | (${String(dx).padStart(3)},${String(dy).padStart(3)})       | ${biomeName.padEnd(28)} | ${stepStr} | ${cumStr} | ${isSynth ? "YES" : ""}`,
    );
  }

  // Now run the same path but along y=0 road to compare
  console.log("\n=== Manual y=0 road cost comparison (Paladin) ===\n");
  const roadTiles: Array<{ x: number; biomeId: number; biomeName: string; cost: number; isSynth: boolean; hasIt: boolean; occ: number }> = [];
  for (let x = 2; x <= 14; x++) {
    const rawX = toContractX(x);
    const rawY = toContractY(0);
    const biomeId = augmentedGrid.getBiome(rawX, rawY);
    const biomeName = BiomeIdToType[biomeId] ?? "Unknown";
    const isSynth = syntheticTiles.has(`${rawX},${rawY}`);
    const hasIt = augmentedGrid.has(rawX, rawY);
    const occ = augmentedGrid.getOccupier(rawX, rawY);
    let cost = 0;
    if (isSynth) {
      cost = staminaConfig.exploreCost;
    } else if (biomeId > 0) {
      cost = travelStaminaCostById(biomeId, TroopType.Paladin, staminaConfig);
    } else {
      cost = staminaConfig.travelCost;
    }
    roadTiles.push({ x, biomeId, biomeName, cost, isSynth, hasIt, occ });
  }

  let roadCum = 0;
  // First step: (1,1) to (2,0) — need to check this tile too
  {
    const rawX = toContractX(1);
    const rawY = toContractY(0);
    const biomeId = augmentedGrid.getBiome(rawX, rawY);
    const biomeName = BiomeIdToType[biomeId] ?? "Unknown";
    const cost = biomeId > 0 ? travelStaminaCostById(biomeId, TroopType.Paladin, staminaConfig) : staminaConfig.travelCost;
    roadCum += cost;
    console.log(`(  1,  0) | ${biomeName.padEnd(28)} | cost ${cost} | cum ${roadCum}`);
  }

  for (const t of roadTiles) {
    roadCum += t.cost;
    const blocked = t.occ !== 0 ? ` BLOCKED(occ=${t.occ})` : "";
    const missing = !t.hasIt ? " MISSING" : "";
    console.log(`(${String(t.x).padStart(3)},  0) | ${t.biomeName.padEnd(28)} | cost ${t.cost} | cum ${roadCum}${t.isSynth ? " SYNTH" : ""}${blocked}${missing}`);
  }

  console.log(`\nA* path total: ${result.staminaCost}`);
  console.log(`y=0 road total: ${roadCum}`);
  console.log(`Difference: ${result.staminaCost - roadCum} (${result.staminaCost < roadCum ? "A* is cheaper" : result.staminaCost > roadCum ? "ROAD IS CHEAPER" : "same cost"})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
