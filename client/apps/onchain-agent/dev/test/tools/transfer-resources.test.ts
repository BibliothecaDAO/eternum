import { describe, it, expect, vi } from "vitest";
import { createTransferResourcesTool } from "../../../src/tools/transfer-resources.js";
import type { MapContext } from "../../../src/map/context.js";
import type { MapSnapshot } from "../../../src/map/renderer.js";
import type { TxContext } from "../../../src/tools/tx-context.js";
import type { TileState, EternumClient, StructureInfo } from "@bibliothecadao/client";

// ── Helpers ──────────────────────────────────────────────────────────

const PLAYER = "0xPLAYER";
const RESOURCE_PRECISION = 1_000_000_000;

function makeTile(x: number, y: number, occupierType = 0, occupierId = 0, biome = 11): TileState {
  return {
    position: { x, y },
    biome,
    occupierId,
    occupierType,
    occupierIsStructure: occupierType >= 1 && occupierType <= 14,
    rewardExtracted: false,
  };
}

function makeSnapshot(tiles: TileState[]): MapSnapshot {
  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  const grid = new Map<string, TileState>();

  for (const t of tiles) {
    if (t.position.x < minX) minX = t.position.x;
    if (t.position.x > maxX) maxX = t.position.x;
    if (t.position.y < minY) minY = t.position.y;
    if (t.position.y > maxY) maxY = t.position.y;
    grid.set(`${t.position.x},${t.position.y}`, t);
  }

  const totalRows = maxY - minY + 1;
  const totalCols = maxX - minX + 1;

  const anchor = { minX, minY, maxX, maxY };
  return {
    text: "(test snapshot)",
    headerLines: 0,
    rowCount: totalRows,
    colCount: totalCols,
    tiles,
    gridIndex: grid,
    resolve(mapRow: number, col: number) {
      if (mapRow < 1 || mapRow > totalRows || col < 1 || col > totalCols) return null;
      const y = maxY - (mapRow - 1);
      const x = minX + (col - 1);
      return { x, y };
    },
    tileAt(mapRow: number, col: number) {
      const pos = this.resolve(mapRow, col);
      if (!pos) return null;
      return grid.get(`${pos.x},${pos.y}`) ?? null;
    },
    explorerDetails: new Map(),
    structureDetails: new Map(),
    anchor,
  };
}

function makeStructure(
  x: number,
  y: number,
  resources: StructureInfo["resources"] = [],
  opts: {
    entityId?: number;
    ownerAddress?: string;
    category?: string;
  } = {},
): StructureInfo {
  return {
    entityId: opts.entityId ?? 100,
    category: opts.category ?? "Realm",
    level: 1,
    realmId: 1,
    ownerAddress: opts.ownerAddress ?? PLAYER,
    position: { x, y },
    guards: [],
    resources,
    explorerCount: 0,
    maxExplorerCount: 3,
  };
}

/**
 * Build a client where structureAt returns different values depending on (x, y).
 * Pass a map of "x,y" → StructureInfo|null.
 */
function makeClient(structureMap: Record<string, StructureInfo | null> = {}): EternumClient {
  return {
    view: {
      structureAt: vi.fn().mockImplementation((x: number, y: number) => {
        const key = `${x},${y}`;
        return Promise.resolve(key in structureMap ? structureMap[key] : null);
      }),
      explorerInfo: vi.fn().mockResolvedValue(null),
    },
  } as unknown as EternumClient;
}

function makeTxCtx(): TxContext {
  return {
    provider: {
      send_resources: vi.fn().mockResolvedValue({}),
    },
    signer: {},
  } as unknown as TxContext;
}

/**
 * Two structures on the map: source at (5,5), target at (8,5).
 * Row/col layout: maxY=5, minY=5 → single row (row 1).
 *   col 1 = x=5 (source), col 2 = x=6 (empty), col 3 = x=7 (empty), col 4 = x=8 (target)
 */
function twoStructureSetup() {
  const tiles = [
    makeTile(5, 5, 1, 100), // source structure
    makeTile(6, 5, 0, 0),
    makeTile(7, 5, 0, 0),
    makeTile(8, 5, 2, 200), // target structure
  ];
  const snapshot = makeSnapshot(tiles);
  return { tiles, snapshot };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("transfer_resources — map prerequisites", () => {
  it("fails when map is not loaded", async () => {
    const mapCtx: MapContext = { snapshot: null, protocol: null, filePath: null };
    const tool = createTransferResourcesTool(makeClient(), mapCtx, PLAYER, makeTxCtx());

    await expect(
      tool.execute("id", { from_structure_id: 100, to_structure_id: 200, resource_name: "Wood", amount: 10 }),
    ).rejects.toThrow("Map not loaded");
  });

  it("fails when source structure not found on map", async () => {
    const { snapshot } = twoStructureSetup();
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createTransferResourcesTool(makeClient(), mapCtx, PLAYER, makeTxCtx());

    await expect(
      tool.execute("id", { from_structure_id: 999, to_structure_id: 200, resource_name: "Wood", amount: 10 }),
    ).rejects.toThrow("Source structure 999 not found");
  });

  it("fails when target structure not found on map", async () => {
    const { snapshot } = twoStructureSetup();
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createTransferResourcesTool(makeClient(), mapCtx, PLAYER, makeTxCtx());

    await expect(
      tool.execute("id", { from_structure_id: 100, to_structure_id: 999, resource_name: "Wood", amount: 10 }),
    ).rejects.toThrow("Target structure 999 not found");
  });
});

describe("transfer_resources — structure validation", () => {
  it("rejects when source structure is not found via client", async () => {
    const { snapshot } = twoStructureSetup();
    // structureAt returns null for source position
    const client = makeClient({ "5,5": null, "8,5": makeStructure(8, 5, []) });
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createTransferResourcesTool(client, mapCtx, PLAYER, makeTxCtx());

    await expect(
      tool.execute("id", { from_structure_id: 100, to_structure_id: 200, resource_name: "Wood", amount: 10 }),
    ).rejects.toThrow("Source structure 100 not found");
  });

  it("rejects when target structure is not found via client", async () => {
    const { snapshot } = twoStructureSetup();
    const source = makeStructure(5, 5, [
      { name: "Wood", amount: 500 },
      { name: "Donkey", amount: 50 },
    ]);
    const client = makeClient({ "5,5": source, "8,5": null });
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createTransferResourcesTool(client, mapCtx, PLAYER, makeTxCtx());

    await expect(
      tool.execute("id", { from_structure_id: 100, to_structure_id: 200, resource_name: "Wood", amount: 10 }),
    ).rejects.toThrow("Target structure 200 not found");
  });
});

describe("transfer_resources — ownership validation", () => {
  it("rejects when source structure is not owned by player", async () => {
    const { snapshot } = twoStructureSetup();
    const source = makeStructure(5, 5, [{ name: "Wood", amount: 500 }], { ownerAddress: "0xENEMY" });
    const target = makeStructure(8, 5, [], { entityId: 200 });
    const client = makeClient({ "5,5": source, "8,5": target });
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createTransferResourcesTool(client, mapCtx, PLAYER, makeTxCtx());

    await expect(
      tool.execute("id", { from_structure_id: 100, to_structure_id: 200, resource_name: "Wood", amount: 10 }),
    ).rejects.toThrow("not yours");
  });

  it("rejects when target structure is not owned by player", async () => {
    const { snapshot } = twoStructureSetup();
    const source = makeStructure(5, 5, [
      { name: "Wood", amount: 500 },
      { name: "Donkey", amount: 50 },
    ]);
    const target = makeStructure(8, 5, [], { entityId: 200, ownerAddress: "0xENEMY" });
    const client = makeClient({ "5,5": source, "8,5": target });
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createTransferResourcesTool(client, mapCtx, PLAYER, makeTxCtx());

    await expect(
      tool.execute("id", { from_structure_id: 100, to_structure_id: 200, resource_name: "Wood", amount: 10 }),
    ).rejects.toThrow("not yours");
  });
});

describe("transfer_resources — resource validation", () => {
  it("rejects when resource name is unknown", async () => {
    const { snapshot } = twoStructureSetup();
    const source = makeStructure(5, 5, [
      { name: "Wood", amount: 500 },
      { name: "Donkey", amount: 50 },
    ]);
    const target = makeStructure(8, 5, [], { entityId: 200 });
    const client = makeClient({ "5,5": source, "8,5": target });
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createTransferResourcesTool(client, mapCtx, PLAYER, makeTxCtx());

    await expect(
      tool.execute("id", { from_structure_id: 100, to_structure_id: 200, resource_name: "Unobtanium", amount: 10 }),
    ).rejects.toThrow('Unknown resource "Unobtanium"');
  });

  it("rejects when source has no balance of the requested resource", async () => {
    const { snapshot } = twoStructureSetup();
    // Source has Wood but not Stone
    const source = makeStructure(5, 5, [
      { name: "Wood", amount: 500 },
      { name: "Donkey", amount: 50 },
    ]);
    const target = makeStructure(8, 5, [], { entityId: 200 });
    const client = makeClient({ "5,5": source, "8,5": target });
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createTransferResourcesTool(client, mapCtx, PLAYER, makeTxCtx());

    await expect(
      tool.execute("id", { from_structure_id: 100, to_structure_id: 200, resource_name: "Stone", amount: 10 }),
    ).rejects.toThrow("No Stone at source");
  });

  it("rejects when source balance is zero", async () => {
    const { snapshot } = twoStructureSetup();
    const source = makeStructure(5, 5, [
      { name: "Wood", amount: 0 },
      { name: "Donkey", amount: 50 },
    ]);
    const target = makeStructure(8, 5, [], { entityId: 200 });
    const client = makeClient({ "5,5": source, "8,5": target });
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createTransferResourcesTool(client, mapCtx, PLAYER, makeTxCtx());

    await expect(
      tool.execute("id", { from_structure_id: 100, to_structure_id: 200, resource_name: "Wood", amount: 10 }),
    ).rejects.toThrow("No Wood at source");
  });
});

describe("transfer_resources — donkey cost", () => {
  it("rejects when there are not enough donkeys for standard resources (100 Wood = 100kg, need 2)", async () => {
    const { snapshot } = twoStructureSetup();
    // 100 Wood × 1000g = 100,000g = 100kg → ceil(100,000 / 50,000) = 2 donkeys
    const source = makeStructure(5, 5, [
      { name: "Wood", amount: 100 },
      { name: "Donkey", amount: 1 },
    ]);
    const target = makeStructure(8, 5, [], { entityId: 200 });
    const client = makeClient({ "5,5": source, "8,5": target });
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createTransferResourcesTool(client, mapCtx, PLAYER, makeTxCtx());

    await expect(
      tool.execute("id", { from_structure_id: 100, to_structure_id: 200, resource_name: "Wood", amount: 100 }),
    ).rejects.toThrow("Need 2 donkeys");
  });

  it("rejects when donkey balance is zero for a weighted resource", async () => {
    const { snapshot } = twoStructureSetup();
    const source = makeStructure(5, 5, [{ name: "Wood", amount: 10 }]); // no Donkey entry
    const target = makeStructure(8, 5, [], { entityId: 200 });
    const client = makeClient({ "5,5": source, "8,5": target });
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createTransferResourcesTool(client, mapCtx, PLAYER, makeTxCtx());

    await expect(
      tool.execute("id", { from_structure_id: 100, to_structure_id: 200, resource_name: "Wood", amount: 10 }),
    ).rejects.toThrow("donkeys");
  });

  it("passes when donkeys are exactly enough (50 Wood = 50kg, need 1 donkey)", async () => {
    const { snapshot } = twoStructureSetup();
    // 50 Wood × 1000g = 50,000g = exactly 50kg → ceil(50,000 / 50,000) = 1 donkey
    const source = makeStructure(5, 5, [
      { name: "Wood", amount: 50 },
      { name: "Donkey", amount: 1 },
    ]);
    const target = makeStructure(8, 5, [], { entityId: 200 });
    const client = makeClient({ "5,5": source, "8,5": target });
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const txCtx = makeTxCtx();
    const tool = createTransferResourcesTool(client, mapCtx, PLAYER, txCtx);

    const result = await tool.execute("id", {
      from_structure_id: 100,
      to_structure_id: 200,
      resource_name: "Wood",
      amount: 50,
    });
    expect(result.details.donkeysBurnt).toBe(1);
  });
});

describe("transfer_resources — free resources (zero weight)", () => {
  it("Donkey resource (weight 0) requires 0 donkeys and succeeds without extra donkeys on hand", async () => {
    const { snapshot } = twoStructureSetup();
    // Donkey has resourceId=25, weight=0 → donkeys needed = 0
    // The source only needs to have Donkey as a resource to send; no extra donkeys required for transport.
    const source = makeStructure(5, 5, [{ name: "Donkey", amount: 1000 }]);
    const target = makeStructure(8, 5, [], { entityId: 200 });
    const client = makeClient({ "5,5": source, "8,5": target });
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const txCtx = makeTxCtx();
    const tool = createTransferResourcesTool(client, mapCtx, PLAYER, txCtx);

    const result = await tool.execute("id", {
      from_structure_id: 100,
      to_structure_id: 200,
      resource_name: "Donkey",
      amount: 1000,
    });

    expect(result.details.donkeysBurnt).toBe(0);
    expect((result.content[0] as any).text).toContain("No donkeys needed");
  });
});

describe("transfer_resources — successful send", () => {
  it("calls provider.send_resources with correct entity IDs, resource ID, and raw amount", async () => {
    const { snapshot } = twoStructureSetup();
    const source = makeStructure(
      5,
      5,
      [
        { name: "Wood", amount: 500 },
        { name: "Donkey", amount: 10 },
      ],
      {
        entityId: 100,
      },
    );
    const target = makeStructure(8, 5, [], { entityId: 200 });
    const client = makeClient({ "5,5": source, "8,5": target });
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const txCtx = makeTxCtx();
    const tool = createTransferResourcesTool(client, mapCtx, PLAYER, txCtx);

    await tool.execute("id", {
      from_structure_id: 100,
      to_structure_id: 200,
      resource_name: "Wood",
      amount: 100,
    });

    expect(txCtx.provider.send_resources).toHaveBeenCalledOnce();
    const callArg = (txCtx.provider.send_resources as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.sender_entity_id).toBe(100);
    expect(callArg.recipient_entity_id).toBe(200);
    expect(callArg.resources).toEqual([{ resource: 3, amount: BigInt(100 * RESOURCE_PRECISION) }]);
  });

  it("caps send amount to available balance when requested amount exceeds it", async () => {
    const { snapshot } = twoStructureSetup();
    // Only 80 Wood available, requesting 200
    const source = makeStructure(
      5,
      5,
      [
        { name: "Wood", amount: 80 },
        { name: "Donkey", amount: 10 },
      ],
      {
        entityId: 100,
      },
    );
    const target = makeStructure(8, 5, [], { entityId: 200 });
    const client = makeClient({ "5,5": source, "8,5": target });
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const txCtx = makeTxCtx();
    const tool = createTransferResourcesTool(client, mapCtx, PLAYER, txCtx);

    const result = await tool.execute("id", {
      from_structure_id: 100,
      to_structure_id: 200,
      resource_name: "Wood",
      amount: 200,
    });

    expect(result.details.amount).toBe(80);
    const callArg = (txCtx.provider.send_resources as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.resources[0].amount).toBe(BigInt(80 * RESOURCE_PRECISION));
  });
});

describe("transfer_resources — output", () => {
  it("returns text with amount, donkeys burnt, and travel time estimate", async () => {
    const { snapshot } = twoStructureSetup();
    const source = makeStructure(
      5,
      5,
      [
        { name: "Wood", amount: 500 },
        { name: "Donkey", amount: 10 },
      ],
      {
        entityId: 100,
      },
    );
    const target = makeStructure(8, 5, [], { entityId: 200 });
    const client = makeClient({ "5,5": source, "8,5": target });
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createTransferResourcesTool(client, mapCtx, PLAYER, makeTxCtx());

    const result = await tool.execute("id", {
      from_structure_id: 100,
      to_structure_id: 200,
      resource_name: "Wood",
      amount: 100,
    });

    const text = (result.content[0] as any).text;
    expect(text).toContain("Wood");
    expect(text).toContain("Donkeys burnt");
    expect(text).toContain("Estimated arrival");
    expect(text).toContain("min");
  });

  it("returns correct details object", async () => {
    const { snapshot } = twoStructureSetup();
    const source = makeStructure(
      5,
      5,
      [
        { name: "Stone", amount: 200 },
        { name: "Donkey", amount: 10 },
      ],
      {
        entityId: 100,
      },
    );
    const target = makeStructure(8, 5, [], { entityId: 200 });
    const client = makeClient({ "5,5": source, "8,5": target });
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createTransferResourcesTool(client, mapCtx, PLAYER, makeTxCtx());

    const result = await tool.execute("id", {
      from_structure_id: 100,
      to_structure_id: 200,
      resource_name: "Stone",
      amount: 100,
    });

    expect(result.details).toMatchObject({
      fromEntityId: 100,
      toEntityId: 200,
      resourceId: 1, // Stone = ID 1
      resourceName: "Stone",
      amount: 100,
      donkeysBurnt: expect.any(Number),
      estimatedTravelMin: expect.any(Number),
    });
  });

  it("has correct parameters schema with required fields", () => {
    const mapCtx: MapContext = { snapshot: null, protocol: null, filePath: null };
    const tool = createTransferResourcesTool(makeClient(), mapCtx, PLAYER, makeTxCtx());

    expect(tool.parameters.properties).toHaveProperty("from_structure_id");
    expect(tool.parameters.properties).toHaveProperty("to_structure_id");
    expect(tool.parameters.properties).toHaveProperty("resource_name");
    expect(tool.parameters.properties).toHaveProperty("amount");
  });
});
