/**
 * View the agent's tick context exactly as it would see it.
 *
 * Usage:
 *   npx tsx dev/scripts/view-briefing.ts
 *   npx tsx dev/scripts/view-briefing.ts --player 0x1234...
 *   npx tsx dev/scripts/view-briefing.ts --torii https://api.cartridge.gg/x/other-world/torii
 */

import { EternumClient } from "@bibliothecadao/client";
import { renderMap } from "../../src/map/renderer.js";
import { createMapProtocol } from "../../src/map/protocol.js";
import { isExplorer } from "../../src/world/occupier.js";

const args = process.argv.slice(2);
function flag(name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const TORII_URL = flag("--torii") ?? "https://api.cartridge.gg/x/test-axis-slotty/torii";
const PLAYER = flag("--player");

async function main() {
  console.error(`Connecting to ${TORII_URL}...`);
  const client = await EternumClient.create({ toriiUrl: TORII_URL });

  console.error("Fetching tiles...");
  const area = await client.view.mapArea({ x: 0, y: 0, radius: 999_999 });
  console.error(`${area.tiles.length} tiles loaded.`);

  // Resolve owned entity IDs if player address given
  let ownedEntityIds = new Set<number>();
  if (PLAYER) {
    console.error(`Resolving entities for player ${PLAYER}...`);
    const sql = client.sql as any;
    if (typeof sql.fetchStructuresByOwner === "function") {
      const structures: { entity_id: number }[] = await sql.fetchStructuresByOwner(PLAYER);
      ownedEntityIds = new Set(structures.map((s) => Number(s.entity_id)));

      if (ownedEntityIds.size > 0 && typeof sql.fetchExplorersByStructures === "function") {
        const explorers: { explorer_id: number }[] = await sql.fetchExplorersByStructures([...ownedEntityIds]);
        for (const e of explorers) ownedEntityIds.add(Number(e.explorer_id));
      }
      console.error(`${ownedEntityIds.size} owned entities found.`);
    }
  }

  // Fetch explorer details for owned armies
  let explorerDetails: Map<number, any> | undefined;
  if (ownedEntityIds.size > 0) {
    const armyTiles = area.tiles.filter(
      (t) => t.occupierId > 0 && ownedEntityIds.has(t.occupierId) && isExplorer(t.occupierType),
    );
    const armyIds = armyTiles.map((t) => t.occupierId);
    if (armyIds.length > 0 && typeof client.view.explorerInfoBatch === "function") {
      explorerDetails = await client.view.explorerInfoBatch(armyIds);
    }
  }

  // Fetch structure details for owned structures
  let structureDetails: Map<number, any> | undefined;
  if (ownedEntityIds.size > 0) {
    const structureTiles = area.tiles.filter(
      (t) => t.occupierId > 0 && ownedEntityIds.has(t.occupierId) && t.occupierIsStructure,
    );
    const structureIds = structureTiles.map((t) => t.occupierId);
    if (structureIds.length > 0 && typeof client.view.structureInfoBatch === "function") {
      structureDetails = await client.view.structureInfoBatch(structureIds);
    }
  }

  // Build snapshot and protocol
  const snapshot = renderMap(area.tiles, ownedEntityIds, explorerDetails, undefined, undefined, structureDetails);
  const protocol = createMapProtocol(snapshot, ownedEntityIds);

  // ── Print what the agent sees ──

  const sep = "═".repeat(60);

  console.log(sep);
  console.log("  TICK BRIEFING (injected each turn)");
  console.log(sep);
  console.log();

  const briefing = protocol.briefing();
  if (briefing.length === 0) {
    console.log("(empty — no owned entities)");
  } else {
    console.log(briefing);
  }

  console.log();
  console.log(sep);
  console.log("  TICK PROMPT (user message each turn)");
  console.log(sep);
  console.log();
  console.log("## Tick — New Turn");
  console.log();
  if (briefing.length > 0) {
    console.log(briefing);
  } else {
    console.log("(briefing would appear here)");
  }
  console.log();
  console.log("Review your priorities and decide what to do this turn.");
  console.log("Use map_query to explore the world: tile_info, nearby, entity_info, find.");
  console.log("Use move_army to reposition, attack to engage, open_chest to claim relics, or create_army to build forces.");

  console.log();
  console.log(sep);
  console.log("  DIAGNOSTICS (pushed automatically)");
  console.log(sep);
  console.log();

  const diags = protocol.diagnostics();
  if (diags.length === 0) {
    console.log("(none)");
  } else {
    for (const d of diags) {
      const icon = d.severity === "threat" ? "⚠" : d.severity === "opportunity" ? "→" : "ℹ";
      console.log(`  ${icon} [${d.severity}] ${d.message}`);
    }
  }

  console.log();
  console.log(sep);
  console.log("  STATS");
  console.log(sep);
  console.log();
  console.log(`  Tiles:           ${area.tiles.length}`);
  console.log(`  Owned entities:  ${ownedEntityIds.size}`);
  console.log(`  Briefing chars:  ${briefing.length}`);
  console.log(`  Diagnostics:     ${diags.length}`);

  // Compare to old ASCII map size
  console.log(`  ASCII map chars: ${snapshot.text.length}`);
  const savings = briefing.length > 0
    ? `${Math.round((1 - briefing.length / snapshot.text.length) * 100)}% smaller`
    : "n/a (no player)";
  console.log(`  Savings:         ${savings}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
