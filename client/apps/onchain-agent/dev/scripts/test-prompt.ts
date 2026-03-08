/**
 * Test script that simulates a single tick of the agent.
 *
 * Connects to a live Torii, fetches the map, builds the full prompt
 * (system prompt + tick prompt), runs a dry-run automation plan for
 * each owned realm, and writes everything to a file for inspection.
 *
 * Usage:
 *   NODE_OPTIONS='--experimental-wasm-modules --disable-warning=ExperimentalWarning' npx tsx dev/scripts/test-prompt.ts
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { EternumClient } from "@bibliothecadao/client";
import { renderMap } from "../../src/map/renderer.js";
import type { MapContext } from "../../src/map/context.js";
import { buildSystemPrompt } from "../../src/entry/soul.js";
import { bootstrapDataDir } from "../../src/entry/bootstrap.js";
import { parseRealmSnapshot } from "../../src/automation/snapshot.js";
import { nextIntent } from "../../src/automation/runner.js";
import { buildOrderForBiome, troopPathForBiome } from "../../src/automation/build-order.js";
import { planProduction } from "../../src/automation/production.js";
import { findOpenSlot } from "../../src/automation/placement.js";
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
// Tick prompt builder (same as main.ts)
// ---------------------------------------------------------------------------

function buildTickPrompt(mapCtx: MapContext): string {
  const mapText = mapCtx.snapshot?.text ?? "Map not yet loaded.";
  return [
    "## Tick — New Turn",
    "",
    "Current map:",
    mapText,
    "",
    "Review your priorities and decide what to do this turn.",
    "Use inspect to examine targets, move_army to reposition, attack to engage, or create_army to build forces.",
  ].join("\n");
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

  // Ensure data dir exists with default soul/tasks
  bootstrapDataDir(DATA_DIR);

  // Connect to Torii and fetch map
  console.log("Connecting to Torii...");
  const client = await EternumClient.create({ toriiUrl: TORII_URL });

  console.log("Fetching map...");
  const area = await client.view.mapArea({ x: 0, y: 0, radius: 999_999 });
  console.log(`  Got ${area.tiles.length} tiles`);

  // Fetch owned structures (used for map highlighting + automation dry-run)
  const sql = client.sql as any;
  let structures: { entity_id: number; coord_x: number; coord_y: number }[] = [];
  try {
    if (typeof sql.fetchStructuresByOwner === "function") {
      structures = await sql.fetchStructuresByOwner(PLAYER_ADDRESS);
      console.log(`  Player owns ${structures.length} structures`);
    }
  } catch {
    console.log("  Could not fetch owned structures");
  }

  const ownedEntityIds = new Set(structures.map((s) => Number(s.entity_id)));

  // Build map snapshot
  const snapshot = renderMap(area.tiles, ownedEntityIds.size > 0 ? ownedEntityIds : undefined);
  const mapCtx: MapContext = { snapshot, filePath: null };

  // ---------- Automation dry-run ----------
  console.log("\nRunning automation dry-run...");
  const realmStatuses: RealmStatus[] = [];

  try {
    if (structures.length > 0) {
      const entityIds = structures.map((s) => Number(s.entity_id)).filter((id) => id > 0);

      // Fetch balances + buildings in parallel
      const [balanceRows, buildingRows] = await Promise.all([
        Promise.all(
          entityIds.map(async (entityId) => {
            try {
              const rows = await sql.fetchResourceBalancesAndProduction([entityId]);
              return { entityId, row: rows?.[0] ?? null };
            } catch {
              return { entityId, row: null };
            }
          }),
        ),
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

      // Group buildings by realm
      const buildingsByRealm = new Map<number, Set<string>>();
      for (const b of buildingRows) {
        if (!buildingsByRealm.has(b.outer_entity_id)) buildingsByRealm.set(b.outer_entity_id, new Set());
        buildingsByRealm.get(b.outer_entity_id)!.add(`${b.inner_col},${b.inner_row}`);
      }

      for (const { entityId, row } of balanceRows) {
        const snap = parseRealmSnapshot(row);
        const structure = structures.find((s) => Number(s.entity_id) === entityId);
        const biome = structure
          ? (snapshot.gridIndex.get(`${structure.coord_x},${structure.coord_y}`)?.biome ?? 11)
          : 11;
        const level = 1; // TODO: resolve from structure data

        const realmState: RealmState = { biome, level, buildingCounts: snap.buildingCounts };
        const intent = nextIntent(realmState);
        const buildOrder = buildOrderForBiome(biome);
        const troopPath = troopPathForBiome(biome);
        const prodPlan = planProduction(snap.balances, snap.activeBuildings, troopPath);
        const occupied = buildingsByRealm.get(entityId) ?? new Set();
        const openSlot = findOpenSlot(occupied, level);

        const progress = intent.action === "idle"
          ? `${buildOrder.steps.length}/${buildOrder.steps.length}`
          : `${(intent as any).index ?? 0}/${buildOrder.steps.length}`;

        realmStatuses.push({
          realmEntityId: entityId,
          realmName: `Realm ${entityId}`,
          biome,
          level,
          buildOrderProgress: progress,
          tickResult: {
            realmEntityId: entityId,
            built: intent.action === "build" && openSlot ? intent.step.label : null,
            upgraded: intent.action === "upgrade" ? `${intent.fromName} → ${intent.toName}` : null,
            produced: prodPlan.calls.length > 0,
            idle: intent.action === "idle" && prodPlan.calls.length === 0,
            errors: [],
          },
          essencePulse: { balance: snap.balances.get(38) ?? 0, sufficient: true },
          wheatPulse: {
            balance: snap.balances.get(35) ?? 0,
            low: (snap.balances.get(35) ?? 0) < 200,
            movesRemaining: Math.floor((snap.balances.get(35) ?? 0) / 20),
          },
        });

        console.log(`  Realm ${entityId}: biome=${biome}, intent=${intent.action}, buildings=${snap.buildingCounts.size}, balances=${snap.balances.size}, production_calls=${prodPlan.calls.length}, open_slot=${openSlot ? "yes" : "no"}`);
      }
    }
  } catch (err: any) {
    console.log("  Automation dry-run failed:", err instanceof Error ? err.message : err);
  }

  const automationStatus = realmStatuses.length > 0
    ? formatStatus({ timestamp: new Date(), realms: realmStatuses })
    : "No owned realms found — automation would be idle.";

  // Build the full prompt exactly as the agent would see it
  const systemPrompt = buildSystemPrompt(DATA_DIR);
  const tickPrompt = buildTickPrompt(mapCtx);

  const fullOutput = [
    "=".repeat(80),
    "SYSTEM PROMPT",
    "=".repeat(80),
    "",
    systemPrompt,
    "",
    "=".repeat(80),
    "TICK PROMPT (user message)",
    "=".repeat(80),
    "",
    tickPrompt,
    "",
    "=".repeat(80),
    "AUTOMATION DRY-RUN",
    "=".repeat(80),
    "",
    automationStatus,
    "",
    "=".repeat(80),
    "METADATA",
    "=".repeat(80),
    "",
    `Torii URL: ${TORII_URL}`,
    `World Address: ${WORLD_ADDRESS}`,
    `Player Address: ${PLAYER_ADDRESS}`,
    `Data Dir: ${DATA_DIR}`,
    `Tiles: ${area.tiles.length}`,
    `Owned structures: ${realmStatuses.length}`,
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
