import { writeFileSync } from "fs";
import { join } from "path";
import type { EternumClient } from "@bibliothecadao/client";
import type { EternumProvider } from "@bibliothecadao/provider";
import type { GameConfig } from "@bibliothecadao/torii";
import type { MapContext } from "../map/context.js";
import { parseRealmSnapshot } from "./snapshot.js";
import { resolvePlan } from "./runner.js";
import { buildOrderForBiome, troopPathForBiome } from "./build-order.js";
import { planProduction } from "./production.js";
import { findOpenSlots } from "./placement.js";
import { executeRealmTick, type BuildAction, type UpgradeAction, type ProductionActions } from "./executor.js";
import { formatStatus, type RealmStatus } from "./status.js";
import type { RealmState } from "./runner.js";

interface AutomationLoop {
  start(): void;
  stop(): void;
  refresh(): Promise<void>;
  readonly isRunning: boolean;
}

/**
 * Compute the scaled building cost for a given building type.
 *
 * Formula (matches game client getBuildingCosts):
 *   totalCost = baseCost + (quantity - 1)² × baseCost × (percentIncrease / 10000)
 *
 * Returns an array of { resource, amount } with scaled amounts, or empty if
 * no cost data is available for this building type.
 */
function scaledBuildingCost(
  buildingType: number,
  existingQuantity: number,
  gameConfig: GameConfig,
  useSimple: boolean,
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

/**
 * Check if all costs are affordable without modifying the balances map.
 */
function canAfford(balances: Map<number, number>, costs: { resource: number; amount: number }[]): boolean {
  for (const cost of costs) {
    const balance = balances.get(cost.resource) ?? 0;
    if (balance < cost.amount) return false;
  }
  return true;
}

/**
 * Subtract building costs from a balances map in-place.
 * Returns true if all costs could be reserved, false if any resource was insufficient.
 */
function reserveBuildingCosts(balances: Map<number, number>, costs: { resource: number; amount: number }[]): boolean {
  // Check all costs are affordable first
  for (const cost of costs) {
    const balance = balances.get(cost.resource) ?? 0;
    if (balance < cost.amount) return false;
  }

  // Subtract
  for (const cost of costs) {
    const balance = balances.get(cost.resource) ?? 0;
    balances.set(cost.resource, balance - cost.amount);
  }

  return true;
}

export function createAutomationLoop(
  client: EternumClient,
  provider: EternumProvider,
  signer: any,
  playerAddress: string,
  dataDir: string,
  mapCtx: MapContext,
  gameConfig: GameConfig,
  intervalMs = 60_000,
): AutomationLoop {
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;
  let tickCount = 0;

  async function tick() {
    tickCount++;
    try {
      // Phase 1: Discover owned realms
      const sql = client.sql as any;
      if (typeof sql.fetchStructuresByOwner !== "function") return;

      const allStructures: { entity_id: number; coord_x: number; coord_y: number; category: number; level: number }[] =
        typeof sql.fetchPlayerStructures === "function"
          ? await sql.fetchPlayerStructures(playerAddress)
          : await sql.fetchStructuresByOwner(playerAddress);

      // Only process Realms (1) and Villages (5)
      const realmEntities = allStructures.filter(
        (s) => Number(s.entity_id) > 0 && (s.category === 1 || s.category === 5),
      );
      if (realmEntities.length === 0) return;

      // Build coordinate → biome lookup from map snapshot
      const gridIndex = mapCtx.snapshot?.gridIndex;

      // Phase 2: Fetch state in parallel
      const snapshotRows = await Promise.all(
        realmEntities.map(async (s) => {
          const entityId = Number(s.entity_id);
          const biome = gridIndex?.get(`${s.coord_x},${s.coord_y}`)?.biome ?? 11;
          const level = s.level || 1;
          try {
            const rows = await sql.fetchResourceBalancesAndProduction([entityId]);
            return { entityId, biome, level, row: rows?.[0] ?? null };
          } catch {
            return { entityId, biome, level, row: null };
          }
        }),
      );

      // Fetch building positions for all realms
      const entityIds = realmEntities.map((s) => Number(s.entity_id));
      let buildingRows: { outer_entity_id: number; inner_col: number; inner_row: number; category: number }[] = [];
      try {
        if (typeof sql.fetchBuildingsByStructures === "function") {
          buildingRows = await sql.fetchBuildingsByStructures(entityIds);
        }
      } catch {
        // Continue without building data
      }

      // Group buildings by realm
      // Filter out center hex (10,10) and castle/center building (category 25)
      // — these are the realm structure itself, not player-built buildings.
      const buildingsByRealm = new Map<number, Set<string>>();
      const buildingCountsByRealm = new Map<number, Map<number, number>>();
      for (const b of buildingRows) {
        // Skip the center hex — it's the realm structure, not a building slot
        if (b.inner_col === 10 && b.inner_row === 10) continue;
        // Skip castle/center building type and empty/destroyed slots (None = 0)
        if (b.category === 0 || b.category === 25) continue;

        const key = b.outer_entity_id;
        if (!buildingsByRealm.has(key)) buildingsByRealm.set(key, new Set());
        buildingsByRealm.get(key)!.add(`${b.inner_col},${b.inner_row}`);

        if (!buildingCountsByRealm.has(key)) buildingCountsByRealm.set(key, new Map());
        const counts = buildingCountsByRealm.get(key)!;
        counts.set(b.category, (counts.get(b.category) ?? 0) + 1);
      }

      // Phase 3 & 4: Plan and execute in parallel
      const realmStatuses: RealmStatus[] = [];

      const results = await Promise.allSettled(
        snapshotRows.map(async ({ entityId, biome, level, row }) => {
          const snapshot = parseRealmSnapshot(row);
          const realmName = `Realm ${entityId}`;

          // Merge building counts: the SQL building query has ALL buildings
          // (including non-resource ones like WorkersHut), while snapshot only
          // has resource-producing buildings. Use the SQL data as the source of truth.
          const buildingCounts = buildingCountsByRealm.get(entityId) ?? snapshot.buildingCounts;

          const realmState: RealmState = {
            biome,
            level,
            buildingCounts,
          };

          // Plan: building — collect ALL builds that fit this tick
          const buildOrder = buildOrderForBiome(biome);
          const plan = resolvePlan(buildOrder, realmState, gameConfig.buildingCosts);

          // DEBUG: log what automation sees
          const countsObj: Record<string, number> = {};
          for (const [k, v] of buildingCounts) countsObj[`type_${k}`] = v;
          console.log(`[AUTO] Realm ${entityId} | biome=${biome} level=${level} | buildings:`, countsObj);
          console.log(
            `[AUTO] Realm ${entityId} | plan: ${plan.builds.length} builds, upgrade=${!!plan.upgrade}, idle=${plan.idle}`,
          );
          if (plan.builds.length > 0) {
            console.log(
              `[AUTO] Realm ${entityId} | planned:`,
              plan.builds.map((b) => b.step.label),
            );
          }

          // Don't upgrade in the same tick as builds — the provider batches
          // everything into one multicall, and a failed upgrade kills all builds.
          // Only upgrade when all slots are full (plan.upgrade set by runner)
          // AND we can afford the on-chain costs.
          let upgradeIntent: UpgradeAction | null = null;
          if (plan.upgrade && plan.builds.length === 0) {
            const targetLevel = plan.upgrade.fromLevel + 1;
            const upgradeCosts = gameConfig.realmUpgradeCosts[targetLevel];
            if (upgradeCosts && upgradeCosts.length > 0 && canAfford(snapshot.balances, upgradeCosts)) {
              upgradeIntent = plan.upgrade;
            } else {
              console.log(`[AUTO] Realm ${entityId} | skipping upgrade to level ${targetLevel} — can't afford costs`);
            }
          }

          // Find open slots for all planned builds
          const occupied = buildingsByRealm.get(entityId) ?? new Set();
          console.log(`[AUTO] Realm ${entityId} | occupied positions: ${occupied.size}`, [...occupied]);
          const { slots } = findOpenSlots(occupied, level, plan.builds.length);
          console.log(`[AUTO] Realm ${entityId} | open slots found: ${slots.length}`);

          // Reserve costs for each build; try complex first, fall back to simple.
          // Track a running copy of existing counts for scaled cost calculation.
          const productionBalances = new Map(snapshot.balances);
          const runningCounts = new Map(buildingCounts);
          const buildActions: BuildAction[] = [];

          let slotIdx = 0;
          for (let bi = 0; bi < plan.builds.length && slotIdx < slots.length; bi++) {
            const build = plan.builds[bi];
            const { step } = build;

            // If this is an injected WorkersHut, peek ahead to check if we can
            // afford the build it was injected for. If not, skip both.
            if (build.injectedForPopulation && bi + 1 < plan.builds.length) {
              const nextBuild = plan.builds[bi + 1];
              const nextQty = runningCounts.get(nextBuild.step.building) ?? 0;
              const nextComplex = scaledBuildingCost(nextBuild.step.building, nextQty, gameConfig, false);
              const nextSimple = scaledBuildingCost(nextBuild.step.building, nextQty, gameConfig, true);

              // Check if the paired build is affordable (without reserving yet)
              const canAffordNext =
                (nextComplex.length > 0 && canAfford(productionBalances, nextComplex)) ||
                (nextSimple.length > 0 && canAfford(productionBalances, nextSimple));

              if (!canAffordNext && slotIdx + 1 >= slots.length) {
                // Can't afford the paired build or no slot for it — skip the WH
                break;
              }
              if (!canAffordNext) {
                // Skip both the injected WH and the paired build
                bi++; // skip next
                continue;
              }
            }

            const slot = slots[slotIdx];
            const existingQuantity = runningCounts.get(step.building) ?? 0;

            let useSimple = false;
            const complexCosts = scaledBuildingCost(step.building, existingQuantity, gameConfig, false);
            const simpleCosts = scaledBuildingCost(step.building, existingQuantity, gameConfig, true);
            console.log(
              `[AUTO] Realm ${entityId} | cost check ${step.label}(${step.building}): complexCosts=${complexCosts.length}, simpleCosts=${simpleCosts.length}`,
            );
            if (complexCosts.length > 0) {
              const balForLog: Record<string, number> = {};
              for (const c of complexCosts) balForLog[`res_${c.resource}`] = productionBalances.get(c.resource) ?? 0;
              console.log(`[AUTO]   complex costs:`, complexCosts, `balances:`, balForLog);
            }
            if (simpleCosts.length > 0) {
              const balForLog: Record<string, number> = {};
              for (const c of simpleCosts) balForLog[`res_${c.resource}`] = productionBalances.get(c.resource) ?? 0;
              console.log(`[AUTO]   simple costs:`, simpleCosts, `balances:`, balForLog);
            }
            if (complexCosts.length > 0 && reserveBuildingCosts(productionBalances, complexCosts)) {
              useSimple = false;
              console.log(`[AUTO]   → using complex`);
            } else {
              if (simpleCosts.length > 0 && reserveBuildingCosts(productionBalances, simpleCosts)) {
                useSimple = true;
                console.log(`[AUTO]   → using simple`);
              } else {
                console.log(`[AUTO]   → CAN'T AFFORD, breaking`);
                break;
              }
            }

            buildActions.push({ step, slot, useSimple });
            runningCounts.set(step.building, existingQuantity + 1);
            slotIdx++;
          }

          console.log(
            `[AUTO] Realm ${entityId} | final buildActions: ${buildActions.length}`,
            buildActions.map((a) => a.step.label),
          );

          // Plan: production (against remaining balance after building costs reserved)
          const troopPath = troopPathForBiome(biome);
          const isVillage = realmEntities.find((r) => Number(r.entity_id) === entityId)?.category === 5;
          const prodPlan = planProduction(productionBalances, buildingCounts, troopPath, gameConfig, 60, isVillage);

          // Alternate between complex and simple production each tick
          const useComplex = tickCount % 2 === 1; // odd ticks = complex, even = simple
          let productionCalls: ProductionActions | null = null;
          if (prodPlan.calls.length > 0) {
            const resourceToResource = useComplex
              ? prodPlan.calls
                  .filter((c) => c.method === "complex")
                  .map((c) => ({ resource_id: c.resourceId, cycles: c.cycles }))
              : [];
            const laborToResource = useComplex
              ? []
              : prodPlan.calls
                  .filter((c) => c.method === "simple")
                  .map((c) => ({ resource_id: c.resourceId, cycles: c.cycles }));

            if (resourceToResource.length > 0 || laborToResource.length > 0) {
              productionCalls = { resourceToResource, laborToResource };
            }
          }

          // Execute
          const tickResult = await executeRealmTick({
            provider,
            signer,
            realmEntityId: entityId,
            buildActions,
            upgradeIntent,
            productionCalls,
          });

          // Build order progress — use the last build's index or total if idle
          const lastBuildIndex =
            plan.builds.length > 0 ? plan.builds[plan.builds.length - 1].index : buildOrder.steps.length;
          const progress = `${lastBuildIndex}/${buildOrder.steps.length}`;

          return {
            realmEntityId: entityId,
            realmName,
            biome,
            level,
            buildOrderProgress: progress,
            tickResult,
            essencePulse: {
              balance: snapshot.balances.get(38) ?? 0,
              sufficient: true,
            },
            wheatPulse: {
              balance: snapshot.balances.get(35) ?? 0,
              low: (snapshot.balances.get(35) ?? 0) < 200,
            },
          } as RealmStatus;
        }),
      );

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
