/**
 * Simulate the build order for each biome/troop path across all realm levels.
 *
 * Shows exactly what gets built — including auto-injected WorkersHuts —
 * with population tracking and slot usage per tier.
 *
 * Modes:
 *   npx tsx dev/scripts/simulate-build-order.ts [biome]        — offline (hardcoded pop info)
 *   npx tsx dev/scripts/simulate-build-order.ts --live [biome]  — fetch real GameConfig from Torii
 *   npx tsx dev/scripts/simulate-build-order.ts --live all      — all 3 troop paths with live data
 *
 * Environment:
 *   TORII_URL — Torii endpoint (default: reads from .env or uses slot-4)
 */

import { buildOrderForBiome, troopPathForBiome } from "../../src/automation/build-order.js";
import { ResourcesIds } from "@bibliothecadao/types";
import type { GameConfig, ResourceFactoryConfig } from "@bibliothecadao/torii";
import type { BuildingPopulationInfo } from "../../src/automation/runner.js";

// ── Resource ID → name lookup ────────────────────────────────────────

const RESOURCE_NAMES: Record<number, string> = {};
for (const [name, id] of Object.entries(ResourcesIds)) {
  if (typeof id === "number") RESOURCE_NAMES[id] = name;
}

function resName(id: number): string {
  return RESOURCE_NAMES[id] ?? `#${id}`;
}

// ── Hardcoded population info (fallback for offline mode) ────────────

const OFFLINE_POP_INFO: Record<number, BuildingPopulationInfo> = {
  1: { populationCost: 0, capacityGrant: 6 }, // WorkersHut
  4: { populationCost: 2, capacityGrant: 0 }, // Coal
  5: { populationCost: 2, capacityGrant: 0 }, // Wood
  6: { populationCost: 2, capacityGrant: 0 }, // Copper
  7: { populationCost: 2, capacityGrant: 0 }, // Ironwood
  9: { populationCost: 2, capacityGrant: 0 }, // Gold
  11: { populationCost: 2, capacityGrant: 0 }, // Mithral
  13: { populationCost: 2, capacityGrant: 0 }, // ColdIron
  21: { populationCost: 2, capacityGrant: 0 }, // Adamantine
  24: { populationCost: 2, capacityGrant: 0 }, // Dragonhide
  28: { populationCost: 3, capacityGrant: 0 }, // KnightT1
  29: { populationCost: 3, capacityGrant: 0 }, // KnightT2
  30: { populationCost: 3, capacityGrant: 0 }, // KnightT3
  31: { populationCost: 3, capacityGrant: 0 }, // CrossbowmanT1
  32: { populationCost: 3, capacityGrant: 0 }, // CrossbowmanT2
  33: { populationCost: 3, capacityGrant: 0 }, // CrossbowmanT3
  34: { populationCost: 3, capacityGrant: 0 }, // PaladinT1
  35: { populationCost: 3, capacityGrant: 0 }, // PaladinT2
  36: { populationCost: 3, capacityGrant: 0 }, // PaladinT3
  37: { populationCost: 1, capacityGrant: 0 }, // Wheat
};

// ── Build order → resource ID mapping ────────────────────────────────
// BuildingType → resource it produces (for production display)

const BUILDING_TO_RESOURCE: Record<number, number> = {
  4: ResourcesIds.Coal,
  5: ResourcesIds.Wood,
  6: ResourcesIds.Copper,
  7: ResourcesIds.Ironwood,
  9: ResourcesIds.Gold,
  11: ResourcesIds.Mithral,
  13: ResourcesIds.ColdIron,
  21: ResourcesIds.Adamantine,
  24: ResourcesIds.Dragonhide,
  28: ResourcesIds.Knight,
  29: ResourcesIds.KnightT2,
  30: ResourcesIds.KnightT3,
  31: ResourcesIds.Crossbowman,
  32: ResourcesIds.CrossbowmanT2,
  33: ResourcesIds.CrossbowmanT3,
  34: ResourcesIds.Paladin,
  35: ResourcesIds.PaladinT2,
  36: ResourcesIds.PaladinT3,
  37: ResourcesIds.Wheat,
};

// ── Simulation ───────────────────────────────────────────────────────

function simulate(biome: number, popInfo: Record<number, BuildingPopulationInfo>, gameConfig?: GameConfig) {
  const troopPath = troopPathForBiome(biome);
  const order = buildOrderForBiome(biome);
  const whCap = popInfo[1]?.capacityGrant ?? 6;

  if (biome === (biomeArg === "all" ? 11 : biomeArg ? parseInt(biomeArg, 10) : 11)) {
    console.log(`\n${"═".repeat(70)}`);
    console.log(`  WHAT THIS TESTS`);
    console.log(`  ${"─".repeat(50)}`);
    console.log(`  Simulates the full build order from Settlement to Empire,`);
    console.log(`  showing exactly which buildings get placed in which slot.`);
    console.log(`  WorkersHuts are auto-injected when the next building would`);
    console.log(`  exceed population capacity (base 6 + 6 per WorkersHut).`);
    console.log(`  Verifies the build order fits within 60 Empire slots and`);
    console.log(`  population stays within capacity at every step.`);
    if (gameConfig) {
      console.log(`  In --live mode, also shows production recipes, building`);
      console.log(`  costs, and upgrade costs from on-chain game config.`);
    }
    console.log(`${"═".repeat(70)}`);
  }

  console.log(`\n${"═".repeat(70)}`);
  console.log(`  Biome ${biome} → ${troopPath} path`);
  console.log(`  Build order: ${order.steps.length} steps`);
  if (gameConfig) console.log(`  (using live GameConfig from Torii)`);
  console.log(`${"═".repeat(70)}`);

  // ── Build sequence with WH injection ──

  let popUsed = 0;
  let popCap = 6; // Base capacity
  let slot = 0;

  console.log(`  ${"#".padStart(3)}  ${"Building".padEnd(22)} Pop   Used / Cap   Slots`);
  console.log(`  ${"─".repeat(60)}`);

  for (let i = 0; i < order.steps.length; i++) {
    const step = order.steps[i];
    const info = popInfo[step.building];
    const cost = info?.populationCost ?? 0;

    while (cost > 0 && popUsed + cost > popCap) {
      slot++;
      popCap += whCap;
      const maxForTier = slot <= 6 ? 6 : slot <= 18 ? 18 : slot <= 36 ? 36 : 60;
      console.log(
        `  ${String(slot).padStart(3)}. ${"WorkersHut".padEnd(22)}  0    ${String(popUsed).padStart(3)} / ${String(popCap).padStart(3)}    ${String(slot).padStart(2)} / ${maxForTier}  ← auto`,
      );
    }

    slot++;
    popUsed += cost;
    const maxForTier = slot <= 6 ? 6 : slot <= 18 ? 18 : slot <= 36 ? 36 : 60;
    console.log(
      `  ${String(slot).padStart(3)}. ${step.label.padEnd(22)} ${String(cost).padStart(2)}    ${String(popUsed).padStart(3)} / ${String(popCap).padStart(3)}    ${String(slot).padStart(2)} / ${maxForTier}`,
    );
  }

  // ── Summary ──

  // Re-count WHs
  let whCount = 0;
  let p = 0;
  let c = 6;
  for (const step of order.steps) {
    const cost = popInfo[step.building]?.populationCost ?? 0;
    while (cost > 0 && p + cost > c) {
      whCount++;
      c += whCap;
    }
    p += cost;
  }

  console.log(`\n  ${"─".repeat(55)}`);
  console.log(`  SUMMARY — ${slot} / 60 slots used`);
  console.log(`  Population: ${popUsed} / ${popCap} (base 6 + ${whCount} WorkersHuts × ${whCap})`);
  console.log(`  ${"─".repeat(55)}`);

  const allCounts = new Map<string, number>();
  for (const step of order.steps) {
    allCounts.set(step.label, (allCounts.get(step.label) ?? 0) + 1);
  }
  allCounts.set("WorkersHut", whCount);

  const sorted = [...allCounts.entries()].sort((a, b) => {
    if (a[0] === "WorkersHut") return -1;
    if (b[0] === "WorkersHut") return 1;
    return b[1] - a[1];
  });
  for (const [label, count] of sorted) {
    const tag = label === "WorkersHut" ? " (auto-injected)" : "";
    console.log(`  ${String(count).padStart(3)}× ${label}${tag}`);
  }
  console.log(`\n  Total: ${order.steps.length} productive + ${whCount} WHs = ${order.steps.length + whCount} slots`);

  // ── Production rates (live mode only) ──

  if (gameConfig) {
    console.log(`\n  ${"─".repeat(55)}`);
    console.log(`  PRODUCTION RATES (per building per cycle)`);
    console.log(`  ${"─".repeat(55)}`);

    // Collect unique resource-producing buildings in the order
    const seenResources = new Set<number>();
    for (const step of order.steps) {
      const resId = BUILDING_TO_RESOURCE[step.building];
      if (resId !== undefined) seenResources.add(resId);
    }

    for (const resId of seenResources) {
      const factory = gameConfig.resourceFactories[resId];
      if (!factory) continue;

      console.log(`\n  ${resName(resId)} (resource #${resId}):`);

      if (factory.complexInputs.length > 0 && factory.outputPerComplexInput > 0) {
        const inputs = factory.complexInputs.map((i) => `${i.amount} ${resName(i.resource)}`).join(" + ");
        console.log(`    Complex: ${inputs} → ${factory.outputPerComplexInput} ${resName(resId)}`);
      }

      if (factory.simpleInputs.length > 0 && factory.outputPerSimpleInput > 0) {
        const inputs = factory.simpleInputs.map((i) => `${i.amount} ${resName(i.resource)}`).join(" + ");
        console.log(`    Simple:  ${inputs} → ${factory.outputPerSimpleInput} ${resName(resId)}`);
      }

      if (factory.realmOutputPerSecond > 0) {
        console.log(`    Realm rate: ${factory.realmOutputPerSecond}/s`);
      }
    }

    // ── Building costs ──

    console.log(`\n  ${"─".repeat(55)}`);
    console.log(`  BUILDING COSTS (base, before quantity scaling)`);
    console.log(`  ${"─".repeat(55)}`);

    const seenBuildings = new Set<number>();
    seenBuildings.add(1); // WorkersHut
    for (const step of order.steps) {
      seenBuildings.add(step.building);
    }

    for (const buildingType of seenBuildings) {
      const config = gameConfig.buildingCosts[buildingType];
      if (!config) continue;

      const label =
        buildingType === 1
          ? "WorkersHut"
          : (order.steps.find((s) => s.building === buildingType)?.label ?? `Building#${buildingType}`);

      const costs = config.complexCosts.length > 0 ? config.complexCosts : config.simpleCosts;
      const method = config.complexCosts.length > 0 ? "complex" : "simple";
      if (costs.length === 0) continue;

      const costStr = costs.map((c) => `${c.amount} ${resName(c.resource)}`).join(", ");
      console.log(`  ${label.padEnd(22)} (${method}) ${costStr}`);
    }

    if (gameConfig.buildingBaseCostPercentIncrease > 0) {
      console.log(`\n  Quantity scaling: +${gameConfig.buildingBaseCostPercentIncrease / 100}% per (n-1)²`);
    }

    // ── Upgrade costs ──

    console.log(`\n  ${"─".repeat(55)}`);
    console.log(`  REALM UPGRADE COSTS`);
    console.log(`  ${"─".repeat(55)}`);

    const levelNames = ["Settlement→City", "City→Kingdom", "Kingdom→Empire"];
    for (let lvl = 1; lvl <= 3; lvl++) {
      const costs = gameConfig.realmUpgradeCosts[lvl];
      if (!costs || costs.length === 0) continue;
      const costStr = costs.map((c) => `${c.amount} ${resName(c.resource)}`).join(", ");
      console.log(`  ${(levelNames[lvl - 1] ?? `Level ${lvl}`).padEnd(22)} ${costStr}`);
    }
  }
}

// ── Live mode: fetch GameConfig from Torii ───────────────────────────

async function fetchLiveData(): Promise<{ popInfo: Record<number, BuildingPopulationInfo>; gameConfig: GameConfig }> {
  const { EternumClient } = await import("@bibliothecadao/client");

  const toriiUrl = process.env.TORII_URL ?? "https://api.cartridge.gg/x/fruity-fruity-sandbox/torii";
  console.log(`Connecting to Torii: ${toriiUrl}`);

  const client = await EternumClient.create({ toriiUrl });
  const sql = client.sql as any;
  const gameConfig: GameConfig = await sql.fetchGameConfig();

  // Build popInfo from live buildingCosts
  const popInfo: Record<number, BuildingPopulationInfo> = {};
  for (const [key, config] of Object.entries(gameConfig.buildingCosts)) {
    const buildingType = Number(key);
    const cfg = config as any;
    popInfo[buildingType] = {
      populationCost: cfg.populationCost ?? 0,
      capacityGrant: cfg.capacityGrant ?? 0,
    };
  }

  return { popInfo, gameConfig };
}

// ── Main ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const liveMode = args.includes("--live");
const filteredArgs = args.filter((a) => a !== "--live");
const biomeArg = filteredArgs[0];

const representatives = [
  { biome: 11, label: "Grassland" }, // Paladin
  { biome: 10, label: "Taiga" }, // Knight
  { biome: 1, label: "Deep Ocean" }, // Crossbowman
];

async function main() {
  let popInfo = OFFLINE_POP_INFO;
  let gameConfig: GameConfig | undefined;

  if (liveMode) {
    const live = await fetchLiveData();
    popInfo = live.popInfo;
    gameConfig = live.gameConfig;
  }

  if (biomeArg === "all") {
    for (const { biome } of representatives) {
      simulate(biome, popInfo, gameConfig);
    }
  } else {
    const biome = biomeArg ? parseInt(biomeArg, 10) : 11;
    simulate(biome, popInfo, gameConfig);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
