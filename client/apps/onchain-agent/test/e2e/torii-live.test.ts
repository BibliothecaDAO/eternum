/**
 * E2E tests against a live Torii SQL endpoint.
 * Dynamically discovers an active Eternum world via the factory — no hardcoded URLs.
 * Probes every candidate for the exact tables the tests need, picks the best match.
 * Skips individual tests whose required tables are empty on the selected world.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { discoverAllWorlds } from "../../src/world/discovery";

// Every table the tests query, mapped to a simple count probe.
const REQUIRED_TABLES = [
  "[s1_eternum-Structure]",
  "[s1_eternum-ExplorerTroops]",
  "[s1_eternum-WorldConfig]",
  "[s1_eternum-PlayerRegisteredPoints]",
  "[s1_eternum-SwapEvent]",
  "[s1_eternum-TileOpt]",
] as const;

type TableName = (typeof REQUIRED_TABLES)[number];

let TORII_SQL_URL: string;
/** Tables confirmed to have ≥1 row on the selected world. */
let populatedTables: Set<TableName>;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000000000000000000000000000";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function probeSql(baseUrl: string, query: string): Promise<unknown[]> {
  const url = `${baseUrl}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

/** Probe a world for connectivity + which required tables have data. */
async function probeWorld(baseUrl: string): Promise<{ reachable: boolean; populated: Set<TableName> }> {
  const ping = await probeSql(baseUrl, "SELECT 1 as ok");
  if (ping.length === 0) return { reachable: false, populated: new Set() };

  const results = await Promise.all(
    REQUIRED_TABLES.map(async (table) => {
      const rows = await probeSql(baseUrl, `SELECT COUNT(*) as cnt FROM ${table}`);
      const cnt = (rows[0] as any)?.cnt ?? 0;
      return { table, hasData: cnt > 0 };
    }),
  );

  const populated = new Set<TableName>();
  for (const r of results) {
    if (r.hasData) populated.add(r.table);
  }
  return { reachable: true, populated };
}

// ---------------------------------------------------------------------------
// Setup — find the best world for our tests
// ---------------------------------------------------------------------------

beforeAll(async () => {
  const worlds = await discoverAllWorlds();
  const candidates = [
    ...worlds.filter((w) => w.status === "ongoing"),
    ...worlds.filter((w) => w.status !== "ongoing"),
  ];

  let bestUrl = "";
  let bestPopulated = new Set<TableName>();

  for (const world of candidates) {
    const baseUrl = `https://api.cartridge.gg/x/${world.name}/torii/sql`;
    try {
      const { reachable, populated } = await probeWorld(baseUrl);
      if (!reachable) continue;

      console.log(
        `Probed: ${world.name} (${world.chain}, ${world.status}) — ` +
          `${populated.size}/${REQUIRED_TABLES.length} tables populated`,
      );

      if (populated.size > bestPopulated.size) {
        bestUrl = baseUrl;
        bestPopulated = populated;
      }
      if (populated.size === REQUIRED_TABLES.length) break; // Perfect match
    } catch {
      continue;
    }
  }

  if (bestUrl) {
    TORII_SQL_URL = bestUrl;
    populatedTables = bestPopulated;
    const missing = REQUIRED_TABLES.filter((t) => !bestPopulated.has(t));
    console.log(`Selected: ${TORII_SQL_URL}`);
    if (missing.length > 0) {
      console.log(`  Missing data in: ${missing.join(", ")} — those tests will skip`);
    }
  } else {
    populatedTables = new Set();
    console.warn("No reachable Eternum worlds found — skipping live Torii tests");
  }
}, 60_000);

// ---------------------------------------------------------------------------
// Test utilities
// ---------------------------------------------------------------------------

type SqlRow = Record<string, unknown>;

async function querySql<T extends SqlRow = SqlRow>(query: string): Promise<T[]> {
  const url = `${TORII_SQL_URL}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SQL query failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as T[];
  if (!Array.isArray(rows)) throw new Error("SQL response is not an array");
  return rows;
}

function expectKeys(row: SqlRow, keys: string[]): void {
  for (const key of keys) {
    expect(row).toHaveProperty(key);
  }
}

function skipIfNoWorld(): boolean {
  if (!TORII_SQL_URL) {
    console.warn("Skipped: no reachable world");
    return true;
  }
  return false;
}

/** Skip if any of the listed tables are empty. No network call — uses the probe results. */
function skipIfMissing(...tables: TableName[]): boolean {
  if (skipIfNoWorld()) return true;
  const missing = tables.filter((t) => !populatedTables.has(t));
  if (missing.length > 0) {
    console.warn(`Skipped: ${missing.join(", ")} empty on selected world`);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Live Torii SQL — connectivity", () => {
  it("connects to the discovered SQL endpoint", async () => {
    if (skipIfNoWorld()) return;
    const result = await querySql<{ ok: number }>("SELECT 1 as ok");
    expect(result).toEqual([{ ok: 1 }]);
  });

  it("has non-empty core entities", async () => {
    if (skipIfMissing("[s1_eternum-Structure]", "[s1_eternum-ExplorerTroops]")) return;
    const [structures, explorers] = await Promise.all([
      querySql<{ cnt: number }>("SELECT COUNT(*) as cnt FROM [s1_eternum-Structure]"),
      querySql<{ cnt: number }>("SELECT COUNT(*) as cnt FROM [s1_eternum-ExplorerTroops]"),
    ]);

    expect(structures[0].cnt).toBeGreaterThan(0);
    expect(explorers[0].cnt).toBeGreaterThan(0);
  });
});

describe("Live Torii SQL — table shapes", () => {
  it("WorldConfig returns expected core fields", async () => {
    if (skipIfMissing("[s1_eternum-WorldConfig]")) return;
    const rows = await querySql("SELECT * FROM [s1_eternum-WorldConfig] LIMIT 1");
    expect(rows.length).toBe(1);
    expectKeys(rows[0], ["admin_address", "blitz_mode_on"]);
    expect(typeof rows[0].admin_address).toBe("string");
  });

  it("Structure rows match projected SqlApi shape", async () => {
    if (skipIfMissing("[s1_eternum-Structure]")) return;
    const rows = await querySql(
      `SELECT entity_id, owner, category,
              \`base.coord_x\` AS coord_x, \`base.coord_y\` AS coord_y, \`base.level\` AS level
       FROM [s1_eternum-Structure]
       LIMIT 5`,
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expectKeys(row, ["entity_id", "owner", "category", "coord_x", "coord_y", "level"]);
      expect(typeof row.entity_id).toBe("number");
      expect(typeof row.owner).toBe("string");
      expect(typeof row.coord_x).toBe("number");
      expect(typeof row.coord_y).toBe("number");
      expect(typeof row.category).toBe("number");
    }
  });

  it("ExplorerTroops rows expose troop and coord fields", async () => {
    if (skipIfMissing("[s1_eternum-ExplorerTroops]")) return;
    const rows = await querySql("SELECT * FROM [s1_eternum-ExplorerTroops] LIMIT 3");
    expect(rows.length).toBeGreaterThan(0);

    const row = rows[0];
    expectKeys(row, ["explorer_id", "owner", "coord.x", "coord.y", "troops.category", "troops.count", "troops.tier"]);
    expect(typeof row.explorer_id).toBe("number");
    expect(typeof row.owner).toBe("number");
  });
});

describe("Live Torii SQL — relational assumptions", () => {
  it("ExplorerTroops.owner values resolve to Structure.entity_id", async () => {
    if (skipIfMissing("[s1_eternum-ExplorerTroops]", "[s1_eternum-Structure]")) return;
    const owners = await querySql<{ owner: number }>("SELECT DISTINCT owner FROM [s1_eternum-ExplorerTroops] LIMIT 10");
    expect(owners.length).toBeGreaterThan(0);

    const ownerIds = owners.map((r) => r.owner).filter((v) => Number.isFinite(v));
    const structures = await querySql<{ entity_id: number }>(
      `SELECT entity_id FROM [s1_eternum-Structure] WHERE entity_id IN (${ownerIds.join(",")})`,
    );
    expect(structures.length).toBeGreaterThan(0);
  });
});

describe("Live Torii SQL — leaderboard, market, world, tiles", () => {
  it("PlayerRegisteredPoints rows are rankable", async () => {
    if (skipIfMissing("[s1_eternum-PlayerRegisteredPoints]")) return;
    const rows = await querySql<{ address: string; registered_points: string }>(
      "SELECT address, registered_points FROM [s1_eternum-PlayerRegisteredPoints] LIMIT 10",
    );
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      expect(typeof row.address).toBe("string");
      expect(row.address).toMatch(/^0x/);
      expect(typeof row.registered_points).toBe("string");
      expect(row.registered_points).toMatch(/^0x[0-9a-fA-F]+$/);
    }
  });

  it("SwapEvent table is queryable even when empty", async () => {
    if (skipIfNoWorld()) return;
    const rows = await querySql<{ cnt: number }>("SELECT COUNT(*) as cnt FROM [s1_eternum-SwapEvent]");
    expect(rows[0]).toHaveProperty("cnt");
    expect(typeof rows[0].cnt).toBe("number");
    expect(rows[0].cnt).toBeGreaterThanOrEqual(0);
  });

  it("WORLD contract address is present and formatted", async () => {
    if (skipIfNoWorld()) return;
    const rows = await querySql<{ contract_address: string }>(
      "SELECT contract_address FROM contracts WHERE contract_type = 'WORLD'",
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].contract_address).toMatch(/^0x[0-9a-fA-F]+$/);
  });

  it("TileOpt table contains explored tiles", async () => {
    if (skipIfMissing("[s1_eternum-TileOpt]")) return;
    const rows = await querySql<{ cnt: number }>("SELECT COUNT(*) as cnt FROM [s1_eternum-TileOpt]");
    expect(rows[0].cnt).toBeGreaterThan(0);
  });
});

describe("Live Torii SQL — shape-first pipeline transformations", () => {
  it("can transform structure rows to MapStructure-like objects", async () => {
    if (skipIfMissing("[s1_eternum-Structure]")) return;
    const rows = await querySql(
      `SELECT entity_id, owner, category, \`base.coord_x\` AS coord_x, \`base.coord_y\` AS coord_y, \`base.level\` AS level
       FROM [s1_eternum-Structure]
       WHERE owner != '${ZERO_ADDRESS}'
       LIMIT 5`,
    );

    expect(rows.length).toBeGreaterThan(0);
    const transformed = rows.map((s: SqlRow) => ({
      entityId: Number(s.entity_id ?? 0),
      owner: String(s.owner ?? "0x0"),
      structureType: String(s.category ?? ""),
      position: { x: Number(s.coord_x ?? 0), y: Number(s.coord_y ?? 0) },
      level: Number(s.level ?? 0),
    }));

    for (const item of transformed) {
      expect(item.entityId).toBeGreaterThan(0);
      expect(item.owner).toMatch(/^0x/);
      expect(typeof item.position.x).toBe("number");
      expect(typeof item.position.y).toBe("number");
      expect(item.level).toBeGreaterThanOrEqual(0);
    }
  });

  it("can rank leaderboard entries by decoded points", async () => {
    if (skipIfMissing("[s1_eternum-PlayerRegisteredPoints]")) return;
    const rows = await querySql<{ address: string; registered_points: string }>(
      `SELECT address, registered_points
       FROM [s1_eternum-PlayerRegisteredPoints]
       ORDER BY registered_points DESC
       LIMIT 10`,
    );
    expect(rows.length).toBeGreaterThan(0);

    const entries = rows.map((r, i) => ({
      address: r.address,
      points: Number(BigInt(r.registered_points)),
      rank: i + 1,
    }));

    expect(entries[0].points).toBeGreaterThan(0);
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i - 1].points).toBeGreaterThanOrEqual(entries[i].points);
    }
  });
});
