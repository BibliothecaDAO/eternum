vi.mock("./environment", async (original) => ({
  ...(await original<typeof import("./environment")>()),
  ledgerAddress: () => "0x10",
}));
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
  rpcAt: () => ({ getChainId: async () => "0x1" }),
  requireActiveChain: async () => {},
}));
const post = vi.hoisted(() => vi.fn());
vi.mock("./ledger", async (original) => ({
  ...(await original<typeof import("./ledger")>()),
  postVerifiedResult: post,
}));

const result = { chainId: "0x1", gameId: 7 } as never;
const relay = (ratingsChanged: () => Promise<void>) =>
  new ValueRelay(
    { storage: { get: async () => undefined, put: async () => {} } } as unknown as DurableObjectState,
    {
      IDENTITY: { l2ChainId: async () => "0x1", ratingsChanged },
      ROSTER_MONITOR: { ledgerWritten: async () => {} },
    } as never,
  );

it("tells the identity service that ratings changed once results are posted, and only then", async () => {
  const changed = vi.fn(async () => {});
  post.mockResolvedValue(undefined);
  await relay(changed).postResult(result);
  expect(changed).toHaveBeenCalledTimes(1);
  post.mockRejectedValue(new Error("roster_unverified"));
  await expect(relay(changed).postResult(result)).rejects.toThrow();
  expect(changed).toHaveBeenCalledTimes(1);
});
it("still posts results when the identity service cannot be told", async () => {
  post.mockResolvedValue(undefined);
  await expect(
    relay(async () => {
      throw new Error("identity unavailable");
    }).postResult(result),
  ).resolves.toBeUndefined();
});
