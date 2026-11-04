import { beforeEach, expect, it, vi } from "vitest";
import { mutateDeposit } from "./deposit-ledger";
const mocks = vi.hoisted(() => ({
  principal: vi.fn(),
  deposit: vi.fn(),
  execute: vi.fn(),
  wait: vi.fn(),
  canonical: vi.fn(),
}));
vi.mock("starknet", async (original) => ({
  ...(await original<typeof import("starknet")>()),
  Account: class {
    execute = mocks.execute;
  },
}));
vi.mock("@realms-world/value-ledger", () => ({ rpcAt: () => ({ waitForTransaction: mocks.wait }) }));
vi.mock("@realms-world/value-ledger/deposits", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger/deposits")>()),
  depositReader: async () => ({
    head: { number: 10, hash: "0xa", time: 1000 },
    principal: mocks.principal,
    deposit: mocks.deposit,
    assertCanonical: mocks.canonical,
  }),
}));
const credentials = {
  rpcUrl: "https://ledger.test",
  contractAddress: "0x10",
  accountAddress: "0x20",
  privateKey: "0x30",
};
const claim = { kind: "principal" as const, shard: "0x2", season: 7, account: "0x40", amount: "60" };
const sign = vi.fn(async () => ({ r: "0x1", s: "0x2" }));
const wallet = vi.fn(async () => "0x50");
const anchors = { getAnchor: async () => undefined, putAnchor: vi.fn(async () => {}) };
const run = () => mutateDeposit(credentials, "0x1", claim, sign, anchors, wallet);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.principal.mockResolvedValue(null);
  mocks.canonical.mockResolvedValue(undefined);
  mocks.execute.mockResolvedValue({ transaction_hash: "0x11" });
  mocks.wait.mockResolvedValue({ isReverted: () => false });
});
it("a confirmed principal payment survives a lost reply and a later wallet change", async () => {
  mocks.wait.mockRejectedValueOnce(new Error("lost reply"));
  await expect(run()).rejects.toThrow("lost reply");
  expect(mocks.execute).toHaveBeenCalledWith({
    contractAddress: "0x10",
    entrypoint: "pay_principal",
    calldata: ["2", "7", "64", "80", "60", "1", "2"],
  });
  mocks.principal.mockResolvedValue({ wallet: "0x50", amount: "60" });
  wallet.mockRejectedValue(new Error("wallet changed"));
  await run();
  expect(mocks.execute).toHaveBeenCalledTimes(1);
  expect(wallet).toHaveBeenCalledTimes(1);
  expect(sign).toHaveBeenCalledTimes(1);
  expect(mocks.canonical).toHaveBeenCalledTimes(2);
});
it("rejects conflicting terminal amounts and never signs against rewritten evidence", async () => {
  mocks.principal.mockResolvedValue({ wallet: "0x50", amount: "61" });
  await expect(run()).rejects.toThrow("principal_payment_differs");
  expect(sign).not.toHaveBeenCalled();
  mocks.principal.mockResolvedValue({ wallet: "0x50", amount: "60" });
  mocks.canonical.mockRejectedValue(new Error("deposit_head_rewritten"));
  await expect(run()).rejects.toThrow("deposit_head_rewritten");
  expect(mocks.execute).not.toHaveBeenCalled();
});
