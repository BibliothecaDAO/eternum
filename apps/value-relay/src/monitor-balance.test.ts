import { beforeEach, expect, it, vi } from "vitest";
import mainnetAddresses from "../../../contracts/common/addresses/mainnet.json";
import { readMonitorFeeBalance } from "./monitor-balance";

const rpc = vi.hoisted(() => ({ block: vi.fn(), call: vi.fn() }));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: () => ({ getBlock: rpc.block, callContract: rpc.call }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  rpc.block.mockResolvedValue({ status: "ACCEPTED_ON_L2", block_number: 10, block_hash: "0xa", timestamp: 1000 });
});
it.each([
  ["0", "monitor_strk_low"],
  ["99999999999999999", "monitor_strk_low"],
  ["100000000000000000", null],
  ["1000000000000000000", null],
])("reads confirmed STRK and warns only below the threshold (%s)", async (amount, warning) => {
  rpc.call.mockResolvedValue([amount, "0"]);
  expect(await readMonitorFeeBalance("https://ledger.test", "0x123")).toEqual({
    account: "0x123",
    token: mainnetAddresses.strk,
    balance_wei: amount,
    low_balance_threshold_wei: "100000000000000000",
    warning,
    block_number: 10,
  });
  expect(rpc.call).toHaveBeenCalledExactlyOnceWith(
    {
      contractAddress: mainnetAddresses.strk,
      entrypoint: "balance_of",
      calldata: ["0x123"],
    },
    10,
  );
});
it.each([["0"], ["-1", "0"], [String(2n ** 128n), "0"]])("rejects a malformed balance (%j)", async (...fields) => {
  rpc.call.mockResolvedValue(fields);
  await expect(readMonitorFeeBalance("https://ledger.test", "0x123")).rejects.toThrow();
});
it("refuses an unconfirmed head and an absent account", async () => {
  rpc.block.mockResolvedValue({ status: "PRE_CONFIRMED", block_number: 10, block_hash: "0xa", timestamp: 1000 });
  await expect(readMonitorFeeBalance("https://ledger.test", "0x123")).rejects.toThrow();
  await expect(readMonitorFeeBalance("https://ledger.test", "0x0")).rejects.toThrow("monitor_account_missing");
  expect(rpc.call).not.toHaveBeenCalled();
});
