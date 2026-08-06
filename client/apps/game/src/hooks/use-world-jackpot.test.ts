// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reactQueryMocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => reactQueryMocks);

const starknetMocks = vi.hoisted(() => ({
  callContract: vi.fn(),
}));

vi.mock("starknet", () => ({
  RpcProvider: class RpcProvider {
    constructor() {
      /* no-op */
    }
    callContract = starknetMocks.callContract;
  },
}));

vi.mock("@/ui/features/admin/constants", () => ({
  getRpcUrlForChain: vi.fn(() => "https://rpc.example"),
}));

import { useWorldJackpot, fetchJackpotBalance } from "./use-world-jackpot";

beforeEach(() => {
  reactQueryMocks.useQuery.mockReset();
  starknetMocks.callContract.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchJackpotBalance", () => {
  it("calls balance_of and combines low/high u256 into a bigint", async () => {
    starknetMocks.callContract.mockResolvedValueOnce(["0x10", "0x0"]);

    const balance = await fetchJackpotBalance({
      chain: "mainnet",
      feeTokenAddress: "0xfee",
      prizeDistributionAddress: "0xprize",
    });

    expect(balance).toBe(16n);
    expect(starknetMocks.callContract).toHaveBeenCalledWith({
      contractAddress: "0xfee",
      entrypoint: "balance_of",
      calldata: ["0xprize"],
    });
  });

  it("returns 0n when the call returns a short payload", async () => {
    starknetMocks.callContract.mockResolvedValueOnce(["0x10"]);

    const balance = await fetchJackpotBalance({
      chain: "mainnet",
      feeTokenAddress: "0xfee",
      prizeDistributionAddress: "0xprize",
    });

    expect(balance).toBe(0n);
  });

  it("returns 0n when the call throws", async () => {
    starknetMocks.callContract.mockRejectedValueOnce(new Error("down"));

    const balance = await fetchJackpotBalance({
      chain: "mainnet",
      feeTokenAddress: "0xfee",
      prizeDistributionAddress: "0xprize",
    });

    expect(balance).toBe(0n);
  });
});

describe("useWorldJackpot", () => {
  it("registers the query with enabled=false when address/token are missing", () => {
    reactQueryMocks.useQuery.mockReturnValue({ data: 0n, isPending: false });

    useWorldJackpot({ chain: "mainnet", feeTokenAddress: null, prizeDistributionAddress: null });

    const [opts] = reactQueryMocks.useQuery.mock.calls[0] as [Record<string, unknown>];
    expect(opts.enabled).toBe(false);
  });

  it("enables the query when address and token are set and gate is true", () => {
    reactQueryMocks.useQuery.mockReturnValue({ data: 0n, isPending: false });

    useWorldJackpot({
      chain: "mainnet",
      feeTokenAddress: "0xfee",
      prizeDistributionAddress: "0xprize",
      enabled: true,
    });

    const [opts] = reactQueryMocks.useQuery.mock.calls[0] as [Record<string, unknown>];
    expect(opts.enabled).toBe(true);
    expect(opts.staleTime).toBe(60_000);
  });

  it("respects an explicit enabled=false even when addresses are set", () => {
    reactQueryMocks.useQuery.mockReturnValue({ data: 0n, isPending: false });

    useWorldJackpot({
      chain: "mainnet",
      feeTokenAddress: "0xfee",
      prizeDistributionAddress: "0xprize",
      enabled: false,
    });

    const [opts] = reactQueryMocks.useQuery.mock.calls[0] as [Record<string, unknown>];
    expect(opts.enabled).toBe(false);
  });

  it("keys the query on chain + prize + fee so different worlds cache separately", () => {
    reactQueryMocks.useQuery.mockReturnValue({ data: 0n, isPending: false });

    useWorldJackpot({
      chain: "appchain",
      feeTokenAddress: "0xfee",
      prizeDistributionAddress: "0xprize",
    });

    const [opts] = reactQueryMocks.useQuery.mock.calls[0] as [Record<string, unknown>];
    expect(opts.queryKey).toEqual(["worldJackpot", "appchain", "0xprize", "0xfee"]);
  });
});
