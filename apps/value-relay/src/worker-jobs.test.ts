import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import { ValueRelay } from "./worker";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}));
const finish = vi.hoisted(() => vi.fn());
vi.mock("./chests", () => ({ DurableChestStore: class {}, finishRequestedChests: finish }));
it("runs and publishes the chest job even while shard ingestion remains unavailable", async () => {
  const data = new Map<string, unknown>();
  const ctx = {
    storage: {
      get: async (key: string) => data.get(key),
      put: async (key: string, value: unknown) => {
        data.set(key, value);
      },
    },
  };
  finish.mockReturnValue(Effect.succeed({ finished: 1, failed: 0, pending: 0 }));
  const relay = new ValueRelay(ctx as unknown as DurableObjectState, { SHARD_CHAIN_ID: "0x1" } as never);
  const observation = await relay.tick();
  expect(observation.value.status).toBe("unavailable");
  expect(observation.chests).toEqual({ finished: 1, failed: 0, pending: 0 });
  expect(finish).toHaveBeenCalledOnce();
  expect((await relay.health()).success).toBe(false);
  expect(data.has("lastTick")).toBe(true);
});
