/**
 * Fetch all fixture data from a live Torii endpoint and save as JSON files.
 *
 * Downloads every SQL table the agent depends on (GameConfig sub-tables,
 * stamina config, structure level configs) and writes them to
 * dev/test/automation/fixtures/ so tests can run offline.
 *
 * Usage:
 *   npx tsx dev/scripts/fetch-fixtures.ts
 *   npx tsx dev/scripts/fetch-fixtures.ts --url https://custom-torii/sql
 */

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "..", "test", "automation", "fixtures");

const DEFAULT_URL = "https://api.cartridge.gg/x/fruity-fruity-sandbox/torii/sql";

// ── SQL queries (mirrors packages/torii/src/queries/sql/config.ts) ──

const QUERIES: Record<string, string> = {
  "building-category-config": `
    SELECT category, complex_erection_cost_id, complex_erection_cost_count,
           simple_erection_cost_id, simple_erection_cost_count,
           population_cost, capacity_grant
    FROM \`s1_eternum-BuildingCategoryConfig\`
  `,
  "resource-factory-config": `
    SELECT resource_type, complex_input_list_id, complex_input_list_count,
           simple_input_list_id, simple_input_list_count,
           output_per_complex_input, output_per_simple_input,
           labor_output_per_resource, realm_output_per_second, village_output_per_second
    FROM \`s1_eternum-ResourceFactoryConfig\`
  `,
  "resource-list": `
    SELECT entity_id, resource_type, amount, \`index\`
    FROM \`s1_eternum-ResourceList\`
  `,
  "building-config": `
    SELECT \`building_config.base_cost_percent_increase\` AS base_cost_percent_increase
    FROM \`s1_eternum-WorldConfig\`
    LIMIT 1
  `,
  "structure-level-config": `
    SELECT level, required_resources_id, required_resource_count
    FROM \`s1_eternum-StructureLevelConfig\`
  `,
  "stamina-config": `
    SELECT
      \`troop_stamina_config.stamina_travel_stamina_cost\` AS travel_cost,
      \`troop_stamina_config.stamina_explore_stamina_cost\` AS explore_cost,
      \`troop_stamina_config.stamina_bonus_value\` AS bonus_value,
      \`troop_stamina_config.stamina_gain_per_tick\` AS gain_per_tick,
      \`troop_stamina_config.stamina_knight_max\` AS knight_max,
      \`troop_stamina_config.stamina_paladin_max\` AS paladin_max,
      \`troop_stamina_config.stamina_crossbowman_max\` AS crossbowman_max,
      \`tick_config.armies_tick_in_seconds\` AS armies_tick_in_seconds
    FROM \`s1_eternum-WorldConfig\`
    LIMIT 1
  `,
};

// ── Fetch and save ──

async function fetchQuery(baseUrl: string, sql: string): Promise<unknown[]> {
  const url = `${baseUrl}?q=${encodeURIComponent(sql.trim())}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Query failed (${res.status}): ${sql.trim().slice(0, 80)}...`);
  }
  return res.json();
}

async function main() {
  const args = process.argv.slice(2);
  const urlIndex = args.indexOf("--url");
  const baseUrl = urlIndex !== -1 && args[urlIndex + 1] ? args[urlIndex + 1] : DEFAULT_URL;

  console.log(`Fetching fixtures from: ${baseUrl}\n`);

  const entries = Object.entries(QUERIES);

  const results = await Promise.all(
    entries.map(async ([name, sql]) => {
      const rows = await fetchQuery(baseUrl, sql);
      return { name, rows };
    }),
  );

  for (const { name, rows } of results) {
    const outPath = resolve(FIXTURES_DIR, `${name}.json`);
    writeFileSync(outPath, JSON.stringify(rows, null, 2) + "\n");
    console.log(`  ${name}.json — ${rows.length} rows`);
  }

  console.log(`\nDone. ${results.length} fixtures written to ${FIXTURES_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
