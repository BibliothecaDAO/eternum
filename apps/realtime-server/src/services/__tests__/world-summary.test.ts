import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchWorldSummary } from "../world-summary";

const mockFetch = vi.fn<typeof globalThis.fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  process.env.TORII_SQL_URL = "http://torii.test/sql";
});

afterEach(() => {
  mockFetch.mockReset();
  vi.restoreAllMocks();
});

describe("fetchWorldSummary", () => {
  it("parses a blitz-mode world correctly", async () => {
    const blitzRow = {
      blitz_mode_on: 1,
      start_settling_at: "0x65b0fde0",
      start_main_at: "0x65b1ffe0",
      end_at: "0x65b2ffe0",
      dev_mode_on: 0,
      mmr_enabled: 1,
      registration_count: 5,
      registration_count_max: 10,
      entry_token_address: "0x1234",
      fee_token: "0xabcd",
      fee_amount: "0xff",
      registration_start_at: "0x65b0fde0",
      registration_end_at: "0x65b1ffe0",
      single_realm_mode: 0,
      two_player_mode: 1,
      settled_players_count: null,
      settled_realms_count: null,
      settled_villages_count: null,
    };

    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([blitzRow]), { status: 200 }));

    const summary = await fetchWorldSummary("alpha-blitz", 5000);

    expect(summary.mode).toBe("blitz");
    expect(summary.startSettlingAt).toBe(0x65b0fde0);
    expect(summary.startMainAt).toBe(0x65b1ffe0);
    expect(summary.endAt).toBe(0x65b2ffe0);
    expect(summary.mmrEnabled).toBe(true);
    expect(summary.devModeOn).toBe(false);
    expect(summary.registrationCount).toBe(5);
    expect(summary.registrationCountMax).toBe(10);
    expect(summary.entryTokenAddress).toBe("0x1234");
    expect(summary.feeTokenAddress).toBe("0xabcd");
    expect(summary.feeAmount).toBe("255");
    expect(summary.registrationStartAt).toBe(0x65b0fde0);
    expect(summary.registrationEndAt).toBe(0x65b1ffe0);
    expect(summary.singleRealmMode).toBe(false);
    expect(summary.twoPlayerMode).toBe(true);
  });

  it("parses an eternum-mode world correctly", async () => {
    const eternumRow = {
      blitz_mode_on: 0,
      start_settling_at: "0x65b0fde0",
      start_main_at: "0x65b1ffe0",
      end_at: "0x65b2ffe0",
      dev_mode_on: 0,
      mmr_enabled: 0,
      settled_players_count: 42,
      settled_realms_count: 100,
      settled_villages_count: 25,
      hyperstructure_created_count: null,
    };

    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([eternumRow]), { status: 200 }));

    const summary = await fetchWorldSummary("beta-eternum", 5000);

    expect(summary.mode).toBe("eternum");
    expect(summary.seasonPassAddress).toBeNull();
    expect(summary.villagePassAddress).toBeNull();
    expect(summary.settledPlayersCount).toBe(42);
    expect(summary.settledRealmsCount).toBe(100);
    expect(summary.settledVillagesCount).toBe(25);
    expect(summary.registrationCount).toBeNull();
    expect(summary.entryTokenAddress).toBeNull();
    expect(summary.feeAmount).toBeNull();
    expect(summary.registrationStartAt).toBeNull();
    expect(summary.registrationEndAt).toBeNull();
  });

  it("returns null fields when the world config query fails", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

    const summary = await fetchWorldSummary("broken-world", 5000);

    expect(summary.mode).toBeNull();
    expect(summary.startMainAt).toBeNull();
    expect(summary.endAt).toBeNull();
    expect(summary.settledRealmsCount).toBeNull();
  });

  it("returns null fields when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));

    const summary = await fetchWorldSummary("unreachable-world", 5000);

    expect(summary.mode).toBeNull();
    expect(summary.startMainAt).toBeNull();
  });

  it("returns null fields when the row is empty", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    const summary = await fetchWorldSummary("empty-world", 5000);

    expect(summary.mode).toBeNull();
    expect(summary.startMainAt).toBeNull();
  });

  it("null-tolerates missing columns on a returned row", async () => {
    const sparseRow = {
      blitz_mode_on: 1,
      start_main_at: "0x65b1ffe0",
    };

    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([sparseRow]), { status: 200 }));

    const summary = await fetchWorldSummary("sparse-world", 5000);

    expect(summary.mode).toBe("blitz");
    expect(summary.startMainAt).toBe(0x65b1ffe0);
    expect(summary.endAt).toBeNull();
    expect(summary.registrationCount).toBeNull();
    expect(summary.feeTokenAddress).toBeNull();
  });

  it("sends a timeout signal on the fetch call", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    await fetchWorldSummary("timeout-world", 5000);

    const [, opts] = mockFetch.mock.calls[0]!;
    expect((opts as RequestInit).signal).toBeDefined();
  });

  it("queries the configured Torii SQL endpoint by GameRegistry name", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    await fetchWorldSummary("my-world", 5000);

    const [url] = mockFetch.mock.calls[0]!;
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : (url as Request).url;
    expect(urlStr).toMatch(/^http:\/\/torii\.test\/sql\?query=/);
    expect(decodeURIComponent(urlStr)).toContain('FROM "s2-GameRegistry"');
  });
});
