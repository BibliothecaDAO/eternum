import { beforeEach, expect, it, vi } from "vitest";
import type { RpcProvider } from "starknet";

beforeEach(() => vi.resetModules());

it("reuses immutable class content across readers but checks each confirmed block binding", async () => {
  const { readShardAbi } = await import("./shard-abi");
  const getClassHashAt = vi.fn().mockResolvedValue("0x123");
  const getClassByHash = vi.fn().mockResolvedValue({ abi: [] });
  const provider = () => ({ getClassHashAt, getClassByHash }) as unknown as RpcProvider;
  await readShardAbi(provider(), "0xa", 10);
  await readShardAbi(provider(), "0xa", 11);
  await readShardAbi(provider(), "0xb", 12);
  expect(getClassByHash).toHaveBeenCalledExactlyOnceWith("0x123");
  expect(getClassHashAt.mock.calls).toEqual([
    ["0xa", 10],
    ["0xa", 11],
    ["0xb", 12],
  ]);
  getClassHashAt.mockResolvedValue("0x456");
  getClassByHash.mockResolvedValue({ abi: [{ type: "event", name: "new" }] });
  expect(await readShardAbi(provider(), "0xa", 13)).toEqual([{ type: "event", name: "new" }]);
  expect(getClassByHash).toHaveBeenLastCalledWith("0x456");
  // The ledger and each shard are different classes: changing back finds the first one still kept.
  getClassHashAt.mockResolvedValue("0x123");
  await readShardAbi(provider(), "0xa", 14);
  expect(getClassByHash).toHaveBeenCalledTimes(2);
  // The cache is bounded: the oldest class leaves first.
  for (const hash of ["0x201", "0x202", "0x203", "0x204"]) {
    getClassHashAt.mockResolvedValue(hash);
    await readShardAbi(provider(), "0xa", 15);
  }
  getClassHashAt.mockResolvedValue("0x123");
  await readShardAbi(provider(), "0xa", 16);
  expect(getClassByHash).toHaveBeenCalledTimes(7);
});

it("retries a failed class fetch and rejects a missing ABI", async () => {
  const { readShardAbi } = await import("./shard-abi");
  const getClassByHash = vi
    .fn()
    .mockRejectedValueOnce(new Error("unavailable"))
    .mockResolvedValueOnce({ abi: null })
    .mockResolvedValue({ abi: "[]" });
  const provider = { getClassHashAt: async () => "0x123", getClassByHash } as unknown as RpcProvider;
  await expect(readShardAbi(provider, "0xa", 10)).rejects.toThrow("unavailable");
  await expect(readShardAbi(provider, "0xa", 10)).rejects.toThrow("shard_abi_unavailable");
  await expect(readShardAbi(provider, "0xa", 10)).resolves.toEqual([]);
  expect(getClassByHash).toHaveBeenCalledTimes(3);
});
