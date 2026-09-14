import { createHash } from "node:crypto";

export const requiredParityCases = {
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

type Row = {
  case: string;
  step: number;
  model: string;
  keyLength: number;
  length: number;
  native: string[];
  dojo: string[];
};

export function parseWorldParity(output: string) {
  const rows = new Map<string, Row>();
  const events: { case: string; step: number; model: string; payloadHash: string }[] = [];
  const roots: { case: string; step: number; rawRoot: string; incrementedRoot: string }[] = [];
  const deletes: { case: string; step: number; model: string; keys: string[] }[] = [];
  const rejections: { case: string; step: number; explorerId: string; timestamp: string }[] = [];
  const passed = new Map<string, string>();
  for (const line of output.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === "PARITY_ROW") registerRow(rows, parts);
    else if (parts[0] === "PARITY_VALUE") registerValue(rows, parts);
    else if (parts[0] === "PARITY_EVENT") {
      if (parts.length !== 5) throw new Error("Malformed event frame");
      events.push({ case: name(parts[1]), step: Number(parts[2]), model: name(parts[3]), payloadHash: hex(parts[4]) });
    } else if (parts[0] === "PARITY_ROOT") {
      if (parts.length !== 5 || BigInt(parts[4]) !== BigInt(parts[3]) + 1432n)
        throw new Error("Invalid randomness consumption frame");
      roots.push({
        case: name(parts[1]),
        step: Number(parts[2]),
        rawRoot: hex(parts[3]),
        incrementedRoot: hex(parts[4]),
      });
    } else if (parts[0] === "PARITY_DELETE") {
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
    if (test) passed.set(test[1], test[2]);
  }
  for (const row of rows.values()) {
    if (!(row.case in requiredParityCases)) throw new Error(`Unexpected parity case: ${row.case}`);
  }
  const cases = Object.entries(requiredParityCases).map(([caseName, test]) => {
    const caseRows = [...rows.values()].filter((row) => row.case === caseName).map(verifyRow);
    if (!passed.has(test) || caseRows.length === 0) throw new Error(`Missing passing parity case: ${test}`);
    return {
      name: caseName,
      test,
      fixtureL2Gas: passed.get(test)!,
      events: events.filter((item) => item.case === caseName),
      roots: roots.filter((item) => item.case === caseName),
      rows: caseRows,
      deletes: deletes.filter((item) => item.case === caseName),
      rejections: rejections.filter((item) => item.case === caseName),
    };
  });
  if (/^\[FAIL\]/m.test(output)) throw new Error("A parity test failed");
  return cases;
}

function registerRow(rows: Map<string, Row>, parts: string[]): void {
  if (parts.length !== 7) throw new Error("Malformed row frame");
  const id = parts.slice(1, 5).join(":");
  const keyLength = Number(parts[5]);
  const length = Number(parts[6]);
  if (!Number.isSafeInteger(length) || length <= keyLength || keyLength <= 0)
    throw new Error(`Invalid row length: ${id}`);
  const existing = rows.get(id);
  if (existing) {
    if (existing.length !== length || existing.keyLength !== keyLength) throw new Error(`Conflicting row frame: ${id}`);
    return;
  }
  rows.set(id, {
    case: name(parts[1]),
    step: Number(parts[2]),
    model: name(parts[3]),
    keyLength,
    length,
    native: [],
    dojo: [],
  });
}

function registerValue(rows: Map<string, Row>, parts: string[]): void {
  if (parts.length !== 8) throw new Error("Malformed value frame");
  const id = parts.slice(1, 5).join(":");
  const row = rows.get(id);
  const index = Number(parts[5]);
  if (!row || !Number.isSafeInteger(index) || index < 0 || index >= row.length)
    throw new Error(`Unexpected row member: ${id}:${index}`);
  const native = hex(parts[6]);
  const dojo = hex(parts[7]);
  if (row.native[index] !== undefined && (row.native[index] !== native || row.dojo[index] !== dojo))
    throw new Error(`Conflicting row member: ${id}:${index}`);
  row.native[index] = native;
  row.dojo[index] = dojo;
}

function verifyRow(row: Row) {
  for (let index = 0; index < row.length; index++) {
    if (row.native[index] === undefined || row.dojo[index] === undefined)
      throw new Error(`Incomplete row: ${row.case}:${row.step}:${row.model}`);
    if (row.native[index] !== row.dojo[index])
      throw new Error(`Gameplay divergence: ${row.case}:${row.step}:${row.model}:${index}`);
  }
  return {
    step: row.step,
    model: row.model,
    keys: row.native.slice(0, row.keyLength),
    value: row.native.slice(row.keyLength),
    equal: true,
    sha256: createHash("sha256").update(JSON.stringify(row.native)).digest("hex"),
  };
}

function hex(value: string): string {
  return `0x${BigInt(value).toString(16)}`;
}
function name(value: string): string {
  return Buffer.from(BigInt(value).toString(16), "hex").toString("ascii");
}
