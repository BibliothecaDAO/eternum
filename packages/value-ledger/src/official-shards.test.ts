import { expect, it, vi } from "vitest";
import { officialChain, readRegisteredShard, requireActiveChain } from "./official-shards";
const directory = {
  shards: vi.fn(async () => [
    { chainId: "0x1", url: "https://one.test", status: "active" as const },
    { chainId: "0x2", url: "https://two.test", status: "retired" as const },
  ]),
};
it("names the one chain the directory serves, read anew, and never a retired one", async () => {
  expect(await officialChain(directory)).toEqual({ chainId: "0x1", url: "https://one.test", status: "active" });
  directory.shards.mockResolvedValueOnce([{ chainId: "0x1", url: "https://one.test", status: "retired" } as never]);
  expect(await officialChain(directory)).toBeNull();
});
it("refuses a directory that serves two chains", async () => {
  const two = {
    shards: async () => [
      { chainId: "0x1", url: "https://one.test", status: "active" as const },
      { chainId: "0x2", url: "https://two.test", status: "draining" as const },
    ],
  };
  await expect(officialChain(two)).rejects.toThrow("more_than_one_official_chain");
  await expect(requireActiveChain(two, "0x1")).rejects.toThrow("more_than_one_official_chain");
});
it("accepts only the official chain when a route names one", async () => {
  expect(await requireActiveChain(directory, "0x01")).toMatchObject({ chainId: "0x1" });
  await expect(requireActiveChain(directory, "0x2")).rejects.toThrow("unlisted_or_inactive_shard");
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

it("names a manifest transport failure separately from an HTTP refusal", async () => {
  const network = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("private network detail"));
  await expect(readRegisteredShard(directory, "0x1", network)).rejects.toMatchObject({
    message: "directory_shard_manifest_fetch_failed",
  });
});
