import { expect, it, vi } from "vitest";
import type { RpcProvider } from "starknet";
import { readBlitzRoster } from "./shard-roster";

it("reads account-wallet pairs in contract order at the caller's confirmed head", async () => {
  const callContract = vi.fn(async () => ["2", "0xa", "0x1", "0xb", "0x2"]);
  const provider = { callContract } as unknown as RpcProvider;
  expect(await readBlitzRoster(provider, "0x77", 7, 100)).toEqual([
    { account: "0xa", wallet: "0x1" },
    { account: "0xb", wallet: "0x2" },
  ]);
  expect(callContract).toHaveBeenCalledWith(
    { contractAddress: "0x77", entrypoint: "blitz_roster", calldata: ["7"] },
    100,
  );
  callContract.mockResolvedValue(["0"]);
  expect(await readBlitzRoster(provider, "0x77", 7, 100)).toEqual([]);
  for (const fields of [[], ["2", "0xa", "0x1"], ["1", "0xa", "0x1", "0xb"]]) {
    callContract.mockResolvedValue(fields);
    await expect(readBlitzRoster(provider, "0x77", 7, 100)).rejects.toThrow();
  }
});
