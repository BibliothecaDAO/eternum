import { beforeEach, expect, it, vi } from "vitest";
import { mutateDeposit } from "./deposit-ledger";

const chain = vi.hoisted(() => ({
  head: 12,
  final: 10,
  hashes: {} as Record<number, string>,
  paid: false,
  execute: vi.fn(),
}));
vi.mock("starknet", async (original) => ({
  ...(await original<typeof import("starknet")>()),
  Account: class {
    execute = chain.execute;
  },
}));
vi.mock("@realms-world/value-ledger", async (original) => {
  const real = await original<typeof import("@realms-world/value-ledger")>();
  const block = (number: number, status: string) => ({
    block_number: number,
    block_hash: chain.hashes[number]!,
    timestamp: 1000 + number,
    status,
  });
  return {
    ...real,
    rpcAt: () => ({
      getChainId: async () => "0x1",
      getBlock: async (id: number | string) =>
        id === "latest"
          ? block(chain.head, "ACCEPTED_ON_L2")
          : id === "l1_accepted"
            ? block(chain.final, "ACCEPTED_ON_L1")
            : block(id as number, (id as number) <= chain.final ? "ACCEPTED_ON_L1" : "ACCEPTED_ON_L2"),
      callContract: async () => (chain.paid ? ["0", "0x50", "60"] : ["1"]),
      waitForTransaction: async () => ({ isReverted: () => false }),
    }),
  };
});

const credentials = {
  rpcUrl: "https://ledger.test",
  contractAddress: "0x10",
  accountAddress: "0x20",
  privateKey: "0x30",
};
const claim = { kind: "principal" as const, shard: "0x2", season: 7, account: "0x40", amount: "60" };
const stored = new Map<string, { number: number; hash: string }>();
const pay = () =>
  mutateDeposit(
    credentials,
    "0x1",
    claim,
    async () => ({ r: "0x1", s: "0x2" }),
    {
      getAnchor: async (key) => stored.get(key),
      putAnchor: async (key, anchor) => void stored.set(key, anchor),
    },
    async () => "0x50",
  );

beforeEach(() => {
  vi.clearAllMocks();
  stored.clear();
  chain.head = 12;
  chain.final = 10;
  chain.hashes = { 10: "0xf0", 12: "0xa1" };
  chain.paid = false;
  chain.execute.mockResolvedValue({ transaction_hash: "0x11" });
});

it("pays again after a rewrite removed the payment from the head the anchor was stored at", async () => {
  expect((await pay()).wrote).toBe(true);
  expect(stored.size).toBe(1);
  chain.head = 13;
  chain.hashes = { 10: "0xf0", 12: "0xb2", 13: "0xb3" };
  expect((await pay()).wrote).toBe(true);
  expect(chain.execute).toHaveBeenCalledTimes(2);
  expect([...stored.values()][0]).toMatchObject({ number: 13, hash: "0xb3" });
});

it("does not pay again after a rewrite that kept the payment", async () => {
  await pay();
  chain.head = 13;
  chain.hashes = { 10: "0xf0", 12: "0xb2", 13: "0xb3" };
  chain.paid = true;
  expect((await pay()).wrote).toBe(false);
  expect(chain.execute).toHaveBeenCalledTimes(1);
});

it("still refuses to read from a ledger whose accepted block was rewritten", async () => {
  await pay();
  chain.final = 12;
  chain.head = 13;
  chain.hashes = { 12: "0xb2", 13: "0xb3" };
  await expect(pay()).rejects.toThrow("deposit_head_rewritten");
  expect(chain.execute).toHaveBeenCalledTimes(1);
});
