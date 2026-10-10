import { expect, it, vi } from "vitest";
import { hash, shortString } from "starknet";
import { LaunchShard } from "./shard-client";
it("recovers only its own successful single create_game invoke from confirmed game events", async () => {
  const native = new LaunchShard({
    rpcUrl: "https://shard.test",
    chainId: "0x1",
    gamesAddress: "0x77",
    accountAddress: "0x123",
    privateKey: "0x1",
  });
  vi.spyOn(native, "head").mockResolvedValue({ block_number: 10, timestamp: 100 } as Awaited<
    ReturnType<typeof native.head>
  >);
  const name = "check-worker-0123456789abcdef";
  const events = vi
    .spyOn(native.provider, "getEvents")
    .mockResolvedValue({ events: [{ transaction_hash: "0xbad" }, { transaction_hash: "0xabc" }] } as never);
  vi.spyOn(native.provider, "getTransactionByHash").mockImplementation(
    async (txHash) =>
      ({
        type: "INVOKE",
        sender_address: txHash === "0xbad" ? "0x999" : "0x123",
        calldata: ["1", "0x77", hash.getSelectorFromName("create_game"), "2", shortString.encodeShortString(name), "2"],
      }) as never,
  );
  const confirmed = vi.spyOn(native, "confirm").mockResolvedValue({} as never);
  expect(await native.creationTransaction(name, 2, 8)).toBe("0xabc");
  expect(events).toHaveBeenCalledWith(
    expect.objectContaining({ address: "0x77", from_block: { block_number: 8 }, to_block: { block_number: 10 } }),
  );
  expect(confirmed).toHaveBeenCalledWith("0xabc");
});
