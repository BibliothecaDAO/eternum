import { ledgerCall } from "../../../packages/value-ledger/test-support/ledger-abi";
import { beforeEach, expect, it, vi } from "vitest";
import { ValueRelay } from "./worker";

const rpc = vi.hoisted(() => ({
  chain: vi.fn(),
  block: vi.fn(),
  number: vi.fn(),
  call: vi.fn(),
  execute: vi.fn(),
  wait: vi.fn(),
  classAt: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({
  WorkerEntrypoint: class {},
  DurableObject: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}));
vi.mock("./environment", async (original) => ({
  ...(await original<typeof import("./environment")>()),
  ledgerAddress: () => "0x10",
  ledgerContractOf: () => ({ contractAddress: "0x10", deploymentBlock: 5 }),
}));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: () => ({
    getChainId: rpc.chain,
    getBlock: rpc.block,
    getBlockNumber: rpc.number,
    callContract: rpc.call,
    waitForTransaction: rpc.wait,
    getClassHashAt: rpc.classAt,
  }),
}));
vi.mock("starknet", async (original) => ({
  ...(await original<typeof import("starknet")>()),
  Account: vi.fn(function () {
    return { execute: rpc.execute };
  }),
}));

const key = { chainId: "0x1", slotId: 7 };
const openSlot = (cancelled: boolean) => ["3", "1", "9", "100", "160", "0", "0", "1", cancelled ? "1" : "0"];
const relay = () =>
  new ValueRelay(
    {
      storage: { setAlarm: async () => {} },
      blockConcurrencyWhile: async (run: () => Promise<unknown>) => run(),
    } as unknown as DurableObjectState,
    {
      L2_RPC_URL: "https://ledger.test",
      ENVIRONMENT: "staging",
      LEDGER_OPERATOR_ADDRESS: "0x20",
      LEDGER_OPERATOR_PRIVATE_KEY: "unused-test-key",
      IDENTITY: {
        l2ChainId: async () => "0x2",
        shard: async () => ({ chainId: "0x1", url: "https://shard.test" }),
      },
    } as never,
  );

beforeEach(() => {
  vi.clearAllMocks();
  rpc.chain.mockResolvedValue("0x2");
  rpc.number.mockResolvedValue(11);
  rpc.block.mockResolvedValue({ status: "ACCEPTED_ON_L2", block_number: 10, block_hash: "0xa", timestamp: 50 });
  rpc.wait.mockResolvedValue({ isReverted: () => false });
  rpc.classAt.mockResolvedValue("0xc1a55");
});

it("refunds every registration of a paid slot still open by cancelling it on the ledger", async () => {
  let cancelled = false;
  rpc.call.mockImplementation(async () => openSlot(cancelled));
  rpc.execute.mockImplementation(async () => {
    cancelled = true;
    return { transaction_hash: "0xabc" };
  });

  expect(await relay().refundSlot(key)).toBeNull();

  expect(rpc.execute).toHaveBeenCalledOnce();
  expect(rpc.execute.mock.calls[0]![0].calldata.map(BigInt)).toEqual(
    ledgerCall("cancel_slot", { key: { shard: key.chainId, slot_id: key.slotId } }).map(BigInt),
  );
  expect(await relay().refundSlot(key)).toBeNull();
  expect(rpc.execute).toHaveBeenCalledOnce();
});
