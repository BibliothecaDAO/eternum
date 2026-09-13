import { afterEach, expect, it, vi } from "vitest";
import { expectedChainId } from "@realms-world/chain";
vi.mock("../env", () => ({ serverEnv: { GAME_RPC_URL: "https://rpc.test", PLAYER_REGISTRY_ADDRESS: "0x123" } }));
import { ownerOfGameplayAccount, verifyGameplayBindingChain } from "../binding";
afterEach(() => vi.unstubAllGlobals());
it("checks the current RPC chain on each pass instead of the provider's cached chain", async () => {
  let chain = expectedChainId("madara"),
    reads = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init: RequestInit) => {
      const request = JSON.parse(String(init.body));
      if (request.method === "starknet_chainId") reads++;
      return Response.json({
        jsonrpc: "2.0",
        id: request.id,
        result: request.method === "starknet_chainId" ? chain : "0.9.0",
      });
    }),
  );
  await verifyGameplayBindingChain("madara");
  chain = "0x1";
  await expect(verifyGameplayBindingChain("madara")).rejects.toThrow("chains differ");
  expect(reads).toBe(2);
});

it("resolves recipients from confirmed registry state", async () => {
  let block: unknown;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init: RequestInit) => {
      const request = JSON.parse(String(init.body));
      block = request.params.block_id;
      return Response.json({ jsonrpc: "2.0", id: request.id, result: ["0x1"] });
    }),
  );
  expect(await ownerOfGameplayAccount("0xa")).toBe("0x1");
  expect(block).toBe("latest");
});
