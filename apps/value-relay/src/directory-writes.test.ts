vi.mock("./environment", async (original) => ({
  ...(await original<typeof import("./environment")>()),
  ledgerAddress: () => "0x10",
  ledgerContractOf: () => ({ contractAddress: "0x10", deploymentBlock: 1 }),
}));
import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import { ValueRelay } from "./worker";
vi.mock("cloudflare:workers", () => ({
  WorkerEntrypoint: class {},
  DurableObject: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: () => ({ getChainId: async () => "0x3" }),
}));
const submit = vi.hoisted(() => vi.fn());
vi.mock("./ledger-batches", () => ({ ledgerBatches: () => ({ reportMany: submit }) }));
const claim = (chainId: string) => ({
  prizeRank: 0,
  prizeCount: 0,
  chainId,
  seasonId: 1,
  transactionHash: "0xab",
  realmsId: "0x1",
  amount: "1",
  confirmedAt: 1,
});
it("serializes ledger reports for different official shards and rechecks retirement after waiting for the key", async () => {
  let release!: () => void, enter!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve)),
    entered = new Promise<void>((resolve) => (enter = resolve));
  let secondStatus: "active" | "retired" = "active";
  const identity = {
    l2ChainId: async () => "0x3",
    shards: async () => [
      { chainId: "0x1", url: "https://one.test", status: "active" as const },
      { chainId: "0x2", url: "https://two.test", status: secondStatus },
    ],
  };
  const relay = new ValueRelay(
    { storage: { get: async () => undefined, put: async () => {} } } as unknown as DurableObjectState,
    {
      IDENTITY: identity,
      ROSTER_MONITOR: { ledgerWritten: async () => {} },
      COSIGNER_URL: "https://cosigner.test",
      COSIGNER_TOKEN: "test-token",
    } as never,
  );
  let running = 0,
    maximum = 0;
  const executed: string[] = [];
  submit.mockImplementation((rows) =>
    Effect.promise(async () => {
      executed.push(rows[0].chainId);
      running++;
      maximum = Math.max(maximum, running);
      enter();
      await held;
      running--;
      return rows.map((row: ReturnType<typeof claim>) => ({ claimId: row.transactionHash, error: null }));
    }),
  );
  const first = relay.reportMany([claim("0x1")]);
  await entered;
  const second = relay.reportMany([claim("0x2")]);
  const refusal = expect(second).rejects.toMatchObject({ operation: "verify official value chain" });
  secondStatus = "retired";
  release();
  await first;
  await refusal;
  expect(maximum).toBe(1);
  expect(submit).toHaveBeenCalledTimes(1);
  expect(running).toBe(0);
  expect(executed).toEqual(["0x1"]);
});
it.each([
  { error: null, announced: 1 },
  { error: "ledger_season_closed", announced: 0 },
])("tells the monitor about a batch only if a claim was written (error: $error)", async ({ error, announced }) => {
  const written = vi.fn(async () => {});
  const relay = new ValueRelay(
    { storage: { get: async () => undefined, put: async () => {} } } as unknown as DurableObjectState,
    {
      IDENTITY: { l2ChainId: async () => "0x3", shards: async () => [{ chainId: "0x1", status: "active" }] },
      ROSTER_MONITOR: { ledgerWritten: written },
      COSIGNER_URL: "https://cosigner.test",
      COSIGNER_TOKEN: "test-token",
    } as never,
  );
  submit.mockImplementation((rows) =>
    Effect.succeed(rows.map((row: { transactionHash: string }) => ({ claimId: row.transactionHash, error }))),
  );
  await relay.reportMany([claim("0x1")]);
  expect(written).toHaveBeenCalledTimes(announced);
});
