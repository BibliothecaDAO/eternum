import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

import cacheRoutes from "../cache";

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("cache routes", () => {
  let app: Hono;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("1970-01-01T00:00:30.000Z"));
    app = new Hono();
    app.route("/api/cache", cacheRoutes);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("GET /active-transfers returns normalized active transfers and caches by request shape", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse([
        {
          id: "row-1",
          event_id: "event-1",
          tx_hash: "0xabc",
          timestamp: "0x10",
          resource_transfer_from_entity_id: 11,
          resource_transfer_to_entity_id: 22,
          resource_transfer_resources: '[{"resourceId":1,"amount":10}]',
          resource_transfer_travel_time: 30,
          resource_transfer_is_mint: 0,
        },
        {
          id: "row-2",
          event_id: "event-2",
          tx_hash: "0xdef",
          timestamp: "0x5",
          resource_transfer_from_entity_id: 11,
          resource_transfer_to_entity_id: 22,
          resource_transfer_resources: '[{"resourceId":2,"amount":10}]',
          resource_transfer_travel_time: 10,
          resource_transfer_is_mint: 0,
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const url = "/api/cache/active-transfers?toriiSqlBaseUrl=https://torii.example/sql&lookbackSeconds=1800&limit=500";
    const first = await app.request(url);
    const second = await app.request(url);

    expect(first.status).toBe(200);
    expect(first.headers.get("x-cache")).toBe("miss");
    expect(second.headers.get("x-cache")).toBe("hit");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const body = await first.json();
    expect(body).toEqual([
      {
        id: "live:event-1",
        eventId: "event-1",
        txHash: "0xabc",
        sourceEntityId: 11,
        destinationEntityId: 22,
        resourceIds: [1],
        startedAtMs: 16_000,
        endsAtMs: 46_000,
        progress: 14 / 30,
      },
    ]);
  });

  it("GET /active-transfers respects limit=0 without querying Torii", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await app.request("/api/cache/active-transfers?toriiSqlBaseUrl=https://torii.example/sql&limit=0");

    expect(response.status).toBe(200);
    expect(response.headers.get("x-cache")).toBe("hit");
    expect(await response.json()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
