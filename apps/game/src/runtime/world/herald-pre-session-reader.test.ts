// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorldDeployment } from "./world-directory";
import { createHeraldPreSessionReader } from "./herald-pre-session-reader";

const world = {
  id: "blitz",
  chain: "madara",
  heraldBaseUrl: "https://herald.example",
} as WorldDeployment;

const mockFetch = vi.fn<typeof globalThis.fetch>();

const model = (name: string, values: Array<Record<string, unknown>>) => ({
  model: name,
  rows: values.map((value, index) => ({ key: `0x${index + 1}`, value })),
});

const structure = (overrides: Record<string, unknown>) => ({
  game_id: "0x7",
  entity_id: "0x2a",
  owner: "0x123",
  base: { category: "0x1", coord_x: "0xa", coord_y: "0xb", level: "0x2" },
  metadata: { has_wonder: false, realm_id: "0x9", villages_count: "0x1" },
  resources_packed: "0x456",
  ...overrides,
});

const respondWith = (...models: ReturnType<typeof model>[]) =>
  new Response(JSON.stringify({ confirmed_block: 12, game_id: "7", models }), { status: 200 });

afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

describe("Herald pre-session reader", () => {
  it("maps the live fold's nested Structure shape for owned structures", async () => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValueOnce(
      respondWith(
        model("Structure", [
          structure({}),
          structure({
            entity_id: "0x2b",
            owner: "0x999",
            base: { category: "0x5", coord_x: "0xc", coord_y: "0xd", level: "0x0" },
          }),
        ]),
      ),
    );

    const rows = await createHeraldPreSessionReader(world, 7).fetchPlayerStructures("0x123");

    expect(rows).toEqual([
      {
        category: 1,
        coord_x: 10,
        coord_y: 11,
        entity_id: 42,
        has_wonder: false,
        level: 2,
        realm_id: 9,
        resources_packed: "0x456",
      },
    ]);
  });

  it("joins realm owners and village slots from one selective snapshot", async () => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValueOnce(
      respondWith(
        model("AddressName", [{ address: "0x123", name: "0x41796c61" }]),
        model("Structure", [
          structure({}),
          structure({ entity_id: "0x2b", base: { category: "0x5", coord_x: "0xc", coord_y: "0xd", level: "0x0" } }),
        ]),
        model("StructureVillageSlots", [
          {
            game_id: "0x7",
            connected_realm_entity_id: "0x2a",
            connected_realm_id: "0x9",
            connected_realm_coord: { x: "0xa", y: "0xb" },
            directions_left: ["East", { NorthWest: [] }],
          },
        ]),
      ),
    );

    const snapshot = await createHeraldPreSessionReader(world, 7).fetchSettlementPlannerSnapshot();

    expect(snapshot.realms).toEqual([
      expect.objectContaining({
        directionsLeft: [{ East: [] }, { NorthWest: [] }],
        entityId: 42,
        ownerName: "Ayla",
        realmId: 9,
      }),
    ]);
    expect(snapshot.villages).toEqual([{ coordX: 12, coordY: 13, entityId: 43 }]);
  });
});
