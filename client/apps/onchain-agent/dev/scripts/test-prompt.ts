/**
 * Test script that simulates a single automation tick.
 *
 * Connects to a live Torii, fetches structures and game config,
 * then runs the exact same automation logic as loop.ts for one
 * realm — showing what it would build, produce, and consume.
 *
 * Usage:
 *   NODE_OPTIONS='--experimental-wasm-modules --disable-warning=ExperimentalWarning' npx tsx dev/scripts/test-prompt.ts
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { EternumClient } from "@bibliothecadao/client";
import type { GameConfig } from "@bibliothecadao/torii";
import { renderMap } from "../../src/map/renderer.js";
import type { MapContext } from "../../src/map/context.js";
import { buildSystemPrompt } from "../../src/entry/soul.js";
import { bootstrapDataDir } from "../../src/entry/bootstrap.js";
import { parseRealmSnapshot } from "../../src/automation/snapshot.js";
import { nextPlan } from "../../src/automation/runner.js";
import { buildOrderForBiome, troopPathForBiome } from "../../src/automation/build-order.js";
import { planProduction } from "../../src/automation/production.js";
import { findOpenSlots } from "../../src/automation/placement.js";
import { formatStatus, type RealmStatus } from "../../src/automation/status.js";
import type { RealmState } from "../../src/automation/runner.js";

// ---------------------------------------------------------------------------
// Config — hardcoded for the fruity-fruity-sandbox world
// ---------------------------------------------------------------------------

const TORII_URL = "https://api.cartridge.gg/x/fruity-fruity-sandbox/torii";
const WORLD_ADDRESS = "0x03b060cd79fc792c601bc83648c56958c8c69e5f96511880dcf2ddbf48907688";
const PLAYER_ADDRESS = "0x62ba685f1d600ac7bda27e556b787548da32c7c0aa3ff5f58dddc07b9116f33";
const DATA_DIR = join(homedir(), ".axis", "worlds", WORLD_ADDRESS);
const OUTPUT_FILE = join(process.cwd(), "test-prompt-output.txt");

// ---------------------------------------------------------------------------
// Resource name lookup (for readable output)
// ---------------------------------------------------------------------------

const RESOURCE_NAMES: Record<number, string> = {
  1: "Stone", 2: "Coal", 3: "Wood", 4: "Copper", 5: "Ironwood",
  6: "Obsidian", 7: "Gold", 8: "Silver", 9: "Mithral", 10: "AlchemicalSilver",
  11: "ColdIron", 12: "DeepCrystal", 13: "Ruby", 14: "Diamonds",
  15: "Hartwood", 16: "Ignium", 17: "TwilightQuartz", 18: "TrueIce",
  19: "Adamantine", 20: "Sapphire", 21: "EtherealSilica", 22: "Dragonhide",
  23: "Labor", 24: "AncientFragment", 25: "Donkey",
  26: "Knight", 27: "KnightT2", 28: "KnightT3",
  29: "Crossbowman", 30: "CrossbowmanT2", 31: "CrossbowmanT3",
  32: "Paladin", 33: "PaladinT2", 34: "PaladinT3",
  35: "Wheat", 36: "Fish", 37: "Earthenshard", 38: "Essence",
};

function rName(id: number): string {
  return RESOURCE_NAMES[id] ?? `Resource(${id})`;
}

function categoryName(category: number): string {
  return category === 1 ? "Realm" : category === 5 ? "Village" : `Structure(${category})`;
}

// ---------------------------------------------------------------------------
// Building cost scaling — same logic as loop.ts
// ---------------------------------------------------------------------------

function scaledBuildingCost(
  buildingType: number,
  existingQuantity: number,
  gameConfig: GameConfig,
  useSimple: boolean = false,
): { resource: number; amount: number }[] {
  const config = gameConfig.buildingCosts[buildingType];
  if (!config) return [];
  const costs = useSimple ? config.simpleCosts : config.complexCosts;
  if (costs.length === 0) return [];

  const percentIncrease = gameConfig.buildingBaseCostPercentIncrease / 10000;
  const scaleFactor = Math.max(0, existingQuantity - 1);

  return costs.map((cost) => ({
    resource: cost.resource,
    amount: cost.amount + scaleFactor * scaleFactor * cost.amount * percentIncrease,
  }));
}

function reserveBuildingCosts(
  balances: Map<number, number>,
  costs: { resource: number; amount: number }[],
): boolean {
  for (const cost of costs) {
    if ((balances.get(cost.resource) ?? 0) < cost.amount) return false;
  }
  for (const cost of costs) {
    balances.set(cost.resource, (balances.get(cost.resource) ?? 0) - cost.amount);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Test Prompt Builder");
  console.log(`  Torii: ${TORII_URL}`);
  console.log(`  World: ${WORLD_ADDRESS}`);
  console.log(`  Player: ${PLAYER_ADDRESS}`);
  console.log(`  Data dir: ${DATA_DIR}`);
  console.log();

  bootstrapDataDir(DATA_DIR);

  // Connect to Torii
  console.log("Connecting to Torii...");
  const client = await EternumClient.create({ toriiUrl: TORII_URL });
  const sql = client.sql as any;

  // Fetch game config
  console.log("Fetching game config...");
  const gameConfig: GameConfig = await sql.fetchGameConfig();
  console.log(
    `  ${Object.keys(gameConfig.buildingCosts).length} building types, ` +
    `${Object.keys(gameConfig.resourceFactories).length} recipes, ` +
    `cost scale ${gameConfig.buildingBaseCostPercentIncrease}`,
  );

  // Fetch map
  console.log("Fetching map...");
  const area = await client.view.mapArea({ x: 0, y: 0, radius: 999_999 });
  console.log(`  ${area.tiles.length} tiles`);

  // Fetch owned structures
  let allStructures: { entity_id: number; coord_x: number; coord_y: number; category: number; level: number }[] = [];
  try {
    if (typeof sql.fetchPlayerStructures === "function") {
      allStructures = await sql.fetchPlayerStructures(PLAYER_ADDRESS);
    } else if (typeof sql.fetchStructuresByOwner === "function") {
      allStructures = await sql.fetchStructuresByOwner(PLAYER_ADDRESS);
    }
  } catch {
    console.log("  Could not fetch owned structures");
  }

  // Display structures with correct type
  const structures = allStructures.filter((s) => s.category === 1 || s.category === 5);
  const realms = structures.filter((s) => s.category === 1);
  const villages = structures.filter((s) => s.category === 5);
  console.log(`  ${allStructures.length} structures total: ${realms.length} Realms, ${villages.length} Villages`);

  if (structures.length === 0) {
    console.log("\nNo realms or villages found. Nothing to simulate.");
    return;
  }

  const ownedEntityIds = new Set(allStructures.map((s) => Number(s.entity_id)));
  const snapshot = renderMap(area.tiles, ownedEntityIds.size > 0 ? ownedEntityIds : undefined);
  const mapCtx: MapContext = { snapshot, filePath: null };

  // Pick first realm for detailed simulation
  const target = structures[0];
  const targetEntityId = Number(target.entity_id);
  const targetType = categoryName(target.category);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Simulating automation tick for ${targetType} ${targetEntityId}`);
  console.log(`  Position: (${target.coord_x}, ${target.coord_y})`);
  console.log(`  Level: ${target.level || 1}`);
  console.log(`${"=".repeat(60)}`);

  // Fetch data for this realm
  const entityIds = [targetEntityId];
  const [balanceRows, buildingRows] = await Promise.all([
    (async () => {
      try {
        const rows = await sql.fetchResourceBalancesAndProduction(entityIds);
        return rows?.[0] ?? null;
      } catch {
        return null;
      }
    })(),
    (async () => {
      try {
        if (typeof sql.fetchBuildingsByStructures === "function") {
          return await sql.fetchBuildingsByStructures(entityIds) as {
            outer_entity_id: number; inner_col: number; inner_row: number; category: number;
          }[];
        }
      } catch { /* ignore */ }
      return [] as { outer_entity_id: number; inner_col: number; inner_row: number; category: number }[];
    })(),
  ]);

  // Parse snapshot
  const snap = parseRealmSnapshot(balanceRows);
  const biome = snapshot.gridIndex.get(`${target.coord_x},${target.coord_y}`)?.biome ?? 11;
  const level = target.level || 1;

  // Group buildings
  const occupied = new Set<string>();
  const buildingCounts = new Map<number, number>();
  for (const b of buildingRows) {
    occupied.add(`${b.inner_col},${b.inner_row}`);
    buildingCounts.set(b.category, (buildingCounts.get(b.category) ?? 0) + 1);
  }

  // --- Phase 1: Display current state ---
  console.log(`\n--- Current State ---`);
  console.log(`Biome: ${biome}`);
  console.log(`Buildings: ${buildingRows.length} placed, ${occupied.size} slots occupied`);
  if (buildingCounts.size > 0) {
    for (const [cat, count] of [...buildingCounts.entries()].sort((a, b) => a[0] - b[0])) {
      console.log(`  Category ${cat}: ${count}`);
    }
  }

  console.log(`\nResource balances:`);
  const sortedBalances = [...snap.balances.entries()].sort((a, b) => a[0] - b[0]);
  for (const [resourceId, amount] of sortedBalances) {
    if (amount > 0) {
      console.log(`  ${rName(resourceId).padEnd(20)} ${amount.toFixed(2)}`);
    }
  }

  console.log(`\nBuilding counts: [${[...buildingCounts.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}×${v}`).join(", ")}]`);

  // --- Phase 2: Resolve build plan (same as loop.ts) ---
  console.log(`\n--- Build Order ---`);
  const realmState: RealmState = { biome, level, buildingCounts };
  const plan = nextPlan(realmState, gameConfig.buildingCosts);
  const buildOrder = buildOrderForBiome(biome);
  const troopPath = troopPathForBiome(biome);

  console.log(`Troop path: ${troopPath}`);
  console.log(`Planned builds: ${plan.builds.length}`);
  if (plan.upgrade) console.log(`Upgrade: ${plan.upgrade.fromName} → ${plan.upgrade.toName}`);
  if (plan.idle) console.log(`Idle: ${plan.idle}`);

  for (const b of plan.builds) {
    console.log(`  → ${b.step.label} (type ${b.step.building}, index ${b.index})`);
  }

  // --- Phase 3: Reserve building costs (same as loop.ts) ---
  console.log(`\n--- Building Cost Reservation ---`);
  const productionBalances = new Map(snap.balances);
  const { slots } = findOpenSlots(occupied, level, plan.builds.length);
  const runningCounts = new Map(buildingCounts);
  const buildActions: Array<{ step: any; slot: any; useSimple: boolean }> = [];

  for (let bi = 0; bi < plan.builds.length && bi < slots.length; bi++) {
    const { step } = plan.builds[bi];
    const slot = slots[bi];
    const existingQuantity = runningCounts.get(step.building) ?? 0;

    const complexCosts = scaledBuildingCost(step.building, existingQuantity, gameConfig, false);
    let reserved = false;
    let useSimple = false;

    if (complexCosts.length > 0) {
      console.log(`${step.label} (complex, qty ${existingQuantity}):`);
      for (const cost of complexCosts) {
        const balance = productionBalances.get(cost.resource) ?? 0;
        console.log(`  ${rName(cost.resource).padEnd(20)} need ${cost.amount.toFixed(2)}, have ${balance.toFixed(2)} ${balance >= cost.amount ? "✓" : "✗"}`);
      }
      reserved = reserveBuildingCosts(productionBalances, complexCosts);
    }

    if (!reserved) {
      const simpleCosts = scaledBuildingCost(step.building, existingQuantity, gameConfig, true);
      if (simpleCosts.length > 0) {
        console.log(`${step.label} (simple fallback, qty ${existingQuantity}):`);
        for (const cost of simpleCosts) {
          const balance = productionBalances.get(cost.resource) ?? 0;
          console.log(`  ${rName(cost.resource).padEnd(20)} need ${cost.amount.toFixed(2)}, have ${balance.toFixed(2)} ${balance >= cost.amount ? "✓" : "✗"}`);
        }
        reserved = reserveBuildingCosts(productionBalances, simpleCosts);
        if (reserved) useSimple = true;
      }
    }

    if (!reserved) {
      console.log(`→ Cannot afford ${step.label} — stopping build chain`);
      break;
    }

    console.log(`→ Reserved ${step.label} (${useSimple ? "simple" : "complex"}) at col=${slot.col},row=${slot.row}`);
    buildActions.push({ step, slot, useSimple });
    runningCounts.set(step.building, existingQuantity + 1);
  }

  console.log(`\nTotal builds this tick: ${buildActions.length}`);

  // --- Phase 4: Plan production (same as loop.ts) ---
  console.log(`\n--- Production Plan ---`);
  const isTargetVillage = target.category === 5;
  const plan = planProduction(productionBalances, buildingCounts, troopPath, gameConfig, 60, isTargetVillage);

  if (plan.calls.length > 0) {
    console.log(`Production calls (${plan.calls.length}):`);
    for (const call of plan.calls) {
      console.log(`  ${call.method.padEnd(8)} ${rName(call.resourceId).padEnd(20)} ${call.cycles} cycles → ${call.produced.toFixed(2)} produced`);
    }

    console.log(`\nResources consumed:`);
    for (const [resourceId, amount] of [...plan.consumed.entries()].sort((a, b) => a[0] - b[0])) {
      const original = snap.balances.get(resourceId) ?? 0;
      const pct = original > 0 ? ((amount / original) * 100).toFixed(1) : "N/A";
      console.log(`  ${rName(resourceId).padEnd(20)} ${amount.toFixed(2)} of ${original.toFixed(2)} (${pct}%)`);
    }

    console.log(`\nResources produced:`);
    for (const [resourceId, amount] of [...plan.produced.entries()].sort((a, b) => a[0] - b[0])) {
      console.log(`  ${rName(resourceId).padEnd(20)} +${amount.toFixed(2)}`);
    }
  } else {
    console.log(`No production calls planned`);
  }

  if (plan.skipped.length > 0) {
    console.log(`\nSkipped resources:`);
    for (const skip of plan.skipped) {
      console.log(`  ${rName(skip.resourceId).padEnd(20)} ${skip.reason}`);
    }
  }

  // --- Phase 5: Summary — what executeRealmTick would do ---
  console.log(`\n--- Execution Summary (dry-run) ---`);

  const resourceToResource = plan.calls
    .filter((c) => c.method === "complex")
    .map((c) => ({ resource_id: c.resourceId, cycles: c.cycles }));
  const laborToResource = plan.calls
    .filter((c) => c.method === "simple")
    .map((c) => ({ resource_id: c.resourceId, cycles: c.cycles }));

  if (resourceToResource.length > 0) {
    console.log(`1. execute_realm_production_plan:`);
    console.log(`   resource_to_resource: [${resourceToResource.map((r) => `${rName(r.resource_id)}×${r.cycles}`).join(", ")}]`);
    if (laborToResource.length > 0) {
      console.log(`   labor_to_resource: [${laborToResource.map((r) => `${rName(r.resource_id)}×${r.cycles}`).join(", ")}]`);
    }
  } else if (laborToResource.length > 0) {
    console.log(`1. execute_realm_production_plan:`);
    console.log(`   labor_to_resource: [${laborToResource.map((r) => `${rName(r.resource_id)}×${r.cycles}`).join(", ")}]`);
  } else {
    console.log(`1. Production: SKIP (nothing to produce)`);
  }

  if (buildActions.length > 0) {
    console.log(`2. create_building (${buildActions.length} builds):`);
    for (const ba of buildActions) {
      console.log(`   ${ba.step.label} (type ${ba.step.building}, ${ba.useSimple ? "simple" : "complex"}) → [${ba.slot.directions.join(", ")}]`);
    }
  } else {
    console.log(`2. Build: SKIP`);
  }

  if (plan.upgrade) {
    console.log(`3. upgrade_realm: ${plan.upgrade.fromName} → ${plan.upgrade.toName}`);
  } else {
    console.log(`3. Upgrade: SKIP`);
  }

  // --- Build status for all structures (compact) ---
  console.log(`\n${"=".repeat(60)}`);
  console.log(`All ${structures.length} structures (compact):`);
  console.log(`${"=".repeat(60)}`);

  // Fetch buildings for all structures at once
  const allEntityIds = structures.map((s) => Number(s.entity_id));
  let allBuildingRows: { outer_entity_id: number; inner_col: number; inner_row: number; category: number }[] = [];
  try {
    if (typeof sql.fetchBuildingsByStructures === "function") {
      allBuildingRows = await sql.fetchBuildingsByStructures(allEntityIds);
    }
  } catch { /* ignore */ }

  const allBuildingCountsByRealm = new Map<number, Map<number, number>>();
  for (const br of allBuildingRows) {
    if (!allBuildingCountsByRealm.has(br.outer_entity_id)) allBuildingCountsByRealm.set(br.outer_entity_id, new Map());
    const counts = allBuildingCountsByRealm.get(br.outer_entity_id)!;
    counts.set(br.category, (counts.get(br.category) ?? 0) + 1);
  }

  const realmStatuses: RealmStatus[] = [];

  for (const s of structures) {
    const eid = Number(s.entity_id);
    const type = categoryName(s.category);
    let row = null;
    try {
      const rows = await sql.fetchResourceBalancesAndProduction([eid]);
      row = rows?.[0] ?? null;
    } catch { /* skip */ }

    const sn = parseRealmSnapshot(row);
    const bc = allBuildingCountsByRealm.get(eid) ?? sn.buildingCounts;
    const b = snapshot.gridIndex.get(`${s.coord_x},${s.coord_y}`)?.biome ?? 11;
    const lv = s.level || 1;
    const rs: RealmState = { biome: b, level: lv, buildingCounts: bc };
    const rp = nextPlan(rs, gameConfig.buildingCosts);
    const bo = buildOrderForBiome(b);
    const tp = troopPathForBiome(b);
    const isVillage = s.category === 5;
    const pp = planProduction(sn.balances, bc, tp, gameConfig, 60, isVillage);

    const lastIdx = rp.builds.length > 0 ? rp.builds[rp.builds.length - 1].index : bo.steps.length;
    const prog = `${lastIdx}/${bo.steps.length}`;
    const action = rp.builds.length > 0 ? `build×${rp.builds.length}` : rp.upgrade ? "upgrade" : "idle";

    console.log(`  ${type} ${eid}: ${action}, progress=${prog}, production_calls=${pp.calls.length}`);

    realmStatuses.push({
      realmEntityId: eid,
      realmName: `${type} ${eid}`,
      biome: b,
      level: lv,
      buildOrderProgress: prog,
      tickResult: {
        realmEntityId: eid,
        built: rp.builds.map((bi) => bi.step.label),
        upgraded: rp.upgrade ? `${rp.upgrade.fromName} → ${rp.upgrade.toName}` : null,
        produced: pp.calls.length > 0,
        idle: rp.builds.length === 0 && !rp.upgrade && pp.calls.length === 0,
        errors: [],
      },
      essencePulse: { balance: sn.balances.get(38) ?? 0, sufficient: true },
      wheatPulse: {
        balance: sn.balances.get(35) ?? 0,
        low: (sn.balances.get(35) ?? 0) < 200,
      },
    });
  }

  // Write output file
  const systemPrompt = buildSystemPrompt(DATA_DIR);
  const mapText = mapCtx.snapshot?.text ?? "Map not yet loaded.";
  const tickPrompt = [
    "## Tick — New Turn", "", "Current map:", mapText, "",
    "Review your priorities and decide what to do this turn.",
    "Use inspect to examine targets, move_army to reposition, attack to engage, or create_army to build forces.",
  ].join("\n");

  const automationStatus = realmStatuses.length > 0
    ? formatStatus({ timestamp: new Date(), realms: realmStatuses })
    : "No owned realms found — automation would be idle.";

  const fullOutput = [
    "=".repeat(80),
    "SYSTEM PROMPT",
    "=".repeat(80),
    "", systemPrompt, "",
    "=".repeat(80),
    "TICK PROMPT (user message)",
    "=".repeat(80),
    "", tickPrompt, "",
    "=".repeat(80),
    "AUTOMATION DRY-RUN",
    "=".repeat(80),
    "", automationStatus, "",
    "=".repeat(80),
    "METADATA",
    "=".repeat(80),
    "",
    `Torii URL: ${TORII_URL}`,
    `World Address: ${WORLD_ADDRESS}`,
    `Player Address: ${PLAYER_ADDRESS}`,
    `Data Dir: ${DATA_DIR}`,
    `Tiles: ${area.tiles.length}`,
    `Structures: ${realms.length} Realms, ${villages.length} Villages`,
    `Map rows: ${snapshot.text.split("\n").length}`,
    `System prompt chars: ${systemPrompt.length}`,
    `Tick prompt chars: ${tickPrompt.length}`,
    `Total chars: ${systemPrompt.length + tickPrompt.length}`,
    `Generated: ${new Date().toISOString()}`,
    "",
  ].join("\n");

  writeFileSync(OUTPUT_FILE, fullOutput);
  console.log(`\nWrote ${fullOutput.length} chars to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
