import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeAction, getActionHandler, getAvailableActions } from "../../src/adapter/action-registry";
import { createMockClient, mockSigner } from "../utils/mock-client";
import { initializeTestActionRegistry } from "../utils/init-action-registry";

describe("action-registry (ABI executor)", () => {
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    initializeTestActionRegistry();
    client = createMockClient();
    vi.mocked(mockSigner.execute).mockReset();
    vi.mocked(mockSigner.execute).mockResolvedValue({ transaction_hash: "0xabc123" });
  });

  it("lists current action types including aliases and composites", () => {
    const actions = getAvailableActions();
    expect(actions).toContain("send_resources");
    expect(actions).toContain("move_to");
    expect(actions).toContain("approve_token");
    expect(actions).toContain("settle");
    expect(actions).toContain("create_hyperstructure");
    expect(actions).not.toContain("reserve_hyperstructures");
    expect(actions).not.toContain("lock_entry_token");
    expect(actions).not.toContain("settle_blitz_realm");
  });

  it("returns handlers for known types", () => {
    expect(getActionHandler("send_resources")).toBeTypeOf("function");
    expect(getActionHandler("leave_guild")).toBeTypeOf("function");
    expect(getActionHandler("nonexistent_action")).toBeUndefined();
  });

  it("returns unknown-action error for missing routes", async () => {
    const result = await executeAction(client as any, mockSigner, {
      type: "does_not_exist",
      params: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Unknown action type: does_not_exist");
  });

  it("executes send_resources via signer.execute", async () => {
    const result = await executeAction(client as any, mockSigner, {
      type: "send_resources",
      params: {
        sender_structure_id: 10,
        recipient_structure_id: 20,
        resources: [{ resourceType: 1, amount: 5 }],
      },
    });

    expect(result.success).toBe(true);
    expect(result.txHash).toBe("0xabc123");
    expect(mockSigner.execute).toHaveBeenCalledOnce();
    const call = vi.mocked(mockSigner.execute).mock.calls[0][0] as any;
    expect(call.entrypoint).toBe("send");
  });

  it("executes explorer_move via executeAction (internal route still callable)", async () => {
    // explorer_move is internal: true — no definition visible to the LLM,
    // but it still has a route and can be called programmatically
    const result = await executeAction(client as any, mockSigner, {
      type: "explorer_move",
      params: {
        explorer_id: 42,
        directions: [1, 2, 3],
        explore: false,
      },
    });

    expect(result.success).toBe(true);
    const call = vi.mocked(mockSigner.execute).mock.calls[0][0] as any;
    expect(call.entrypoint).toBe("explorer_move");
  });

  it("executes leave_guild without params", async () => {
    const result = await executeAction(client as any, mockSigner, {
      type: "leave_guild",
      params: {},
    });

    expect(result.success).toBe(true);
    const call = vi.mocked(mockSigner.execute).mock.calls[0][0] as any;
    expect(call.entrypoint).toBe("leave_guild");
  });

  it("wraps blitz settle with temporary collection approval when an entry token is configured", async () => {
    initializeTestActionRegistry({ entryToken: "0xentry" });

    const result = await executeAction(client as any, mockSigner, {
      type: "settle",
      params: {
        name: "0x123",
        entry_token_id: "1",
        cosmetic_token_ids: [],
      },
    });

    expect(result.success).toBe(true);
    expect(mockSigner.execute).toHaveBeenCalledOnce();

    const calls = vi.mocked(mockSigner.execute).mock.calls[0][0] as any[];
    expect(Array.isArray(calls)).toBe(true);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatchObject({
      contractAddress: "0xentry",
      entrypoint: "set_approval_for_all",
    });
    expect(calls[1]).toMatchObject({
      entrypoint: "settle",
      calldata: ["0x123", "1", "0", "1"],
    });
    expect(calls[2]).toMatchObject({
      contractAddress: "0xentry",
      entrypoint: "set_approval_for_all",
    });
  });

  it("surfaces signer execution errors", async () => {
    vi.mocked(mockSigner.execute).mockRejectedValueOnce(new Error("tx reverted"));

    const result = await executeAction(client as any, mockSigner, {
      type: "send_resources",
      params: {
        sender_structure_id: 1,
        recipient_structure_id: 2,
        resources: [{ resourceType: 1, amount: 1 }],
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("tx reverted");
  });
});
