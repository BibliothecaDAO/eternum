// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const reactQueryMocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useQueries: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => reactQueryMocks);
vi.mock("@/runtime/world", () => ({
  getFactorySqlBaseUrl: vi.fn(),
}));
vi.mock("@/runtime/world/factory-resolver", () => ({
  fetchBulkAvailability: vi.fn(),
  isToriiAvailable: vi.fn(),
  resolveWorldContracts: vi.fn(),
}));
vi.mock("@/ui/features/admin/constants", () => ({
  getRpcUrlForChain: vi.fn(),
}));
vi.mock("starknet", () => ({
  RpcProvider: class RpcProvider {},
}));
vi.mock("../../env", () => ({
  env: {
    VITE_PUBLIC_REALTIME_URL: "https://realtime.example",
  },
}));

import { useWorldsAvailability } from "./use-world-availability";

describe("useWorldsAvailability bulk gating", () => {
  beforeEach(() => {
    reactQueryMocks.useQuery.mockReset();
    reactQueryMocks.useQueries.mockReset();
    reactQueryMocks.useQueries.mockImplementation(({ queries }: { queries: Array<Record<string, unknown>> }) =>
      queries.map((query) => ({
        data: undefined,
        isLoading: Boolean(query.enabled),
        error: null,
        refetch: vi.fn(),
      })),
    );
  });

  it("waits for the bulk availability query to settle before enabling per-world checks", () => {
    reactQueryMocks.useQuery.mockReturnValue({
      data: undefined,
      isPending: true,
    });

    useWorldsAvailability([{ name: "alpha", chain: "mainnet" }], true, null);

    const [{ queries }] = reactQueryMocks.useQueries.mock.calls[0] as [
      {
        queries: Array<{ enabled: boolean }>;
      },
    ];

    expect(queries[0]?.enabled).toBe(false);
  });

  it("enables per-world checks once the bulk availability query has settled", () => {
    reactQueryMocks.useQuery.mockReturnValue({
      data: {},
      isPending: false,
    });

    useWorldsAvailability([{ name: "alpha", chain: "mainnet" }], true, null);

    const [{ queries }] = reactQueryMocks.useQueries.mock.calls[0] as [
      {
        queries: Array<{ enabled: boolean }>;
      },
    ];

    expect(queries[0]?.enabled).toBe(true);
  });

  it("keeps isAnyLoading=true while bulk availability is pending so the UI doesn't flash unavailable", () => {
    // Regression: on first modal open the bulk query is still pending, so per-world
    // queries are gated off. A disabled react-query reports isLoading=false with
    // data=undefined, which collapsed to isAvailable=false and surfaced the
    // "The selected world is currently unavailable." warning for one frame.
    reactQueryMocks.useQuery.mockReturnValue({
      data: undefined,
      isPending: true,
    });
    reactQueryMocks.useQueries.mockImplementation(({ queries }: { queries: Array<Record<string, unknown>> }) =>
      queries.map(() => ({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })),
    );

    const { isAnyLoading, allSettled } = useWorldsAvailability(
      [{ name: "alpha", chain: "mainnet" }],
      true,
      null,
    );

    expect(isAnyLoading).toBe(true);
    expect(allSettled).toBe(false);
  });
});
