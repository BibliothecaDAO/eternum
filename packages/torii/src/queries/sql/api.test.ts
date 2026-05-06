import { afterEach, describe, expect, it, vi } from "vitest";

import { SqlApi } from "./api";

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("SqlApi.fetchActiveTransfers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the realtime cache endpoint when configured", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse([
        {
          id: "live:event-1",
          eventId: "event-1",
          txHash: "0xabc",
          sourceEntityId: 11,
          destinationEntityId: 22,
          resourceIds: [1],
          startedAtMs: 10_000,
          endsAtMs: 20_000,
          progress: 0.5,
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const sqlApi = new SqlApi("https://torii.example/sql", "https://realtime.example");
    const result = await sqlApi.fetchActiveTransfers(250, 1800);

    expect(result).toEqual([
      {
        id: "live:event-1",
        eventId: "event-1",
        txHash: "0xabc",
        sourceEntityId: 11,
        destinationEntityId: 22,
        resourceIds: [1],
        startedAtMs: 10_000,
        endsAtMs: 20_000,
        progress: 0.5,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://realtime.example/api/cache/active-transfers?limit=250&lookbackSeconds=1800&toriiSqlBaseUrl=https%3A%2F%2Ftorii.example%2Fsql",
      expect.anything(),
    );
  });

  it("falls back to direct SQL and normalizes transfer rows when the cache is unavailable", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("cache down"))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: "row-1",
            event_id: "event-1",
            tx_hash: "0xabc",
            timestamp: "0x64",
            resource_transfer_from_entity_id: 11,
            resource_transfer_to_entity_id: 22,
            resource_transfer_resources: '[{"resourceId":1,"amount":10}]',
            resource_transfer_travel_time: 30,
            resource_transfer_is_mint: 0,
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const sqlApi = new SqlApi("https://torii.example/sql", "https://realtime.example");
    const result = await sqlApi.fetchActiveTransfers(250, 1800, 115_000);

    expect(result).toEqual([
      {
        id: "live:event-1",
        eventId: "event-1",
        txHash: "0xabc",
        sourceEntityId: 11,
        destinationEntityId: 22,
        resourceIds: [1],
        startedAtMs: 100_000,
        endsAtMs: 130_000,
        progress: 0.5,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
