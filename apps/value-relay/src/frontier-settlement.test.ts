import { beforeEach, expect, it, vi } from "vitest";
import { settleFrontier } from "./frontier-settlement";
const rpc = vi.hoisted(() => ({ read: vi.fn(), execute: vi.fn(), wait: vi.fn(), head: vi.fn(), contract: vi.fn() }));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: () => ({ getClassAt: rpc.contract, callContract: rpc.read, waitForTransaction: rpc.wait }),
  readConfirmedLedgerHead: rpc.head,
}));
vi.mock("starknet", async (original) => ({
  ...(await original<typeof import("starknet")>()),
  Account: class {
    execute = rpc.execute;
  },
}));
const credentials = {
  rpcUrl: "https://ledger.test",
  contractAddress: "0x30",
  accountAddress: "0x20",
  privateKey: "0x1",
};
const settlement = { chainId: "0x1", gameId: 7, chestWithdrawn: "400", prizeWithdrawn: "300" };
const run = () => settleFrontier(credentials, settlement);
const season = (paid = "400", prizePaid = "300", closed = "0") => [
  "1",
  "10",
  "100",
  "700",
  "0",
  paid,
  "0",
  closed,
  "6",
  "0x99",
  "300",
  "0",
  prizePaid,
  "0",
];
beforeEach(() => {
  vi.resetAllMocks();
  rpc.head.mockResolvedValue({ number: 10, time: 100 });
  rpc.read.mockImplementation(async ({ entrypoint }) =>
    entrypoint === "frontier_claim_deadline" ? ["604900"] : season(),
  );
  rpc.contract.mockResolvedValue({
    abi: [{ type: "interface", items: [{ type: "function", name: "settle_frontier" }] }],
  });
  rpc.execute.mockResolvedValue({ transaction_hash: "0x123" });
  rpc.wait.mockResolvedValue({ isReverted: () => false });
});
it("checks confirmed payments and sends exact totals under the operator's close call", async () => {
  await run();
  expect(rpc.read).toHaveBeenCalledWith(
    { contractAddress: "0x30", entrypoint: "get_frontier", calldata: ["0x1", "7"] },
    10,
  );
  expect(rpc.execute).toHaveBeenCalledWith({
    contractAddress: "0x30",
    entrypoint: "settle_frontier",
    calldata: ["1", "7", "400", "0", "300", "0"],
  });
  expect(rpc.wait).toHaveBeenCalledWith("0x123", { errorStates: [] });
});
it.each([[season("399")], [season("400", "299")]])("refuses a not fully paid season", async (fields) => {
  rpc.read.mockImplementation(async ({ entrypoint }) =>
    entrypoint === "frontier_claim_deadline" ? ["604900"] : fields,
  );
  await expect(run()).rejects.toThrow("frontier_settlement_not_paid");
  expect(rpc.execute).not.toHaveBeenCalled();
});
it("does not submit before L2 reaches the end", async () => {
  rpc.head.mockResolvedValue({ number: 10, time: 99 });
  await expect(run()).rejects.toThrow("frontier_settlement_not_paid");
  expect(rpc.execute).not.toHaveBeenCalled();
});
it("a crash after closing resumes without a second transaction", async () => {
  rpc.read.mockResolvedValue(season("400", "300", "1"));
  await run();
  expect(rpc.execute).not.toHaveBeenCalled();
});
it("a reverted close remains an error to retry", async () => {
  rpc.wait.mockResolvedValue({ isReverted: () => true, revert_reason: "not paid" });
  await expect(run()).rejects.toThrow("frontier_settlement_reverted");
});

it("keeps the existing dev ledger on its administrator's deadline-based close", async () => {
  rpc.contract.mockResolvedValue({
    abi: [{ type: "interface", items: [{ type: "function", name: "close_frontier" }] }],
  });
  await run();
  expect(rpc.execute).not.toHaveBeenCalled();
});

it("settles unpaid receipts with confirmed L2 paid totals only once the L2 deadline passes", async () => {
  rpc.read.mockImplementation(async ({ entrypoint }) =>
    entrypoint === "frontier_claim_deadline" ? ["604900"] : season("300", "200"),
  );
  rpc.head.mockResolvedValue({ number: 10, time: 604899 });
  await expect(run()).rejects.toThrow("frontier_settlement_not_paid");
  expect(rpc.execute).not.toHaveBeenCalled();
  rpc.head.mockResolvedValue({ number: 11, time: 604900 });
  await run();
  expect(rpc.execute).toHaveBeenCalledWith({
    contractAddress: "0x30",
    entrypoint: "settle_frontier",
    calldata: ["1", "7", "300", "0", "200", "0"],
  });
  expect(rpc.read).toHaveBeenCalledWith(expect.objectContaining({ entrypoint: "frontier_claim_deadline" }), 11);
});
