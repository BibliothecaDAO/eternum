import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createABIExecutor } from "../../src/abi/executor";
import { generateActions } from "../../src/abi/action-gen";
import type { DomainOverlayMap } from "../../src/abi/types";

// Load real manifest from repo root
const manifestPath = resolve(__dirname, "../manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

// Mock account that records execute calls
function createMockAccount(txHash = "0xdeadbeef") {
  return {
    execute: vi.fn().mockResolvedValue({ transaction_hash: txHash }),
    address: "0x1234",
  } as any;
}

function createFailingAccount(error: string) {
  return {
    execute: vi.fn().mockRejectedValue(new Error(error)),
    address: "0x1234",
  } as any;
}

// ABI param names from the real manifest (not the action-registry's renamed versions)
const CREATE_GUILD_PARAMS = { public: true, name: "TestGuild" };
const BUY_PARAMS = { bank_entity_id: 1, structure_id: 42, resource_type: 1, amount: 100n };

describe("createABIExecutor", () => {
  it("creates an executor with execute method", () => {
    const { routes } = generateActions(manifest);
    const account = createMockAccount();
    const executor = createABIExecutor(manifest, account, { routes });

    expect(executor).toBeDefined();
    expect(typeof executor.execute).toBe("function");
  });

  it("returns error for unknown action type", async () => {
    const { routes } = generateActions(manifest);
    const account = createMockAccount();
    const executor = createABIExecutor(manifest, account, { routes });

    const result = await executor.execute({ type: "nonexistent_action", params: {} });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown action type");
  });

  it("executes a known action and returns tx hash", async () => {
    const { routes } = generateActions(manifest);
    const account = createMockAccount("0xabc123");
    const executor = createABIExecutor(manifest, account, { routes });

    const result = await executor.execute({
      type: "create_guild",
      params: CREATE_GUILD_PARAMS,
    });

    expect(result.success).toBe(true);
    expect(result.txHash).toBe("0xabc123");
    expect(account.execute).toHaveBeenCalledTimes(1);
  });

  it("returns error on tx failure", async () => {
    const { routes } = generateActions(manifest);
    const account = createFailingAccount("execution reverted: insufficient funds");
    const executor = createABIExecutor(manifest, account, { routes });

    const result = await executor.execute({
      type: "create_guild",
      params: CREATE_GUILD_PARAMS,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("runs preflight validation from overlay", async () => {
    const overlays: DomainOverlayMap = {
      "guild_systems::create_guild": {
        preflight: (_params) => "Cannot create guild right now",
      },
    };

    const { routes } = generateActions(manifest, { overlays });
    const account = createMockAccount();
    const executor = createABIExecutor(manifest, account, { routes });

    const result = await executor.execute({
      type: "create_guild",
      params: CREATE_GUILD_PARAMS,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Cannot create guild right now");
    expect(account.execute).not.toHaveBeenCalled();
  });

  it("applies param transforms from overlay", async () => {
    const PRECISION = 1_000_000_000;
    const overlays: DomainOverlayMap = {
      "swap_systems::buy": {
        paramOverrides: {
          amount: { transform: (v: unknown) => BigInt(Math.floor(Number(v) * PRECISION)) },
        },
      },
    };

    const { routes } = generateActions(manifest, { overlays });
    const account = createMockAccount();
    const executor = createABIExecutor(manifest, account, { routes });

    await executor.execute({
      type: "buy",
      params: { bank_entity_id: 1, structure_id: 42, resource_type: 1, amount: 100 },
    });

    expect(account.execute).toHaveBeenCalledTimes(1);
  });

  it("calls onBeforeExecute and onAfterExecute hooks", async () => {
    const { routes } = generateActions(manifest);
    const account = createMockAccount();

    const beforeCalls: string[] = [];
    const afterCalls: { type: string; success: boolean }[] = [];

    const executor = createABIExecutor(manifest, account, {
      routes,
      onBeforeExecute: (type) => beforeCalls.push(type),
      onAfterExecute: (type, result) => afterCalls.push({ type, success: result.success }),
    });

    await executor.execute({
      type: "create_guild",
      params: CREATE_GUILD_PARAMS,
    });

    expect(beforeCalls).toEqual(["create_guild"]);
    expect(afterCalls).toEqual([{ type: "create_guild", success: true }]);
  });

  it("preflight passes cached state to validator", async () => {
    const mockState = { entities: [], tick: 100 };
    let receivedState: unknown;

    const overlays: DomainOverlayMap = {
      "guild_systems::create_guild": {
        preflight: (_params, cachedState) => {
          receivedState = cachedState;
          return null; // pass
        },
      },
    };

    const { routes } = generateActions(manifest, { overlays });
    const account = createMockAccount();
    const executor = createABIExecutor(manifest, account, {
      routes,
      cachedStateProvider: () => mockState,
    });

    await executor.execute({
      type: "create_guild",
      params: CREATE_GUILD_PARAMS,
    });

    expect(receivedState).toBe(mockState);
    expect(account.execute).toHaveBeenCalledTimes(1);
  });

  it("encodes calldata correctly via Contract.populate", async () => {
    const { routes } = generateActions(manifest);
    const account = createMockAccount();
    const executor = createABIExecutor(manifest, account, { routes });

    await executor.execute({
      type: "create_guild",
      params: { public: true, name: "Foo" },
    });

    // Verify the call passed to account.execute
    const call = account.execute.mock.calls[0][0];
    expect(call.entrypoint).toBe("create_guild");
    expect(call.contractAddress).toBeTruthy();
    expect(call.calldata).toBeDefined();
  });
});
