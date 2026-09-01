import { describe, expect, it, vi } from "vitest";
import { Effect } from "effect";

import { createGameplayAccountService } from "./gameplay-account";

describe("verified owner to gameplay account mapping", () => {
  it("reads the bound account from PlayerRegistry at pre-confirmed", async () => {
    const fetchRpc = vi.fn().mockResolvedValue(Response.json({ jsonrpc: "2.0", id: 1, result: ["0x0abc"] }));
    const service = createGameplayAccountService({
      rpcUrl: "http://madara",
      playerRegistryAddress: "0xregistry",
      fetch: fetchRpc,
    });

    await expect(Effect.runPromise(service.resolve("0xowner"))).resolves.toBe("0xabc");
    expect(JSON.parse(fetchRpc.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      method: "starknet_call",
      params: { request: { contract_address: "0xregistry", calldata: ["0xowner"] }, block_id: "pre_confirmed" },
    });
  });
});
