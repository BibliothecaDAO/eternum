const sweep = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("./frontier-sweep", () => ({ sweepFrontierLords: sweep }));
vi.mock("./frontier-prizes", () => ({ awardFrontierPrizes: vi.fn(async () => {}) }));
vi.mock("./frontier-pools", () => ({ publishFrontierPools: vi.fn(async () => {}) }));
vi.mock("./environment", async (original) => ({
  ...(await original<typeof import("./environment")>()),
  ledgerAddress: () => "0x10",
}));
import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { ValueRelay } from "./worker";
import { mutateDeposit } from "./deposit-ledger";

vi.mock("cloudflare:workers", () => ({
  WorkerEntrypoint: class {},
  DurableObject: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}));
const chain = vi.hoisted(() => ({
  principal: vi.fn(),
  finalPrincipal: vi.fn(),
  execute: vi.fn(),
  wait: vi.fn(),
}));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: () => ({ getChainId: async () => "0x1", waitForTransaction: chain.wait }),
  requireActiveChain: async () => {},
  relayAccountAddress: () => "0x5",
  activeShards: async () => [{ chainId: "0x1" }],
  readRegisteredShard: async () => ({
    chainId: "0x1",
    rpcUrl: "https://shard.test",
    contracts: { games: "0x2" },
    releaseSchemas: { "1": "0xs" },
  }),
}));
vi.mock("@realms-world/value-ledger/deposits", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger/deposits")>()),
  depositReader: async () => ({
    head: { number: 10, hash: "0xa", time: 1000 },
    principal: chain.principal,
    assertCanonical: async () => {},
    final: async () => ({ block: { number: 9, hash: "0xf" }, principal: chain.finalPrincipal }),
  }),
}));
vi.mock("starknet", async (original) => ({
  ...(await original<typeof import("starknet")>()),
  Account: class {
    execute = chain.execute;
  },
}));
vi.mock("./shard-rpc", async (original) => ({
  ...(await original<typeof import("./shard-rpc")>()),
  ShardReader: class {
    head = async () => 0;
    header = async () => ({});
    page = async () => ({});
  },
}));
vi.mock("./shard-account", () => ({ joinShardOperator: vi.fn(async () => "0x5") }));
vi.mock("./relay", async (original) => ({
  ...(await original<typeof import("./relay")>()),
  runRelay: () => Effect.succeed({ status: "ready", more: false, deferred: [] }),
}));

const claim = { chainId: "0x1", gameId: 7, account: "0x40", amount: "60" };
const credentials = { LEDGER_OPERATOR_ADDRESS: "0x20", LEDGER_OPERATOR_PRIVATE_KEY: "0x30" };
let linked: string | null;

/** The shard actor with a ledger actor behind it that runs the real principal payment. */
function relay() {
  const data = new Map<string, unknown>();
  const storage = {
    get: async (key: string) => data.get(key),
    put: async (key: string, value: unknown) => void data.set(key, value),
    setAlarm: async () => {},
    list: async () => new Map(),
    delete: async (key: string) => data.delete(key),
    transaction: async (run: (tx: unknown) => Promise<unknown>) => run(storage),
  };
  const ledgerActor = {
    depositMutation: async (request: Parameters<typeof mutateDeposit>[2]) =>
      (
        await mutateDeposit(
          { rpcUrl: "https://ledger.test", contractAddress: "0x10", accountAddress: "0x20", privateKey: "0x30" },
          "0x1",
          request,
          async () => ({ r: "0x1", s: "0x2" }),
          { getAnchor: async () => undefined, putAnchor: async () => {} },
          async () => {
            if (!linked) throw new Error("principal_wallet_unavailable");
            return linked;
          },
        )
      ).final,
  };
  return new ValueRelay(
    { storage } as unknown as DurableObjectState,
    {
      ENVIRONMENT: "staging",
      L2_RPC_URL: "https://ledger.test",
      SHARD_LEDGER_OPERATOR_PRIVATE_KEY: "0x1",
      COSIGNER_URL: "https://cosigner.test",
      COSIGNER_TOKEN: "test-cosigner-token",
      ...credentials,
      RELAY: { idFromName: (id: string) => id, get: () => ledgerActor },
      IDENTITY: {
        l2ChainId: async () => "0x1",
        realmsIdForAccount: async () => "0x77",
        linkedWallet: async () => linked,
      },
    } as never,
  );
}

/** The callback the shard tick hands the sweep for paying one principal. */
async function payPrincipal(shardActor: ValueRelay) {
  sweep.mockClear();
  await shardActor.tick("0x1");
  return (
    sweep.mock.calls[0] as unknown as [unknown, unknown, unknown, unknown, (claim: unknown) => Promise<unknown>]
  )[4];
}

beforeEach(() => {
  vi.clearAllMocks();
  linked = "0x50";
  chain.principal.mockResolvedValue(null);
  chain.finalPrincipal.mockResolvedValue(null);
  chain.execute.mockResolvedValue({ transaction_hash: "0x11" });
  chain.wait.mockResolvedValue({ isReverted: () => false });
});

it("recognizes a principal paid with a lost reply after the wallet unlinks, and then stops paying it", async () => {
  const pay = await payPrincipal(relay());
  chain.wait.mockRejectedValueOnce(new Error("lost reply"));
  await expect(pay(claim)).rejects.toThrow("lost reply");
  expect(chain.execute).toHaveBeenCalledTimes(1);
  linked = null;
  chain.principal.mockResolvedValue({ wallet: "0x50", amount: "60" });
  expect(await pay(claim)).toBeNull();
  chain.finalPrincipal.mockResolvedValue({ wallet: "0x50", amount: "60" });
  expect(await pay(claim)).toEqual({ block: 9, hash: "0xf" });
  expect(chain.execute).toHaveBeenCalledTimes(1);
});

it("reads nothing on the ledger for a principal never tried whose player has no linked wallet", async () => {
  linked = null;
  const pay = await payPrincipal(relay());
  for (let tick = 0; tick < 3; tick++) await expect(pay(claim)).rejects.toThrow("principal_wallet_unavailable");
  expect(chain.principal).not.toHaveBeenCalled();
  expect(chain.execute).not.toHaveBeenCalled();
});
