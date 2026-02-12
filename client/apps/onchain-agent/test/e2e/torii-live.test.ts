/**
 * E2E tests against live Torii SQL endpoint.
 * Tests the full tooling pipeline: SQL queries → SqlApi → ViewClient → buildWorldState
 *
 * Torii endpoint: https://api.cartridge.gg/x/test-snow-true-64/torii/sql
 */
import { describe, it, expect, beforeAll } from "vitest";

const TORII_BASE_URL = "https://api.cartridge.gg/x/test-snow-true-64/torii";
const TORII_SQL_URL = `${TORII_BASE_URL}/sql`;

// Known data from the live world
const KNOWN_OWNER = "0x05372427e24ffd54c70e3c04bed5077a670fa1442caa1ad90e4d3ffab39e08ab";

async function querySql<T = any>(query: string): Promise<T[]> {
  const url = `${TORII_SQL_URL}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SQL query failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T[]>;
}

describe("Live Torii SQL — raw queries", () => {
  it("can connect to the Torii SQL endpoint", async () => {
    const result = await querySql("SELECT 1 as ok");
    expect(result).toEqual([{ ok: 1 }]);
  });

  it("WorldConfig table exists and has data", async () => {
    const rows = await querySql("SELECT * FROM [s1_eternum-WorldConfig] LIMIT 1");
    expect(rows.length).toBe(1);
    expect(rows[0]).toHaveProperty("admin_address");
    expect(rows[0]).toHaveProperty("blitz_mode_on");
  });

  it("Structure table has entries", async () => {
    const rows = await querySql<{ cnt: number }>("SELECT COUNT(*) as cnt FROM [s1_eternum-Structure]");
    expect(rows[0].cnt).toBeGreaterThan(0);
  });

  it("ExplorerTroops table has entries", async () => {
    const rows = await querySql<{ cnt: number }>("SELECT COUNT(*) as cnt FROM [s1_eternum-ExplorerTroops]");
    expect(rows[0].cnt).toBeGreaterThan(0);
  });
});

describe("Live Torii SQL — Structure queries match SqlApi format", () => {
  it("fetches structures by owner with expected columns", async () => {
    const rows = await querySql(
      `SELECT \`base.coord_x\` AS coord_x, \`base.coord_y\` AS coord_y, entity_id, owner 
       FROM [s1_eternum-Structure] 
       WHERE owner == '${KNOWN_OWNER}'`
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toHaveProperty("coord_x");
      expect(row).toHaveProperty("coord_y");
      expect(row).toHaveProperty("entity_id");
      expect(row).toHaveProperty("owner");
      expect(typeof row.entity_id).toBe("number");
      expect(row.owner).toBe(KNOWN_OWNER);
    }
  });

  it("fetches player structures with resources_packed", async () => {
    const rows = await querySql(
      `SELECT 
          \`base.coord_x\` as coord_x,
          \`base.coord_y\` as coord_y,
          category,
          resources_packed,
          entity_id,
          \`metadata.realm_id\` as realm_id,
          \`metadata.has_wonder\` as has_wonder,
          \`base.level\` as level
       FROM \`s1_eternum-Structure\`
       WHERE owner = '${KNOWN_OWNER}'
       ORDER BY category, entity_id`
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toHaveProperty("category");
      expect(row).toHaveProperty("entity_id");
      expect(row).toHaveProperty("level");
      expect(typeof row.category).toBe("number");
    }
  });

  it("fetches all structures map data", async () => {
    // This mirrors STRUCTURE_QUERIES.ALL_STRUCTURES_MAP_DATA
    const rows = await querySql(
      `SELECT entity_id, owner, category, \`base.coord_x\` AS coord_x, \`base.coord_y\` AS coord_y
       FROM [s1_eternum-Structure] LIMIT 10`
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(typeof row.entity_id).toBe("number");
      expect(typeof row.coord_x).toBe("number");
      expect(typeof row.coord_y).toBe("number");
    }
  });
});

describe("Live Torii SQL — Army/Explorer queries", () => {
  it("fetches explorer troops with expected schema", async () => {
    const rows = await querySql(
      `SELECT * FROM [s1_eternum-ExplorerTroops] LIMIT 3`
    );
    expect(rows.length).toBeGreaterThan(0);
    const firstRow = rows[0];
    // ExplorerTroops uses explorer_id, NOT entity_id
    expect(firstRow).toHaveProperty("explorer_id");
    expect(firstRow).toHaveProperty("owner");
    expect(firstRow).toHaveProperty("coord.x");
    expect(firstRow).toHaveProperty("coord.y");
    expect(firstRow).toHaveProperty("troops.category");
    expect(firstRow).toHaveProperty("troops.count");
    expect(firstRow).toHaveProperty("troops.tier");
    expect(firstRow).toHaveProperty("troops.stamina.amount");
    expect(firstRow).toHaveProperty("troops.stamina.updated_tick");
  });

  it("explorer troops 'owner' is a structure entity_id (not an address)", async () => {
    // FINDING: ExplorerTroops.owner is a numeric entity_id referencing the
    // spawning structure, NOT a hex address. The ViewClient/SqlApi must join
    // to resolve the actual player address.
    const rows = await querySql<{ owner: number }>(
      `SELECT DISTINCT owner FROM [s1_eternum-ExplorerTroops] LIMIT 5`
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(typeof row.owner).toBe("number");
    }

    // Verify these entity_ids exist in the Structure table
    const entityIds = rows.map(r => r.owner);
    const structures = await querySql<{ entity_id: number }>(
      `SELECT entity_id FROM [s1_eternum-Structure] WHERE entity_id IN (${entityIds.join(",")})`
    );
    expect(structures.length).toBeGreaterThan(0);
  });
});

describe("Live Torii SQL — Leaderboard queries", () => {
  it("fetches registered player points", async () => {
    const rows = await querySql(
      `SELECT address, registered_points FROM [s1_eternum-PlayerRegisteredPoints] LIMIT 5`
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toHaveProperty("address");
      expect(row).toHaveProperty("registered_points");
      expect(typeof row.address).toBe("string");
      expect(row.address).toMatch(/^0x/);
    }
  });
});

describe("Live Torii SQL — Market queries", () => {
  it("swap events table exists (may be empty)", async () => {
    const rows = await querySql<{ cnt: number }>("SELECT COUNT(*) as cnt FROM [s1_eternum-SwapEvent]");
    expect(rows[0]).toHaveProperty("cnt");
    expect(typeof rows[0].cnt).toBe("number");
  });
});

describe("Live Torii SQL — World contract", () => {
  it("can fetch world contract address", async () => {
    const rows = await querySql<{ contract_address: string }>(
      "SELECT contract_address FROM contracts WHERE contract_type = 'WORLD'"
    );
    expect(rows.length).toBe(1);
    expect(rows[0].contract_address).toMatch(/^0x/);
  });
});

describe("Live Torii SQL — Tile data", () => {
  it("TileOpt table has explored tiles", async () => {
    const rows = await querySql<{ cnt: number }>("SELECT COUNT(*) as cnt FROM [s1_eternum-TileOpt]");
    expect(rows[0].cnt).toBeGreaterThan(0);
  });
});

describe("Live Torii SQL — ViewClient data pipeline", () => {
  it("structure data can be transformed into MapStructure shape", async () => {
    const rows = await querySql(
      `SELECT entity_id, owner, category,
              \`base.coord_x\` AS coord_x, \`base.coord_y\` AS coord_y,
              \`base.level\` AS level
       FROM [s1_eternum-Structure]
       WHERE owner != '0x0000000000000000000000000000000000000000000000000000000000000000'
       LIMIT 5`
    );
    expect(rows.length).toBeGreaterThan(0);
    
    // Transform like ViewClient.mapArea does
    const structures = rows.map((s: any) => ({
      entityId: Number(s.entity_id ?? 0),
      structureType: String(s.category ?? "unknown"),
      position: { x: Number(s.coord_x ?? 0), y: Number(s.coord_y ?? 0) },
      owner: String(s.owner ?? "0x0"),
      name: String(s.name ?? ""),
      level: Number(s.level ?? 1),
    }));

    for (const s of structures) {
      expect(s.entityId).toBeGreaterThan(0);
      expect(s.owner).toMatch(/^0x/);
      expect(typeof s.position.x).toBe("number");
      expect(typeof s.position.y).toBe("number");
      // NOTE: level can be 0 in live data. ViewClient defaults to 1 via `level ?? 1`
      // but that masks real 0 values. This is a potential bug in ViewClient.
      expect(s.level).toBeGreaterThanOrEqual(0);
    }
  });

  it("leaderboard data can be ranked", async () => {
    const rows = await querySql<{ address: string; registered_points: string }>(
      `SELECT address, registered_points FROM [s1_eternum-PlayerRegisteredPoints] ORDER BY registered_points DESC LIMIT 10`
    );
    expect(rows.length).toBeGreaterThan(0);

    // Transform like leaderboard helpers
    const entries = rows.map((r, i) => ({
      address: r.address,
      points: typeof r.registered_points === "string" && r.registered_points.startsWith("0x")
        ? Number(BigInt(r.registered_points))
        : Number(r.registered_points),
      rank: i + 1,
    }));

    expect(entries[0].points).toBeGreaterThan(0);
    // Verify ordering
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i - 1].points).toBeGreaterThanOrEqual(entries[i].points);
    }
  });

  it("world address matches contracts table", async () => {
    const rows = await querySql<{ contract_address: string }>(
      "SELECT contract_address FROM contracts WHERE contract_type = 'WORLD'"
    );
    const worldAddress = rows[0].contract_address;
    
    // Verify it's a valid Starknet address (66 chars with 0x prefix)
    expect(worldAddress).toMatch(/^0x[0-9a-fA-F]+$/);
    expect(worldAddress.length).toBeLessThanOrEqual(66);
  });
});
