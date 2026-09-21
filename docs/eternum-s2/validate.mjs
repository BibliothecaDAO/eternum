import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const manifest = readJson("manifest.json");
const config = readJson("config/initial-playtest.json");

validateScope();
validateFiles();
validateMarkdown();
validateCounts();
validateSelectedConfig();
validateCentralBank();
await import("./maps/validate.mjs");

console.log(
  `Eternum S2 package valid: ${config.counts.parameters} parameters, ` +
    `${config.counts.recipe_components} recipe components, ${config.counts.transitions} transitions.`,
);

function validateScope() {
  assert.equal(manifest.applies_to, "eternum_only");
  assert.equal(config.applies_to, "eternum_only");
  assert(config.excluded_game_modes.includes("blitz"));
  assert(manifest.excluded_game_modes.includes("blitz"));
}

function validateFiles() {
  const referencedFiles = [
    "README.md",
    "design-scope.md",
    "implementation-guide.md",
    "config/README.md",
    "config/initial-playtest.json",
    "manifest.json",
  ];

  for (const relativePath of referencedFiles) {
    const contents = fs.readFileSync(path.join(packageRoot, relativePath), "utf8");
    assert(!/https?:\/\//i.test(contents), `${relativePath} contains an external URL`);
  }

  const configText = fs.readFileSync(path.join(packageRoot, "config/initial-playtest.json"), "utf8");
  assert(!/\b(?:candidate|checkpoint|workbook|overlay|e\d{2})\b/i.test(configText), "config contains design history");
}

function validateMarkdown() {
  const markdownFiles = ["README.md", "design-scope.md", "implementation-guide.md", "config/README.md"];

  for (const relativePath of markdownFiles) {
    const contents = fs.readFileSync(path.join(packageRoot, relativePath), "utf8");
    let expectedColumns = null;
    for (const row of contents.split("\n")) {
      if (!row.startsWith("|")) {
        expectedColumns = null;
        continue;
      }
      const columns = row.split("|").length;
      if (expectedColumns === null) expectedColumns = columns;
      assert.equal(columns, expectedColumns, `${relativePath} contains an inconsistent table row: ${row}`);
    }

    for (const match of contents.matchAll(/\[[^\]]+\]\((\.\/[^)#]+)(?:#[^)]+)?\)/g)) {
      const target = path.resolve(path.dirname(path.join(packageRoot, relativePath)), match[1]);
      assert(fs.existsSync(target), `${relativePath} links to missing file ${match[1]}`);
    }
  }

  const chapters = [
    ...fs.readFileSync(path.join(packageRoot, "design-scope.md"), "utf8").matchAll(/^## (\d+)\./gm),
  ].map((match) => Number(match[1]));
  assert.deepEqual(
    chapters,
    Array.from({ length: 25 }, (_, index) => index + 1),
    "design chapters are out of order",
  );
}

function validateCounts() {
  const actual = {
    parameters: Object.keys(config.parameters).length,
    acceptance_targets: Object.keys(config.acceptance_targets).length,
    assets: config.assets.length,
    recipe_components: config.recipes.length,
    transitions: config.transitions.length,
  };

  assert.deepEqual(config.counts, actual, "config counts do not match contents");
  assert.deepEqual(manifest.configuration_counts, actual, "manifest counts do not match config");
}

function validateSelectedConfig() {
  assert.equal(
    config.parameters["bridge.ancient_fragments.native_extraction_backing_policy"].value,
    "fully_prefunded_before_season",
  );
  assert.equal(
    config.parameters["bridge.ancient_fragments.outbound_redemption"].value,
    "allowed_after_applicable_hyperstructure_efficiency",
  );

  const fragments = config.assets.find((asset) => asset.asset_key === "ANCIENT_FRAGMENTS");
  assert(fragments, "Ancient Fragments asset is missing");
  assert.equal(fragments.bridge_out, "allowed");

  assert(!Object.keys(config.parameters).some((key) => key.startsWith("agent.")));
  assert(!config.assets.some((asset) => asset.asset_key === "AGENT"));
  assert(!config.recipes.some((recipe) => recipe.recipe_id.startsWith("agent_")));
  assert(!config.transitions.some((transition) => transition.subsystem === "agent"));
  assert(!Object.keys(config.acceptance_targets).some((key) => key.includes("agent")));
  assert(!config.parameters["world.discovery.priority"].value.includes("AGENT"));

  assert.equal(config.parameters["world_node.bitcoin.onchain_activation_enabled"].value, "true");
  assert.equal(config.parameters["world_node.bitcoin_mine.order_execution"].value, "contract_native");
  assert.equal(config.parameters["village.creation_fee_other_payment_assets"].value, "not_allowed");
  assert.equal(config.parameters["tribe.formation_fee_other_payment_assets"].value, "not_allowed");
  assert.equal(config.parameters["hs.construction_total"].value, "150000000");
  assert.equal(config.parameters["storage.central.material_capacity_kg_all_holdings"].value, "180000");
  assert.equal(config.parameters["score.unaffiliated_attribution"].value, "personal_counter_only_no_tribe_score");

  const removedWorkingKeys = [
    "hsf.resource_total_per_hsf",
    "prize.synthetic_base_lords",
    "season.length_days",
    "storage.keep_material_kg",
    "unaffiliated_score_parking",
  ];
  for (const key of removedWorkingKeys) assert(!(key in config.parameters), `${key} must not return`);

  for (const recipe of config.recipes) {
    assert(recipe.recipe_id, "recipe component is missing recipe_id");
    assert(recipe.asset, `${recipe.recipe_id} is missing asset`);
    assert(recipe.direction, `${recipe.recipe_id} is missing direction`);
    assert(recipe.amount_formula, `${recipe.recipe_id} is missing amount_formula`);
  }

  for (const transition of config.transitions) {
    assert(transition.transition_id, "transition is missing transition_id");
    assert(transition.failure_rule, `${transition.transition_id} is missing failure_rule`);
    assert(transition.events, `${transition.transition_id} is missing events`);
  }
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(packageRoot, relativePath), "utf8"));
}

function validateCentralBank() {
  const value = (key) => config.parameters[key]?.value;
  const required = {
    "bank.count": "1",
    "world.bank_count": "1",
    "world.bank_ring": "0",
    "world.bank.1.coord_x": "0",
    "world.bank.1.coord_y": "0",
    "world.bank.1.layer": "0",
    "bank.route": "central_bank",
    "bank.orderbook_route": "central_bank",
    "bank.central_enforced_onchain": "true",
    "bank.closest_enforced_onchain": "false",
    "bank.amm_controller_fee_bps": "250",
    "bank.amm_protocol_fee_bps": "250",
    "bank.amm_liquidity_scope": "global_per_ordinary_resource",
    "world.map.coordinate_system": "signed_axial_hex",
    "world.map.realm_spacing_primary_hexes": "15",
    "world.map.first_realm_ring": "3",
    "world.map.spire_inner_realm_ring": "2",
    "world.map.spire_outermost_realm_ring": "30",
    "world.map.spire_origin_enabled": "false",
    "world.map.structure_preexplored_halo_radius": "1",
    "world.map.initial_reveal_discovery_rolls": "false",
    "world.mountains.primary_first_ring": "32",
    "world.mountains.primary_last_ring": "35",
    "world.mountains.traversable": "false",
    "world.mountains.spawn_allowed": "false",
    "world.mountains.preexplored": "true",
    "world.mountains.required_hex_count": "804",
    "world.hsf.discovery.excluded_through_primary_ring": "35",
    "world.hsf.discovery.distance_origin": "map_origin_without_rebasing",
    "world.hsf.creation_inner_exclusion_all_paths": "true",
    "world.hsf.discovery.center_win_weight": "4000",
    "world.hsf.discovery.center_fail_weight": "96000",
    "world.hsf.discovery.distance_multiplier_bps": "9820",
    "world.hsf.discovery.per_found_multiplier_bps": "9100",
    "world.hsf_count": "48",
    "world.discovery.inner_ordinary_terrain_allowed": "CAMP|ESSENCE_RIFT|FRAGMENT_MINE",
    "map.ethereal.origin_preexplored": "true",
    "world_node.bitcoin.discovery_origin_allowed": "false",
    "world_node.bitcoin.discovery_core_outer_ring": "24",
    "map.ethereal.core_radius": "24",
    "map.ethereal.spire_count": "96",
    "map.ethereal.preexplored_core_hexes": "403",
    "map.ethereal.eligible_unexplored_core_hexes": "1398",
    "map.ethereal.preexplored_total_hexes": "667",
  };
  for (const [key, expected] of Object.entries(required)) assert.equal(value(key), expected, key);
  assert(
    !Object.keys(config.parameters).some((key) => /^world\.bank\.[2-6]\./.test(key)),
    "regional Bank coordinates remain",
  );
  assert(!config.transitions.some((t) => /nearest_bank/.test(t.transition_id + t.preconditions + t.failure_rule)));
  assert(config.transitions.some((t) => t.transition_id === "swap_central_bank"));
  assert(config.transitions.some((t) => t.transition_id === "initialize_central_bank_map"));
  const explain = fs.readFileSync(path.join(packageRoot, "banking-explainer.md"), "utf8");
  for (const match of explain.matchAll(/\]\((\.\/[^)#]+)(?:#[^)]+)?\)/g)) {
    assert(fs.existsSync(path.resolve(packageRoot, match[1])), `Missing explainer link: ${match[1]}`);
  }
}
