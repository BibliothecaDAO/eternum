import { afterEach, describe, expect, it, vi } from "vitest";

const useQueryMock = vi.fn();
const fetchActiveTransfersMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: useQueryMock,
}));

vi.mock("@/services/api", () => ({
  sqlApi: {
    fetchActiveTransfers: fetchActiveTransfersMock,
  },
}));

describe("useActiveTransfers", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("queries active transfers through SqlApi with a stable key", async () => {
    useQueryMock.mockReturnValue({ data: [] });

    const { useActiveTransfers } = await import("./use-active-transfers");
    useActiveTransfers(250, 1800);

    expect(useQueryMock).toHaveBeenCalledTimes(1);
    const queryOptions = useQueryMock.mock.calls[0][0];

    expect(queryOptions.queryKey).toEqual(["activeTransfers", 250, 1800]);

    fetchActiveTransfersMock.mockResolvedValue([{ id: "live:event-1" }]);
    await expect(queryOptions.queryFn()).resolves.toEqual([{ id: "live:event-1" }]);
    expect(fetchActiveTransfersMock).toHaveBeenCalledWith(250, 1800);
  });
});
