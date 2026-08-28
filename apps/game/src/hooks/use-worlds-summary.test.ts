// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reactQueryMocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
}));

const directoryMocks = vi.hoisted(() => ({
  getWorldDirectory: vi.fn(),
}));

const summaryMocks = vi.hoisted(() => ({
  fetchAppchainWorldsSummary: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => reactQueryMocks);
vi.mock("@/runtime/world/world-directory", () => directoryMocks);
vi.mock("./appchain-worlds-summary", () => summaryMocks);

import { useWorldsSummary, fetchWorldsSummary } from "./use-worlds-summary";

const blitzWorld = { id: "blitz", toriiBaseUrl: "https://torii.example" };
const eternumWorld = { id: "eternum", toriiBaseUrl: "https://torii.example" };

beforeEach(() => {
  reactQueryMocks.useQuery.mockReset();
  directoryMocks.getWorldDirectory.mockReset();
  summaryMocks.fetchAppchainWorldsSummary.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchWorldsSummary", () => {
  it("unions every directory world's games list", async () => {
    directoryMocks.getWorldDirectory.mockReturnValue([blitzWorld, eternumWorld]);
    summaryMocks.fetchAppchainWorldsSummary.mockImplementation(async (world: { id: string }) =>
      world.id === "blitz"
        ? [{ name: "quickblitz", worldId: "blitz", gameId: 7 }]
        : [{ name: "season1", worldId: "eternum", gameId: 1 }],
    );

    const result = await fetchWorldsSummary();

    expect(result).toHaveLength(2);
    expect(result.map((game) => game.name)).toEqual(["quickblitz", "season1"]);
    expect(summaryMocks.fetchAppchainWorldsSummary).toHaveBeenCalledTimes(2);
  });

  it("drops a failing world's contribution instead of failing the whole list", async () => {
    directoryMocks.getWorldDirectory.mockReturnValue([blitzWorld, eternumWorld]);
    summaryMocks.fetchAppchainWorldsSummary.mockImplementation(async (world: { id: string }) => {
      if (world.id === "eternum") throw new Error("herald down");
      return [{ name: "quickblitz", worldId: "blitz", gameId: 7 }];
    });

    const result = await fetchWorldsSummary();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: "quickblitz", worldId: "blitz" });
  });

  it("returns an empty array when every world has no games", async () => {
    directoryMocks.getWorldDirectory.mockReturnValue([blitzWorld]);
    summaryMocks.fetchAppchainWorldsSummary.mockResolvedValue([]);

    expect(await fetchWorldsSummary()).toEqual([]);
  });
});

describe("useWorldsSummary", () => {
  it("registers a single shared query without a polling interval", () => {
    reactQueryMocks.useQuery.mockReturnValue({ data: undefined, isPending: true });

    useWorldsSummary();

    const [opts] = reactQueryMocks.useQuery.mock.calls[0] as [Record<string, unknown>];
    expect(opts.queryKey).toEqual(["worldsSummary"]);
    expect(opts.staleTime).toBe(25_000);
    expect(opts).not.toHaveProperty("refetchInterval");
  });

  it("exposes loading and error state from the underlying query", () => {
    const error = new Error("network down");
    reactQueryMocks.useQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      error,
      isError: true,
    });

    const result = useWorldsSummary();

    expect(result.data).toBeUndefined();
    expect(result.isPending).toBe(true);
    expect(result.error).toBe(error);
  });
});
