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
validateExplorationAndReserves();
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
  assert(!/\b(?:candidate|checkpoint|workbook|overlay)\b/i.test(configText), "config contains design history");
  assert(!/raid|rebellion|casual|onboarding/i.test(configText), "config contains removed Village or raid rules");
  assert(!/manager/i.test(configText), "config contains the removed separate Village Manager role");
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
  assert.equal(config.parameters["village.max_per_parent_realm"].value, "6");
  assert.equal(config.parameters["village.resource_roll.count"].value, "1");
  assert.equal(config.parameters["village.resource_roll.pool_size"].value, "22");
  assert.equal(
    config.parameters["village.resource_roll.selection"].value,
    "collection_trait_frequency_weighted_random_without_player_choice",
  );
  const expectedVillageResourceWeights = {
    adamantine: 55,
    alchemical_silver: 93,
    coal: 3833,
    cold_iron: 957,
    copper: 2643,
    deep_crystal: 239,
    diamonds: 300,
    dragonhide: 23,
    ethereal_silica: 162,
    gold: 914,
    hartwood: 594,
    ignium: 172,
    ironwood: 1179,
    mithral: 37,
    obsidian: 2216,
    ruby: 239,
    sapphire: 247,
    silver: 1741,
    stone: 3941,
    true_ice: 139,
    twilight_quartz: 111,
    wood: 5015,
  };
  const actualVillageResourceWeights = Object.fromEntries(
    Object.keys(expectedVillageResourceWeights).map((resource) => [
      resource,
      Number(config.parameters[`village.resource_roll.weight.${resource}`].value),
    ]),
  );
  assert.deepEqual(actualVillageResourceWeights, expectedVillageResourceWeights);
  assert.equal(
    Object.values(actualVillageResourceWeights).reduce((total, weight) => total + weight, 0),
    Number(config.parameters["village.resource_roll.total_weight"].value),
  );
  assert.equal(config.parameters["village.owner.initial_assignment"].value, "parent_realm_owner_at_mint");
  assert.equal(
    config.parameters["village.owner.change_policy"].value,
    "current_owner_direct_transfer_or_successful_capture",
  );
  assert.equal(
    config.parameters["village.owner.authority_scope"].value,
    "complete_village_gameplay_bridge_and_ownership_transfer",
  );
  assert.equal(config.parameters["village.parent_link_mutability"].value, "immutable_after_mint");
  assert.equal(
    config.parameters["village.parent_realm_capture_effect"].value,
    "village_owner_and_attachment_unchanged",
  );
  assert.equal(
    config.parameters["bridge.village_out_tax_destination"].value,
    "current_parent_realm_owner_external_wallet",
  );
  assert(!Object.keys(config.parameters).some((key) => key.startsWith("village.manager.")));
  assert.equal(config.parameters["combat.hostile_holding_outcome"].value, "decisive_combat_then_complete_capture");
  assert.equal(config.parameters["combat.inventory_extraction_without_capture"].value, "not_allowed");
  assert(!config.assets.some((asset) => "raid_policy" in asset));
  assert(!config.transitions.some((transition) => transition.subsystem === "raid"));
  assert(!config.transitions.some((transition) => transition.transition_id === "rebel_village"));
  for (const transitionId of ["mint_village", "transfer_village", "capture_village"]) {
    assert(
      config.transitions.some((transition) => transition.transition_id === transitionId),
      `${transitionId} is missing`,
    );
  }
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

function validateExplorationAndReserves() {
  const value = (key) => config.parameters[key]?.value;
  const required = {
    "exploration.initial_reveal_rewards": "false",
    "exploration.material_find_bps.primary": "1000",
    "exploration.material_find_bps.ethereal": "0",
    "exploration.relic.e7.reveal_hexes": "6",
    "exploration.relic.e8.reveal_hexes": "18",
    "exploration.relic.e9.reward_bonus_bps": "10000",
    "exploration.relic.e10.reward_bonus_bps": "20000",
    "exploration.relic.reveal_center": "army_current_hex",
    "exploration.relic.reveal_layer": "current_army_layer",
    "exploration.relic.reveal_auto_pickup": "false",
    "exploration.reward.auto_pickup_default": "true",
    "exploration.reward.auto_pickup_policy": "paid_explore_only_when_entire_reward_fits",
    "exploration.reward.custody": "ground_cache_on_revealed_hex",
    "exploration.reward.active_relic_bonus_timing": "at_reveal_persist_final_ground_cache_amount",
    "exploration.reward.active_relic_bonus_scope": "paid_explore_and_relic_reveal_new_material_finds",
    "exploration.reward.marker_until_collected": "true",
    "exploration.reward.pickup_position": "occupying_hex_only_no_adjacency",
    "exploration.reward.resolution_order": "world_structure_then_material_find_then_conditional_outcome",
    "exploration.reward.resolved_once_per_hex": "true",
    "exploration.reward.strength_reference": "3000",
    "exploration.reward.factor_min_bps": "200",
    "exploration.reward.factor_max_bps": "10000",
    "exploration.reward.amount_formula":
      "max(1,floor(base_amount*clamp(sqrt((bodies*tier_strength)/3000),0.02,1)))*(10000+active_relic_bonus_bps)/10000",
    "military.army_homogeneous_class_and_tier": "true",
    "military.army_cargo_kg_per_troop.t1": "10",
    "military.army_cargo_kg_per_troop.t2": "20",
    "military.army_cargo_kg_per_troop.t3": "30",
    "military.army_overweight_blocked_actions": "move|paid_explore|cross_layer",
    "military.army_overweight_resolution": "owner_explicit_cargo_burn_only",
    "world_node.essence_rift.output_rate_per_second": "1",
    "world_node.essence_rift.local_capacity": "86400",
    "world_node.essence_rift.reserve_depletion": "successful_claim_only",
    "world_node.essence_rift.full_local_cap_reserve_effect": "none",
    "world_node.essence_rift.claimable_formula": "min(local_entitlement,remaining_reserve,material_capacity_headroom)",
    "research.relic_exchange_cost": "25000",
    "research.research_essence.all": "40",
    "research.research_workers.all": "4",
  };
  for (const [key, expected] of Object.entries(required)) assert.equal(value(key), expected, key);

  const outcomes = {
    essence_level_1: ["ESSENCE", "5000", "3000"],
    essence_level_2: ["ESSENCE", "10000", "1500"],
    donkeys_level_1: ["DONKEYS", "200", "2500"],
    donkeys_level_2: ["DONKEYS", "500", "1000"],
    workers_level_1: ["WORKERS", "250", "1500"],
    workers_level_2: ["WORKERS", "750", "500"],
  };
  assert.deepEqual(
    Object.keys(config.parameters)
      .filter((key) => key.endsWith(".weight_bps") && key.startsWith("exploration.reward.outcome."))
      .sort(),
    Object.keys(outcomes)
      .map((id) => `exploration.reward.outcome.${id}.weight_bps`)
      .sort(),
  );
  let totalWeight = 0;
  for (const [id, [asset, amount, weight]] of Object.entries(outcomes)) {
    const prefix = `exploration.reward.outcome.${id}`;
    assert.equal(value(`${prefix}.asset`), asset);
    assert.equal(value(`${prefix}.base_amount`), amount);
    assert.equal(value(`${prefix}.weight_bps`), weight);
    totalWeight += Number(weight);
  }
  assert.equal(totalWeight, 10000);
  const relicResearchDebit = config.recipes.find(
    (recipe) => recipe.recipe_id === "forge_relic" && recipe.asset === "RESEARCH" && recipe.direction === "debit",
  );
  assert.equal(relicResearchDebit?.amount_formula, "research.relic_exchange_cost");
  assert.equal(relicResearchDebit?.parameter_keys, "research.relic_exchange_cost");

  const reserveTiers = ["600000", "1200000", "1800000", "2400000", "3000000"];
  for (const [index, reserve] of reserveTiers.entries()) {
    assert.equal(value(`world_node.essence_rift.reserve_tier.${index + 1}`), reserve);
    assert.equal(value(`world_node.essence_rift.reserve_tier_weight_bps.${index + 1}`), "2000");
  }
  for (const id of [
    "explore_hex",
    "reveal_relic_hexes",
    "collect_ground_cache",
    "burn_army_cargo",
    "extract_essence",
  ]) {
    assert(
      config.transitions.some((transition) => transition.transition_id === id),
      `${id} transition missing`,
    );
  }
  for (const id of [
    "exploration_reward_custody",
    "exploration_relic_reward_bonus",
    "army_cargo_encumbrance",
    "essence_rift_finite_reserve",
  ]) {
    assert(config.acceptance_targets[id], `${id} acceptance target missing`);
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
    "world.mountains.primary_first_ring": "33",
    "world.mountains.primary_last_ring": "35",
    "world.mountains.traversable": "false",
    "world.mountains.spawn_allowed": "false",
    "world.mountains.preexplored": "true",
    "world.mountains.required_hex_count": "612",
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
