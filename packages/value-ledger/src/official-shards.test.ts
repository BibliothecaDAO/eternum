import { expect, it, vi } from "vitest";
import { activeShards, readRegisteredShard } from "./official-shards";
const directory = {
  shards: vi.fn(async () => [
    { chainId: "0x1", url: "https://one.test", status: "active" as const },
    { chainId: "0x2", url: "https://two.test", status: "retired" as const },
  ]),
};
it("reads official membership anew and never serves a retired shard as playable", async () => {
  expect(await activeShards(directory)).toEqual([{ chainId: "0x1", url: "https://one.test", status: "active" }]);
  directory.shards.mockResolvedValueOnce([{ chainId: "0x1", url: "https://one.test", status: "retired" } as never]);
  expect(await activeShards(directory)).toEqual([]);
});
it("uses the directory URL and refuses a mismatched manifest rather than any configured shard", async () => {
  const network = vi.fn<typeof fetch>(async () =>
    Response.json({
      version: 1,
      chainId: "0x3",
      rpcUrl: "https://proxy.test/rpc/v0_10_2",
      contracts: { games: "0x10" },
      accountClassHash: "0x20",
      guardianPublicKey: "0x30",
    }),
  );
  await expect(readRegisteredShard(directory, "0x1", network)).rejects.toThrow("directory_manifest_chain_differs");
  expect(network).toHaveBeenCalledWith(
    new URL("https://one.test/manifest"),
    expect.objectContaining({ redirect: "manual" }),
  );
  await expect(readRegisteredShard(directory, "0x99", network)).rejects.toThrow("unlisted_shard");
});
