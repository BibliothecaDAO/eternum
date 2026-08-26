import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { WorldSummary } from "@bibliothecadao/types";

vi.mock("../../../services/torii-availability", () => {
  const mockService = {
    getAvailability: vi.fn().mockReturnValue({}),
    getSummaries: vi.fn().mockReturnValue([]),
    isSummaryReady: vi.fn().mockReturnValue(false),
    probeWorld: vi.fn(),
    pollOnce: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  return {
    ToriiAvailabilityService: vi.fn().mockImplementation(() => mockService),
    availabilityService: mockService,
  };
});

import worldsRoutes from "../worlds";
import { availabilityService } from "../../../services/torii-availability";

const stubSummary = (overrides: Partial<WorldSummary>): WorldSummary => ({
  name: "stub",
  chain: "madara",
  alive: true,
  lastCheckedAt: 0,
  mode: null,
  startSettlingAt: null,
  startMainAt: null,
  endAt: null,
  devModeOn: null,
  mmrEnabled: null,
  singleRealmMode: null,
  twoPlayerMode: null,
  seasonPassAddress: null,
  villagePassAddress: null,
  worldAddress: null,
  prizeDistributionAddress: null,
  entryTokenAddress: null,
  feeTokenAddress: null,
  feeAmount: null,
  registrationCount: null,
  registrationCountMax: null,
  registrationStartAt: null,
  registrationEndAt: null,
  settledPlayersCount: null,
  settledRealmsCount: null,
  settledVillagesCount: null,
  winnerJackpotAmount: null,
  ...overrides,
});

describe("worlds routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/api/worlds", worldsRoutes);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /summary returns the full summary array", async () => {
    const summaries: WorldSummary[] = [
      stubSummary({ name: "alpha", chain: "madara", alive: true, mode: "blitz" }),
      stubSummary({ name: "beta", chain: "appchain", alive: false, mode: null }),
    ];
    (availabilityService.getSummaries as ReturnType<typeof vi.fn>).mockReturnValue(summaries);

    const res = await app.request("/api/worlds/summary");

    expect(res.status).toBe(200);
    const body = (await res.json()) as WorldSummary[];
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ name: "alpha", chain: "madara", alive: true, mode: "blitz" });
    expect(body[1]).toMatchObject({ name: "beta", chain: "appchain", alive: false });
  });

  it("GET /summary returns an empty array with no-store when nothing is cached", async () => {
    (availabilityService.getSummaries as ReturnType<typeof vi.fn>).mockReturnValue([]);
    (availabilityService.isSummaryReady as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const res = await app.request("/api/worlds/summary");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("GET /summary sets Cache-Control for edge caching after the first poll completes", async () => {
    (availabilityService.getSummaries as ReturnType<typeof vi.fn>).mockReturnValue([
      stubSummary({ name: "alpha", mode: "blitz" }),
    ]);
    (availabilityService.isSummaryReady as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const res = await app.request("/api/worlds/summary");

    expect(res.headers.get("cache-control")).toContain("max-age");
  });
});
