// @vitest-environment node
import type { WorldSummary } from "@bibliothecadao/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reactQueryMocks = vi.hoisted(() => ({
  useQueries: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => reactQueryMocks);

import {
  fetchPlayerHasSettledRealm,
  fetchPlayerRegistration,
  getWorldSummaryKey,
  usePlayerWorldRegistrations,
} from "./use-player-world-registrations";

const mockFetch = vi.fn<typeof globalThis.fetch>();

const makeSummary = (overrides: Partial<WorldSummary>): WorldSummary => ({
  name: "alpha",
  chain: "mainnet",
  alive: true,
  lastCheckedAt: 0,
  mode: "blitz",
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

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  reactQueryMocks.useQueries.mockReset();
});

afterEach(() => {
  mockFetch.mockReset();
  vi.restoreAllMocks();
});

describe("fetchPlayerRegistration", () => {
  it("returns true when once_registered is truthy", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([{ once_registered: 1 }]), { status: 200 }));

    const result = await fetchPlayerRegistration("https://torii.example", "0xplayer");
    expect(result).toBe(true);
  });

  it("returns false when query succeeds but no row is found", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    const result = await fetchPlayerRegistration("https://torii.example", "0xplayer");
    expect(result).toBe(false);
  });

  it("returns null when the query fails", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

    const result = await fetchPlayerRegistration("https://torii.example", "0xplayer");
    expect(result).toBeNull();
  });

  it("returns null on fetch error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("boom"));

    const result = await fetchPlayerRegistration("https://torii.example", "0xplayer");
    expect(result).toBeNull();
  });
});

describe("fetchPlayerHasSettledRealm", () => {
  it("returns true when realm_count > 0", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([{ realm_count: 3 }]), { status: 200 }));

    const result = await fetchPlayerHasSettledRealm("https://torii.example", "0xplayer");
    expect(result).toBe(true);
  });

  it("returns false when realm_count is 0", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([{ realm_count: 0 }]), { status: 200 }));

    const result = await fetchPlayerHasSettledRealm("https://torii.example", "0xplayer");
    expect(result).toBe(false);
  });

  it("returns null when the query fails", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

    const result = await fetchPlayerHasSettledRealm("https://torii.example", "0xplayer");
    expect(result).toBeNull();
  });

  it("parses hex-encoded counts from Torii", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([{ realm_count: "0x2" }]), { status: 200 }));

    const result = await fetchPlayerHasSettledRealm("https://torii.example", "0xplayer");
    expect(result).toBe(true);
  });
});

describe("usePlayerWorldRegistrations", () => {
  it("disables all queries when no playerAddress is supplied", () => {
    reactQueryMocks.useQueries.mockReturnValue([]);

    usePlayerWorldRegistrations({
      worlds: [makeSummary({ name: "alpha", mode: "blitz" })],
      playerAddress: null,
    });

    const [call] = reactQueryMocks.useQueries.mock.calls as [[{ queries: Array<{ enabled: boolean }> }]];
    const [queryOpts] = call[0].queries;
    expect(queryOpts.enabled).toBe(false);
  });

  it("enables blitz and eternum worlds but skips unknown-mode worlds", () => {
    reactQueryMocks.useQueries.mockReturnValue([]);

    usePlayerWorldRegistrations({
      worlds: [
        makeSummary({ name: "blitz-world", mode: "blitz" }),
        makeSummary({ name: "eternum-world", mode: "eternum" }),
        makeSummary({ name: "unknown-world", mode: null }),
      ],
      playerAddress: "0xplayer",
    });

    const [call] = reactQueryMocks.useQueries.mock.calls as [[{ queries: Array<{ enabled: boolean }> }]];
    const [blitz, eternum, unknown] = call[0].queries;

    expect(blitz.enabled).toBe(true);
    expect(eternum.enabled).toBe(true);
    expect(unknown.enabled).toBe(false);
  });

  it("disables offline (dead) worlds even when the player is connected", () => {
    reactQueryMocks.useQueries.mockReturnValue([]);

    usePlayerWorldRegistrations({
      worlds: [makeSummary({ name: "dead-world", mode: "blitz", alive: false })],
      playerAddress: "0xplayer",
    });

    const [call] = reactQueryMocks.useQueries.mock.calls as [[{ queries: Array<{ enabled: boolean }> }]];
    const [opts] = call[0].queries;
    expect(opts.enabled).toBe(false);
  });

  it("keys each query on world + player so results cache separately", () => {
    reactQueryMocks.useQueries.mockReturnValue([]);

    usePlayerWorldRegistrations({
      worlds: [makeSummary({ name: "alpha", chain: "mainnet", mode: "blitz" })],
      playerAddress: "0xplayer",
    });

    const [call] = reactQueryMocks.useQueries.mock.calls as [[{ queries: Array<{ queryKey: unknown[] }> }]];
    const [opts] = call[0].queries;
    expect(opts.queryKey).toEqual([
      "playerWorldRegistration",
      getWorldSummaryKey({ name: "alpha", chain: "mainnet" }),
      "0xplayer",
    ]);
  });

  it("uses 'anonymous' in the key when playerAddress is null", () => {
    reactQueryMocks.useQueries.mockReturnValue([]);

    usePlayerWorldRegistrations({
      worlds: [makeSummary({ name: "alpha", chain: "mainnet", mode: "blitz" })],
      playerAddress: null,
    });

    const [call] = reactQueryMocks.useQueries.mock.calls as [[{ queries: Array<{ queryKey: unknown[] }> }]];
    const [opts] = call[0].queries;
    expect(opts.queryKey[2]).toBe("anonymous");
  });

  it("returns a map keyed by chain:name from queries", () => {
    reactQueryMocks.useQueries.mockReturnValue([
      { data: { isPlayerRegistered: true, hasPlayerSettledRealm: null }, isLoading: false },
      { data: { isPlayerRegistered: null, hasPlayerSettledRealm: true }, isLoading: false },
    ]);

    const result = usePlayerWorldRegistrations({
      worlds: [
        makeSummary({ name: "alpha", chain: "mainnet", mode: "blitz" }),
        makeSummary({ name: "beta", chain: "slot", mode: "eternum" }),
      ],
      playerAddress: "0xplayer",
    });

    expect(result.registrationsByWorldKey.get("mainnet:alpha")).toEqual({
      isPlayerRegistered: true,
      hasPlayerSettledRealm: null,
    });
    expect(result.registrationsByWorldKey.get("slot:beta")).toEqual({
      isPlayerRegistered: null,
      hasPlayerSettledRealm: true,
    });
  });

  it("surfaces loading state from child queries", () => {
    reactQueryMocks.useQueries.mockReturnValue([{ data: undefined, isLoading: true, isFetching: true, error: null }]);

    const result = usePlayerWorldRegistrations({
      worlds: [makeSummary({ name: "alpha", mode: "blitz" })],
      playerAddress: "0xplayer",
    });

    expect(result.isAnyLoading).toBe(true);
  });

  it("returns null-fields when a query has no data yet", () => {
    reactQueryMocks.useQueries.mockReturnValue([{ data: undefined, isLoading: false }]);

    const result = usePlayerWorldRegistrations({
      worlds: [makeSummary({ name: "alpha", chain: "mainnet", mode: "blitz" })],
      playerAddress: "0xplayer",
    });

    expect(result.registrationsByWorldKey.get("mainnet:alpha")).toEqual({
      isPlayerRegistered: null,
      hasPlayerSettledRealm: null,
    });
  });
});
