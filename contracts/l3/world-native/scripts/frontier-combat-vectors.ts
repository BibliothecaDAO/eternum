import { readFileSync, writeFileSync } from "node:fs";
import { buildNativePreset } from "../../../../config/deployer/clean/config/native-preset";
import { loadNativePresetConfiguration } from "../../../../config/deployer/clean/registrar/native-preset";
import { FRONTIER_PRESET_ID } from "../../../../config/source/common/native-preset-modes";

const fixture = new URL("../tests/fixtures/frontier-combat-v1.txt", import.meta.url);
const staminaFields = [
  "stamina_gain_per_tick",
  "stamina_initial",
  "stamina_bonus_value",
  "stamina_knight_max",
  "stamina_paladin_max",
  "stamina_crossbowman_max",
  "stamina_attack_req",
  "stamina_defense_req",
  "stamina_explore_stamina_cost",
  "stamina_travel_stamina_cost",
  "stamina_explore_wheat_cost",
  "stamina_explore_fish_cost",
  "stamina_travel_wheat_cost",
  "stamina_travel_fish_cost",
  "damage_stamina_refund",
  "capture_stamina_refund",
] as const;

function buildInputs(): string {
  const { rules } = buildNativePreset(
    loadNativePresetConfiguration("madara.frontier", FRONTIER_PRESET_ID),
    FRONTIER_PRESET_ID,
  );
  const header = [
    1,
    200,
    ...Object.values(rules.troop_damage_config),
    ...staminaFields.map((field) => Number(rules.troop_stamina_config[field])),
    rules.tick_config.armies_tick_in_seconds,
  ];
  const lines = [header.join("\n")];
  let seed = 20260925;
  const draw = (limit: number) => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) % limit;
  };
  const tick = 100;
  const timestamp = tick * rules.tick_config.armies_tick_in_seconds;
  for (let pair = 0; pair < 100; pair++) {
    const attacker = [0, pair % 3, BigInt(1 + draw(30_000)) * 1_000_000_000n, 150, tick, (pair % 5) * 10];
    const defender = [0, Math.floor(pair / 3) % 3, BigInt(1 + draw(30_000)) * 1_000_000_000n, draw(151), tick, 0];
    for (const alt of [0, 1]) {
      lines.push(
        [
          pair * 2 + alt,
          alt,
          alt ? 17 : 11,
          1,
          timestamp,
          tick,
          0,
          pair % 2,
          ...attacker,
          ...defender,
          0,
          0,
          0,
          0,
        ].join("\n"),
      );
    }
  }
  return lines.join("\n") + "\n";
}

function recordOutcomes(logPath: string): void {
  const fields = readFileSync(fixture, "utf8").trim().split(/\s+/);
  const headerLength = 2 + 6 + staminaFields.length + 1;
  const records = [...readFileSync(logPath, "utf8").matchAll(/FRONTIER_EXCHANGE (\d+) (\d+) (\d+) (\d+) (\d+)/g)];
  if (records.length !== 200 || fields.length !== headerLength + 200 * 24) {
    throw new Error("Expected exactly 200 contract outcomes");
  }
  for (const [index, record] of records.entries()) {
    if (Number(record[1]) !== index) throw new Error("Contract outcomes are not in case order");
    const start = headerLength + index * 24;
    if (Number(fields[start]) !== index) throw new Error("Unexpected combat input layout");
    fields.splice(start + 20, 4, ...record.slice(2));
  }
  writeFileSync(fixture, fields.join("\n") + "\n");
}

const [operation, logPath] = process.argv.slice(2);
if (operation === "inputs") writeFileSync(fixture, buildInputs());
else if (operation === "record" && logPath) recordOutcomes(logPath);
else throw new Error("Use: bun scripts/frontier-combat-vectors.ts inputs | record <snforge-recording.log>");
