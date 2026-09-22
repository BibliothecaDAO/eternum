import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
const env = vi.hoisted(() => ({
  GAME_RPC_URL: "https://rpc.test",
  PLAYER_REGISTRY_ADDRESS: "0x123",
  NATIVE_WORLD_MANIFEST: "",
}));
vi.mock("../env", () => ({ serverEnv: env }));
import { ownerOfGameplayAccount, verifyGameplayBindingChain } from "../binding";
afterEach(() => vi.unstubAllGlobals());

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

it("checks the current RPC chain on each pass instead of the provider's cached chain", async () => {
  const directory = mkdtempSync(join(tmpdir(), "binding-chain-"));
  env.NATIVE_WORLD_MANIFEST = join(directory, "manifest.json");
  writeFileSync(env.NATIVE_WORLD_MANIFEST, JSON.stringify({ shard: { chainId: "0xa1" } }));
  let chain = "0xa1";
  let reads = 0;
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
  try {
    await verifyGameplayBindingChain("0xa1");
    chain = "0xb1";
    await expect(verifyGameplayBindingChain("0xa1")).rejects.toThrow("chains differ");
    expect(reads).toBe(2);
    await expect(verifyGameplayBindingChain("0xb1")).rejects.toThrow("chains differ");
  } finally {
    rmSync(directory, { recursive: true });
  }
});
