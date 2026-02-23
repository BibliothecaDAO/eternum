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
    expect(actions).toContain("move_explorer");
    expect(actions).toContain("create_trade");
    expect(actions).toContain("approve_token");
    expect(actions).toContain("lock_entry_token");
    expect(actions).toContain("settle_blitz_realm");
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

  it("executes move_explorer with current snake_case schema", async () => {
    const result = await executeAction(client as any, mockSigner, {
      type: "move_explorer",
      params: {
        explorer_id: 42,
        directions: [1, 2, 3],
        explore: true,
      },
    });

    expect(result.success).toBe(true);
    const call = vi.mocked(mockSigner.execute).mock.calls[0][0] as any;
    expect(call.entrypoint).toBe("explorer_move");
  });

  it("executes create_trade alias through create_order route", async () => {
    const result = await executeAction(client as any, mockSigner, {
      type: "create_trade",
      params: {
        maker_id: 1,
        taker_id: 0,
        maker_gives_resource_type: 1,
        taker_pays_resource_type: 2,
        maker_gives_min_resource_amount: 100,
        maker_gives_max_count: 5,
        taker_pays_min_resource_amount: 200,
        expires_at: 9999999,
      },
    });

    expect(result.success).toBe(true);
    const call = vi.mocked(mockSigner.execute).mock.calls[0][0] as any;
    expect(call.entrypoint).toBe("create_order");
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
