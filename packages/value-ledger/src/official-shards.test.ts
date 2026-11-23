import { expect, it, vi } from "vitest";
import { officialChain, readRegisteredShard, requireActiveChain, type ShardDirectory } from "./official-shards";
const directory = {
  shard: vi.fn<ShardDirectory["shard"]>(async () => ({ chainId: "0x1", url: "https://one.test" })),
};
it("names the directory's one chain, read anew, and none when nothing is listed", async () => {
  expect(await officialChain(directory)).toEqual({ chainId: "0x1", url: "https://one.test" });
  directory.shard.mockResolvedValueOnce(null);
  expect(await officialChain(directory)).toBeNull();
});
it("accepts only the listed chain when a route names one", async () => {
  expect(await requireActiveChain(directory, "0x01")).toEqual({ chainId: "0x1", url: "https://one.test" });
  await expect(requireActiveChain(directory, "0x2")).rejects.toThrow("unlisted_or_inactive_shard");
  directory.shard.mockResolvedValueOnce(null);
  await expect(requireActiveChain(directory, "0x1")).rejects.toThrow("unlisted_or_inactive_shard");
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
  directory.shard.mockResolvedValueOnce(null);
  await expect(readRegisteredShard(directory, "0x1", network)).rejects.toThrow("unlisted_shard");
});

it("names a manifest transport failure separately from an HTTP refusal", async () => {
  const network = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("private network detail"));
  await expect(readRegisteredShard(directory, "0x1", network)).rejects.toMatchObject({
    message: "directory_shard_manifest_fetch_failed",
  });
});
