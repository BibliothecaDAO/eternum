import { Effect, Option } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({
  env: { VITE_PUBLIC_IDENTITY_RPC_URL: "https://rpc.test" },
}));

import { Wallet } from "./wallet";

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

describe("Wallet.disconnect", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("forgets the wallet so reconnect has no session to restore", async () => {
    const storage = createStorage();
    storage.setItem("realms:last-wallet", "ready");
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("window", {});

    const reconnected = await Effect.runPromise(
      Effect.gen(function* () {
        const wallet = yield* Wallet;
        yield* wallet.disconnect;
        return yield* wallet.reconnect;
      }).pipe(Effect.provide(Wallet.layer)),
    );

    expect(storage.getItem("realms:last-wallet")).toBeNull();
    expect(Option.isNone(reconnected)).toBe(true);
  });
});
