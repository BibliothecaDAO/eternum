// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reactQueryMocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => reactQueryMocks);
vi.mock("../../env", () => ({
  env: {
    VITE_PUBLIC_REALTIME_URL: "https://realtime.example",
  },
}));

import { useWorldsSummary, fetchWorldsSummary } from "./use-worlds-summary";

const mockFetch = vi.fn<typeof globalThis.fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  reactQueryMocks.useQuery.mockReset();
});

afterEach(() => {
  mockFetch.mockReset();
  vi.restoreAllMocks();
});

describe("fetchWorldsSummary", () => {
  it("hits the /api/worlds/summary endpoint and parses the JSON array", async () => {
    const payload = [{ name: "alpha", chain: "mainnet", alive: true, mode: "blitz" }];
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }));

    const result = await fetchWorldsSummary("https://realtime.example");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: "alpha", chain: "mainnet", alive: true });
    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://realtime.example/api/worlds/summary");
  });

  it("throws on non-2xx response so react-query retry can kick in", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 503 }));

    await expect(fetchWorldsSummary("https://realtime.example")).rejects.toThrow();
  });

  it("returns an empty array when payload is empty", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    const result = await fetchWorldsSummary("https://realtime.example");

    expect(result).toEqual([]);
  });
});

describe("useWorldsSummary", () => {
  it("registers a single shared query with the expected staleTime and refetchInterval", () => {
    reactQueryMocks.useQuery.mockReturnValue({ data: undefined, isPending: true });

    useWorldsSummary();

    const [opts] = reactQueryMocks.useQuery.mock.calls[0] as [Record<string, unknown>];
    expect(opts.queryKey).toEqual(["worldsSummary"]);
    expect(opts.staleTime).toBe(25_000);
    expect(opts.refetchInterval).toBe(30_000);
    expect(opts.refetchIntervalInBackground).toBe(false);
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
