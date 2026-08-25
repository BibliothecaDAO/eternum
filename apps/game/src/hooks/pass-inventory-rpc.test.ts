import { describe, expect, it, vi } from "vitest";
import { RpcProvider } from "starknet";

import { createContractEntrypointSupportResolver, parseUint256CallResult } from "./pass-inventory-rpc";

describe("parseUint256CallResult", () => {
  it("parses cairo uint256 low/high call results", () => {
    expect(parseUint256CallResult(["0x2", "0x1"])).toBe(2n + (1n << 128n));
    expect(parseUint256CallResult(undefined)).toBe(0n);
  });
});

describe("createContractEntrypointSupportResolver", () => {
  it("returns false when the contract ABI lacks the requested entrypoint", async () => {
    const provider = {
      getClassAt: vi.fn().mockResolvedValue({
        abi: [{ name: "balance_of" }, { name: "get_encoded_metadata" }],
      }),
    } as unknown as RpcProvider;

    const resolveEntrypointSupport = createContractEntrypointSupportResolver(provider);

    await expect(resolveEntrypointSupport("0x1", "token_of_owner_by_index")).resolves.toBe(false);
  });

  it("finds entrypoints nested inside ABI interface items", async () => {
    const provider = {
      getClassAt: vi.fn().mockResolvedValue({
        abi: [
          {
            name: "openzeppelin::token::erc721::interface::IERC721Enumerable",
            items: [{ name: "token_of_owner_by_index" }],
          },
        ],
      }),
    } as unknown as RpcProvider;

    const resolveEntrypointSupport = createContractEntrypointSupportResolver(provider);

    await expect(resolveEntrypointSupport("0x2", "token_of_owner_by_index")).resolves.toBe(true);
  });

  it("caches entrypoint support per contract and entrypoint", async () => {
    const provider = {
      getClassAt: vi.fn().mockResolvedValue({
        abi: [{ name: "token_of_owner_by_index" }],
      }),
    } as unknown as RpcProvider;

    const resolveEntrypointSupport = createContractEntrypointSupportResolver(provider);

    await expect(resolveEntrypointSupport("0xabc", "token_of_owner_by_index")).resolves.toBe(true);
    await expect(resolveEntrypointSupport("0xAbC", "token_of_owner_by_index")).resolves.toBe(true);

    expect(provider.getClassAt).toHaveBeenCalledTimes(1);
  });
});
