/**
 * Protocol endpoint quality test.
 *
 * Hits every endpoint with various inputs, checks for:
 * - Duplication: same data repeated at different nesting levels
 * - Gaps: missing fields that should be populated
 * - Irregularities: inconsistent shapes between entity types
 * - Edge cases: empty tiles, unexplored, missing entities, chests
 *
 * Usage: npx tsx dev/scripts/protocol-test.ts [--url http://localhost:3117]
 */

const BASE = process.argv.includes("--url")
  ? process.argv[process.argv.indexOf("--url") + 1]
  : "http://localhost:3117";

interface Issue {
  severity: "error" | "warning" | "info";
  endpoint: string;
  message: string;
}

const issues: Issue[] = [];
let passed = 0;
let total = 0;

function check(endpoint: string, condition: boolean, message: string, severity: Issue["severity"] = "error") {
  total++;
  if (!condition) {
    issues.push({ severity, endpoint, message });
  } else {
    passed++;
  }
}

async function get(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`);
  return res.json();
}

async function testStatus() {
  const s = await get("/status");
  check("/status", s.tiles > 0, `Expected tiles > 0, got ${s.tiles}`);
  check("/status", !!s.lastRefresh, "Missing lastRefresh");
}

async function testTileInfoStructure() {
  // Find a realm to test
  const structures = await get("/find?type=enemy_structure");
  const realm = structures.find((s: any) => s.kind === "Realm");
  if (!realm) { issues.push({ severity: "error", endpoint: "tile_info/structure", message: "No realm found to test" }); return; }

  const r = await get(`/tile_info?x=${realm.position.x}&y=${realm.position.y}`);

  check("tile_info/structure", r.explored === true, "Expected explored=true");
  check("tile_info/structure", r.biome && r.biome !== "Unknown", `Bad biome: ${r.biome}`);
  check("tile_info/structure", r.biomeId > 0, `Bad biomeId: ${r.biomeId}`);
  check("tile_info/structure", !("occupier" in r), "DUPLICATION: tile_info should not have 'occupier' field (removed in favor of entity)");
  check("tile_info/structure", !!r.entity, "Missing entity details");

  if (r.entity) {
    check("tile_info/structure", !!r.entity.structure, "Missing entity.structure for a structure tile");
    check("tile_info/structure", !r.entity.explorer, "Structure tile should not have entity.explorer");

    // Check position isn't duplicated meaninglessly
    check("tile_info/structure", r.position.x === r.entity.position.x, "Position mismatch between tile and entity");

    if (r.entity.structure) {
      const s = r.entity.structure;
      check("tile_info/structure", typeof s.category === "string" && s.category.length > 0, `Missing category`);
      check("tile_info/structure", typeof s.level === "number", `Missing level`);
      check("tile_info/structure", Array.isArray(s.guards), "Missing guards array");
      check("tile_info/structure", !!s.guardStrength, "Missing guardStrength");
      check("tile_info/structure", Array.isArray(s.resources), "GAP: Missing resources array");
      check("tile_info/structure", typeof s.explorerCount === "number", "Missing explorerCount");
      check("tile_info/structure", typeof s.maxExplorerCount === "number", "Missing maxExplorerCount");
      check("tile_info/structure", typeof s.owner === "string", "Missing owner");
    }
  }
}

async function testTileInfoExplorer() {
  const armies = await get("/find?type=enemy_army");
  if (armies.length === 0) { issues.push({ severity: "warning", endpoint: "tile_info/explorer", message: "No armies found to test" }); return; }

  const army = armies[0];
  const r = await get(`/tile_info?x=${army.position.x}&y=${army.position.y}`);

  check("tile_info/explorer", !!r.entity, "Missing entity for army tile");
  check("tile_info/explorer", !("occupier" in r), "DUPLICATION: should not have occupier field");

  if (r.entity) {
    check("tile_info/explorer", !!r.entity.explorer, "Missing entity.explorer for army tile");
    check("tile_info/explorer", !r.entity.structure, "Army tile should not have entity.structure");

    if (r.entity.explorer) {
      const e = r.entity.explorer;
      check("tile_info/explorer", typeof e.troopType === "string", "Missing troopType");
      check("tile_info/explorer", typeof e.troopTier === "string", "Missing troopTier");
      check("tile_info/explorer", typeof e.troopCount === "number" && e.troopCount > 0, `Bad troopCount: ${e.troopCount}`);
      check("tile_info/explorer", typeof e.stamina === "number", "Missing stamina");
      check("tile_info/explorer", !!e.strength, "Missing strength");
      check("tile_info/explorer", e.strength?.display?.length > 0, "Empty strength display");
    }
  }
}

async function testTileInfoEmpty() {
  // Find an explored empty tile by checking tiles around a known position
  const r = await get("/tile_info?x=1109224450&y=1109224450");
  check("tile_info/empty", r.explored === true, "Expected explored tile");
  check("tile_info/empty", r.entity === null, "Empty tile should have entity=null");
  check("tile_info/empty", !("occupier" in r), "Should not have occupier field");
}

async function testTileInfoUnexplored() {
  const r = await get("/tile_info?x=0&y=0");
  check("tile_info/unexplored", r.explored === false, "Should be unexplored");
  check("tile_info/unexplored", r.entity === null, "Unexplored should have entity=null");
  check("tile_info/unexplored", r.biome === "Unknown", `Expected Unknown biome, got ${r.biome}`);
}

async function testTileInfoChest() {
  const chests = await get("/find?type=chest");
  if (chests.length === 0) { issues.push({ severity: "info", endpoint: "tile_info/chest", message: "No chests to test" }); return; }

  const chest = chests[0];
  const r = await get(`/tile_info?x=${chest.position.x}&y=${chest.position.y}`);

  check("tile_info/chest", !!r.entity, "Chest tile should have entity");
  if (r.entity) {
    // Chests are classified as occupier type 34 which falls into "structure" range check
    // but ViewClient won't return structure details for chests — check what we get
    check("tile_info/chest", r.entity.kind === "chest",
      `Expected kind="chest", got "${r.entity.kind}"`);
    check("tile_info/chest", r.entity.chest != null,
      "Missing chest-specific fields");
    check("tile_info/chest", typeof r.entity.chest?.opened === "boolean",
      "Missing chest.opened field");
  }
}

async function testEntityInfoStructure() {
  const r = await get("/entity_info?entity_id=170");
  check("entity_info/structure", r.entityId === 170, "Wrong entityId");
  check("entity_info/structure", r.kind === "structure", `Expected kind=structure, got ${r.kind}`);
  check("entity_info/structure", !!r.structure, "Missing structure details");
  check("entity_info/structure", !r.explorer, "Structure should not have explorer details");

  if (r.structure) {
    check("entity_info/structure", Array.isArray(r.structure.resources), "GAP: Missing resources");
    check("entity_info/structure", r.structure.resources.length > 0, "GAP: Resources array is empty for a realm", "warning");
  }
}

async function testEntityInfoExplorer() {
  const armies = await get("/find?type=enemy_army");
  if (armies.length === 0) return;

  const r = await get(`/entity_info?entity_id=${armies[0].entityId}`);
  check("entity_info/explorer", r.kind === "explorer", `Expected kind=explorer, got ${r.kind}`);
  check("entity_info/explorer", !!r.explorer, "Missing explorer details");
  check("entity_info/explorer", !r.structure, "Explorer should not have structure details");
}

async function testEntityInfoMissing() {
  const r = await get("/entity_info?entity_id=999999");
  check("entity_info/missing", !!r.error, "Expected error for missing entity");
}

async function testEntityInfoConsistency() {
  // tile_info.entity and entity_info should return the same shape for the same entity
  const structures = await get("/find?type=enemy_structure");
  const realm = structures.find((s: any) => s.kind === "Realm");
  if (!realm) return;

  const tileResult = await get(`/tile_info?x=${realm.position.x}&y=${realm.position.y}`);
  const entityResult = await get(`/entity_info?entity_id=${realm.entityId}`);

  check("consistency", !!tileResult.entity && !!entityResult,
    "Both endpoints should return data for the same entity");

  if (tileResult.entity && entityResult) {
    check("consistency", tileResult.entity.entityId === entityResult.entityId, "entityId mismatch");
    check("consistency", tileResult.entity.kind === entityResult.kind, "kind mismatch");
    check("consistency", tileResult.entity.biome === entityResult.biome, "biome mismatch");
    check("consistency",
      JSON.stringify(tileResult.entity.structure?.guards) === JSON.stringify(entityResult.structure?.guards),
      "guards mismatch between tile_info.entity and entity_info");
    check("consistency",
      tileResult.entity.structure?.resources?.length === entityResult.structure?.resources?.length,
      "resources count mismatch between tile_info.entity and entity_info");
  }
}

async function testNearby() {
  const r = await get("/nearby?x=1109224447&y=1109224452&radius=5");
  check("nearby", !!r.center, "Missing center");
  check("nearby", r.radius === 5, `Expected radius=5, got ${r.radius}`);
  check("nearby", Array.isArray(r.ownedArmies), "Missing ownedArmies");
  check("nearby", Array.isArray(r.enemyStructures), "Missing enemyStructures");

  // Check nearby uses OccupierSummary (lightweight), NOT full EntityInfoResult
  const allEntries = [...r.ownedArmies, ...r.ownedStructures, ...r.enemyArmies, ...r.enemyStructures, ...r.chests, ...r.other];
  for (const entry of allEntries) {
    check("nearby", !!entry.occupier, `Missing occupier in nearby entry at (${entry.position.x},${entry.position.y})`);
    check("nearby", typeof entry.distance === "number", "Missing distance");
    check("nearby", typeof entry.biome === "string", "Missing biome");
    // Should NOT have full entity details — that's for tile_info/entity_info
    check("nearby", !("entity" in entry), "IRREGULARITY: nearby entry should not have full entity details");
    check("nearby", !("structure" in entry.occupier), "IRREGULARITY: nearby occupier should not have structure details");
    check("nearby", !("explorer" in entry.occupier), "IRREGULARITY: nearby occupier should not have explorer details");
    check("nearby", !("resources" in entry.occupier), "IRREGULARITY: nearby occupier should not have resources");
  }

  // Check sorting by distance
  for (const group of [r.enemyArmies, r.enemyStructures, r.chests]) {
    for (let i = 1; i < group.length; i++) {
      check("nearby", group[i].distance >= group[i - 1].distance, "Results not sorted by distance");
    }
  }
}

async function testFind() {
  // Test all find types
  const types = ["hyperstructure", "mine", "village", "chest", "enemy_army", "enemy_structure"];
  for (const type of types) {
    const r = await get(`/find?type=${type}`);
    check(`find/${type}`, Array.isArray(r), `Expected array for find type=${type}`);

    for (const entry of r.slice(0, 3)) {
      check(`find/${type}`, typeof entry.entityId === "number", "Missing entityId");
      check(`find/${type}`, !!entry.position, "Missing position");
      check(`find/${type}`, typeof entry.kind === "string", "Missing kind");
      check(`find/${type}`, typeof entry.label === "string", "Missing label");
      // Should NOT have full details
      check(`find/${type}`, !("structure" in entry), "IRREGULARITY: find result should not have structure details");
      check(`find/${type}`, !("explorer" in entry), "IRREGULARITY: find result should not have explorer details");
      check(`find/${type}`, !("resources" in entry), "IRREGULARITY: find result should not have resources");
    }
  }

  // Test find with reference position — should have distance
  const withRef = await get("/find?type=mine&ref_x=1109224447&ref_y=1109224452");
  for (const entry of withRef) {
    check("find/distance", typeof entry.distance === "number", "Missing distance when ref position given");
  }
  // Check sorted
  for (let i = 1; i < withRef.length; i++) {
    check("find/distance", withRef[i].distance >= withRef[i - 1].distance, "Find results not sorted by distance");
  }
}

async function testFindStrength() {
  // Armies in find should have strength when explorer details are available
  const armies = await get("/find?type=enemy_army");
  const withStrength = armies.filter((a: any) => a.strength);
  const withoutStrength = armies.filter((a: any) => !a.strength);
  check("find/strength", true, `Armies with strength: ${withStrength.length}, without: ${withoutStrength.length}`, "info");
}

// ── Run all tests ──

async function main() {
  console.log(`Testing protocol at ${BASE}\n`);

  await testStatus();
  await testTileInfoStructure();
  await testTileInfoExplorer();
  await testTileInfoEmpty();
  await testTileInfoUnexplored();
  await testTileInfoChest();
  await testEntityInfoStructure();
  await testEntityInfoExplorer();
  await testEntityInfoMissing();
  await testEntityInfoConsistency();
  await testNearby();
  await testFind();
  await testFindStrength();

  // Report
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const infos = issues.filter((i) => i.severity === "info");

  console.log(`${passed}/${total} checks passed\n`);

  if (errors.length > 0) {
    console.log("ERRORS:");
    for (const i of errors) console.log(`  ✘ [${i.endpoint}] ${i.message}`);
    console.log();
  }
  if (warnings.length > 0) {
    console.log("WARNINGS:");
    for (const i of warnings) console.log(`  ⚠ [${i.endpoint}] ${i.message}`);
    console.log();
  }
  if (infos.length > 0) {
    console.log("INFO:");
    for (const i of infos) console.log(`  ℹ [${i.endpoint}] ${i.message}`);
    console.log();
  }

  if (errors.length > 0) {
    process.exit(1);
  }
  console.log("All good.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
