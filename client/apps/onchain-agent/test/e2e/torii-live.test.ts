/**
 * E2E tests against the live Torii SQL endpoint.
 * Uses schema/shape-first assertions to reduce drift from live data changes.
 */
import { describe, expect, it } from "vitest";

const TORII_BASE_URL = "https://api.cartridge.gg/x/testy-testy-9/torii";
const TORII_SQL_URL = `${TORII_BASE_URL}/sql`;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000000000000000000000000000";

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

describe("Live Torii SQL — connectivity", () => {
  it("connects to the testy-testy-9 SQL endpoint", async () => {
    const result = await querySql<{ ok: number }>("SELECT 1 as ok");
    expect(result).toEqual([{ ok: 1 }]);
  });

  it("has non-empty core entities", async () => {
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
    const rows = await querySql("SELECT * FROM [s1_eternum-WorldConfig] LIMIT 1");
    expect(rows.length).toBe(1);
    expectKeys(rows[0], ["admin_address", "blitz_mode_on"]);
    expect(typeof rows[0].admin_address).toBe("string");
  });

  it("Structure rows match projected SqlApi shape", async () => {
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
    const rows = await querySql<{ cnt: number }>("SELECT COUNT(*) as cnt FROM [s1_eternum-SwapEvent]");
    expect(rows[0]).toHaveProperty("cnt");
    expect(typeof rows[0].cnt).toBe("number");
    expect(rows[0].cnt).toBeGreaterThanOrEqual(0);
  });

  it("WORLD contract address is present and formatted", async () => {
    const rows = await querySql<{ contract_address: string }>(
      "SELECT contract_address FROM contracts WHERE contract_type = 'WORLD'",
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].contract_address).toMatch(/^0x[0-9a-fA-F]+$/);
  });

  it("TileOpt table contains explored tiles", async () => {
    const rows = await querySql<{ cnt: number }>("SELECT COUNT(*) as cnt FROM [s1_eternum-TileOpt]");
    expect(rows[0].cnt).toBeGreaterThan(0);
  });
});

describe("Live Torii SQL — shape-first pipeline transformations", () => {
  it("can transform structure rows to MapStructure-like objects", async () => {
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
