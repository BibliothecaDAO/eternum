import { describe, it, expect, vi } from "vitest";
import { createMockClient, mockSigner } from "../utils/mock-client";

// Mock the compute functions from @bibliothecadao/client used by simulation.ts
vi.mock("@bibliothecadao/client", () => ({
  computeStrength: (count: number, tier: number) => count * tier * 10,
  computeOutputAmount: (amountIn: number, reserveIn: number, reserveOut: number) =>
    Math.floor((amountIn * reserveOut) / (reserveIn + amountIn)),
  computeBuildingCost: (category: number) => [{ resourceType: 1, amount: category * 100 }],
}));

// Import after mock
const { EternumGameAdapter } = await import("../../src/adapter/eternum-adapter");

describe("EternumGameAdapter", () => {
  function createAdapter() {
    const client = createMockClient() as any;
    const adapter = new EternumGameAdapter(client, mockSigner, "0xdeadbeef");
    return { adapter, client };
  }

  describe("getWorldState", () => {
    it("returns a populated world state", async () => {
      const { adapter } = createAdapter();
      const state = await adapter.getWorldState();

      expect(state.tick).toBeGreaterThan(0);
      expect(state.entities.length).toBeGreaterThan(0);
      expect(state.player.address).toBe("0xdeadbeef");
    });
  });

  describe("executeAction", () => {
    it("dispatches known actions to the client", async () => {
      const { adapter, client } = createAdapter();

      const result = await adapter.executeAction({
        type: "send_resources",
        params: {
          senderEntityId: 1,
          recipientEntityId: 2,
          resources: [{ resourceType: 1, amount: 100 }],
        },
      });

      expect(result.success).toBe(true);
      expect(result.txHash).toBe("0xabc123");
      expect(client.resources.send).toHaveBeenCalled();
    });

    it("returns error for unknown action types", async () => {
      const { adapter } = createAdapter();

      const result = await adapter.executeAction({
        type: "nonexistent_action",
        params: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown action type");
    });
  });

  describe("simulateAction", () => {
    it("simulates combat actions with strength calculation", async () => {
      const { adapter } = createAdapter();

      const result = await adapter.simulateAction({
        type: "create_explorer",
        params: { amount: 10, tier: 2 },
      });

      expect(result.success).toBe(true);
      expect(result.outcome).toBeDefined();
      expect((result.outcome as any).strength).toBe(200); // 10 * 2 * 10
    });

    it("returns success for unknown action types with info message", async () => {
      const { adapter } = createAdapter();

      const result = await adapter.simulateAction({
        type: "leave_guild",
        params: {},
      });

      expect(result.success).toBe(true);
      expect((result.outcome as any)?.message).toContain("No simulation model");
    });
  });
});
