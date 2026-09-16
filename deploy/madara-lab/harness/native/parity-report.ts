import { createHash } from "node:crypto";

export const requiredParityCases = {
  village: "world_parity_village",
  season_ledger_pass: "world_parity_season_ledger_pass",
  season_ledger_order: "world_parity_season_ledger_order",
  season_ledger_empty: "world_parity_season_ledger_empty",
  season_wrong_mode: "world_parity_season_wrong_mode",
  season_triple: "world_parity_season_triple",
  season_duel: "world_parity_season_duel",
  season_pre_main: "world_parity_season_pre_main",
  season_explorer_occupied: "world_parity_season_explorer_occupied",
  season_search_limit: "world_parity_season_search_limit",
  season_settlement: "world_parity_season_settlement",
  season_settlement_dev: "world_parity_season_settlement_dev",
  season_settlement_ledger: "world_parity_season_settlement_ledger",
  season_settlement_rejections: "world_parity_season_settlement_rejections",
  season_settlement_occupied: "world_parity_season_settlement_occupied",

  blitz_settlement: "world_parity_blitz_settlement",
  blitz_entry_rejections: "world_parity_blitz_entry_rejections",
  blitz_entry_ledger: "world_parity_blitz_entry_ledger",
  blitz_cosmetics: "world_parity_blitz_cosmetics",
  blitz_cosmetics_disabled: "world_parity_blitz_cosmetics_disabled",
  blitz_settlement_displacement: "world_parity_blitz_settlement_displacement",
  blitz_settlement_blocked: "world_parity_blitz_settlement_blocked",
  blitz_settlement_agent_blocked: "world_parity_blitz_settlement_agent_blocked",
  blitz_settlement_occupied: "world_parity_blitz_settlement_occupied",
  blitz_settlement_modes: "world_parity_blitz_settlement_modes",
  blitz_settlement_duel: "world_parity_blitz_settlement_duel",
  blitz_reservations: "world_parity_blitz_reservations",

  structure: "world_parity_structure",
  structure_rejections: "world_parity_structure_rejections",
  name: "world_parity_name",
  ownership: "world_parity_ownership",
  ownership_rejections: "world_parity_ownership_rejections",
  ownership_faith: "world_parity_ownership_faith",
  creation: "world_parity_explorer_creation",
  travel: "world_parity_travel_and_known_exploration",
  surface: "world_parity_surface_discoveries",
  ethereal: "world_parity_ethereal_entry_and_discovery",
  production: "world_parity_production_settlement",
  production_cap: "world_parity_production_cap",
  production_capacity: "world_parity_production_capacity",
  battle: "world_parity_battle_deletes_explorer",
  ethereal_battle: "world_parity_ethereal_battle",
  rejections: "world_parity_rejected_actions_preserve_rows",
} as const;

type Observation = {
  case: string;
  step: number;
  model: string;
  keyLength: number;
  length: number;
  native: string[];
  dojo: string[];
};

export function parseWorldParity(output: string) {
  const observations = new Map<string, Observation>();
  const actions = parseActionOutcomes(output);
  const roots: { case: string; step: number; rawRoot: string; incrementedRoot: string }[] = [];
  const deletes: { case: string; step: number; model: string; keys: string[] }[] = [];
  const rejections: { case: string; step: number; explorerId: string; timestamp: string }[] = [];
  const passed = new Map<string, string>();
  for (const line of output.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === "FACT_SNAPSHOT") registerObservation(observations, parts);
    else if (parts[0] === "FACT_VALUE") registerValue(observations, parts);
    else if (parts[0] === "PARITY_ROOT") {
      if (parts.length !== 5 || BigInt(parts[4]) !== BigInt(parts[3]) + 1432n)
        throw new Error("Invalid randomness consumption frame");
      roots.push({
        case: name(parts[1]),
        step: Number(parts[2]),
        rawRoot: hex(parts[3]),
        incrementedRoot: hex(parts[4]),
      });
    } else if (parts[0] === "FACT_DELETE") {
      if (parts.length !== 6) throw new Error("Malformed delete frame");
      deletes.push({
        case: name(parts[1]),
        step: Number(parts[2]),
        model: name(parts[3]),
        keys: parts.slice(4).map(hex),
      });
    } else if (parts[0] === "PARITY_REJECTION") {
      if (parts.length !== 5) throw new Error("Malformed rejection frame");
      rejections.push({ case: name(parts[1]), step: Number(parts[2]), explorerId: hex(parts[3]), timestamp: parts[4] });
    }
    const test = line.match(/^\[PASS\] eternum::native_parity::(\w+) .*l2_gas: ~(\d+)/);
    if (test) {
      if (passed.has(test[1])) throw new Error(`Repeated parity result: ${test[1]}`);
      passed.set(test[1], test[2]);
    }
  }
  for (const observation of observations.values()) {
    if (!(observation.case in requiredParityCases)) throw new Error(`Unexpected parity case: ${observation.case}`);
  }
  const cases = Object.entries(requiredParityCases).map(([caseName, test]) => {
    const caseFacts = [...observations.values()]
      .filter((observation) => observation.case === caseName)
      .map(verifyObservation);
    if (!passed.has(test) || caseFacts.length === 0) throw new Error(`Missing passing parity case: ${test}`);
    return {
      name: caseName,
      test,
      fixtureL2Gas: passed.get(test)!,
      actions: actions.filter((item) => item.case === caseName),
      roots: roots.filter((item) => item.case === caseName),
      facts: caseFacts,
      deletes: deletes.filter((item) => item.case === caseName),
      rejections: rejections.filter((item) => item.case === caseName),
    };
  });
  if (/^\[FAIL\]/m.test(output)) throw new Error("A parity test failed");
  return cases;
}

function registerObservation(observations: Map<string, Observation>, parts: string[]): void {
  if (parts.length !== 7) throw new Error("Malformed fact frame");
  const id = parts.slice(1, 5).join(":");
  const keyLength = Number(parts[5]);
  const length = Number(parts[6]);
  if (!Number.isSafeInteger(length) || length <= keyLength || keyLength <= 0)
    throw new Error(`Invalid fact count: ${id}`);
  const existing = observations.get(id);
  if (existing) {
    if (existing.length !== length || existing.keyLength !== keyLength)
      throw new Error(`Conflicting fact frame: ${id}`);
    return;
  }
  observations.set(id, {
    case: name(parts[1]),
    step: Number(parts[2]),
    model: name(parts[3]),
    keyLength,
    length,
    native: [],
    dojo: [],
  });
}

function registerValue(observations: Map<string, Observation>, parts: string[]): void {
  if (parts.length !== 8) throw new Error("Malformed value frame");
  const id = parts.slice(1, 5).join(":");
  const observation = observations.get(id);
  const index = Number(parts[5]);
  if (!observation || !Number.isSafeInteger(index) || index < 0 || index >= observation.length)
    throw new Error(`Unexpected fact value: ${id}:${index}`);
  const native = hex(parts[6]);
  const dojo = hex(parts[7]);
  if (
    observation.native[index] !== undefined &&
    (observation.native[index] !== native || observation.dojo[index] !== dojo)
  )
    throw new Error(`Conflicting fact value: ${id}:${index}`);
  observation.native[index] = native;
  observation.dojo[index] = dojo;
}

function verifyObservation(observation: Observation) {
  for (let index = 0; index < observation.length; index++) {
    if (observation.native[index] === undefined || observation.dojo[index] === undefined)
      throw new Error(`Incomplete facts: ${observation.case}:${observation.step}:${observation.model}`);
    if (observation.native[index] !== observation.dojo[index])
      throw new Error(`Gameplay divergence: ${observation.case}:${observation.step}:${observation.model}:${index}`);
  }
  return {
    step: observation.step,
    model: observation.model,
    keys: observation.native.slice(0, observation.keyLength),
    value: observation.native.slice(observation.keyLength),
    equal: true,
    sha256: createHash("sha256").update(JSON.stringify(observation.native)).digest("hex"),
  };
}

function hex(value: string): string {
  return `0x${BigInt(value).toString(16)}`;
}
function name(value: string): string {
  return Buffer.from(BigInt(value).toString(16), "hex").toString("ascii");
}

export function parseActionOutcomes(output: string) {
  return output
    .split("\n")
    .filter((line) => line.trim().startsWith("FACT_ACTION "))
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length !== 6 || !["true", "false"].includes(parts[5])) throw new Error("Malformed action outcome");
      const order = Number(parts[2]);
      if (!Number.isSafeInteger(order) || order < 1) throw new Error("Malformed action order");
      return {
        case: name(parts[1]),
        order,
        action: name(parts[3]),
        timestamp: parts[4],
        succeeded: parts[5] === "true",
      };
    });
}
