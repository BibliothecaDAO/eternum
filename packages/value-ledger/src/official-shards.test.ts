import { describe, expect, it, vi } from "vitest";
import { activeShards, readRegisteredShard, requireActiveChain } from "./official-shards";
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

it("names a manifest transport failure separately from an HTTP refusal", async () => {
  const network = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("private network detail"));
  await expect(readRegisteredShard(directory, "0x1", network)).rejects.toMatchObject({
    message: "directory_shard_manifest_fetch_failed",
  });
});

describe("requireActiveChain", () => {
  const chainOf = (name: string) => `0x${Buffer.from(name, "ascii").toString("hex")}`;
  const dev = chainOf("DEV_18dfa7f2b475f083");
  const production = chainOf("PRODUCTION_18e0000000000000");
  // Even a directory that lists the other environment's chain cannot hand it to a Worker.
  const directory = {
    shards: async () => [
      { chainId: dev, url: "https://herald.dev.test", status: "active" as const },
      { chainId: production, url: "https://herald.test", status: "active" as const },
    ],
  };
  it("returns this environment's active row and refuses the other environment's chain", async () => {
    await expect(requireActiveChain(directory, dev, "staging")).resolves.toMatchObject({ chainId: dev });
    await expect(requireActiveChain(directory, production, "production")).resolves.toMatchObject({
      chainId: production,
    });
    await expect(requireActiveChain(directory, production, "staging")).rejects.toThrow("other_environment_shard");
    await expect(requireActiveChain(directory, dev, "production")).rejects.toThrow("other_environment_shard");
  });
});
