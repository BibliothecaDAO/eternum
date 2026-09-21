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
