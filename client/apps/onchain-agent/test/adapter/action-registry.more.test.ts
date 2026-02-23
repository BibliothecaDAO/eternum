import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeAction } from "../../src/adapter/action-registry";
import { createMockClient, mockSigner } from "../utils/mock-client";
import { initializeTestActionRegistry } from "../utils/init-action-registry";

describe("action-registry additional routes", () => {
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    initializeTestActionRegistry();
    client = createMockClient();
    vi.mocked(mockSigner.execute).mockReset();
    vi.mocked(mockSigner.execute).mockResolvedValue({ transaction_hash: "0xabc123" });
  });

  it("routes attack_guard to the ABI entrypoint", async () => {
    const result = await executeAction(client as any, mockSigner, {
      type: "attack_guard",
      params: { explorer_id: 1, structure_id: 2, structure_direction: 3 },
    });

    expect(result.success).toBe(true);
    const call = vi.mocked(mockSigner.execute).mock.calls[0][0] as any;
    expect(call.entrypoint).toBe("attack_explorer_vs_guard");
  });

  it("routes cancel_trade alias to cancel_order", async () => {
    const result = await executeAction(client as any, mockSigner, {
      type: "cancel_trade",
      params: { trade_id: 11 },
    });

    expect(result.success).toBe(true);
    const call = vi.mocked(mockSigner.execute).mock.calls[0][0] as any;
    expect(call.entrypoint).toBe("cancel_order");
  });

  it("executes pause_production with struct params", async () => {
    const result = await executeAction(client as any, mockSigner, {
      type: "pause_production",
      params: { structure_id: 1, building_coord: { x: 2, y: 3 } },
    });

    expect(result.success).toBe(true);
    const call = vi.mocked(mockSigner.execute).mock.calls[0][0] as any;
    expect(call.entrypoint).toBe("pause_building_production");
  });

  it("returns clear error for move_to without world-state provider", async () => {
    const result = await executeAction(client as any, mockSigner, {
      type: "move_to",
      params: { explorerId: 1, targetCol: 10, targetRow: 20 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("World state provider not initialized");
  });
});
