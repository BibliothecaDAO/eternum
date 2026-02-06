import { describe, it, expect, beforeEach } from "vitest";
import {
  getAvailableActions,
  getActionHandler,
  executeAction,
} from "../../src/adapter/action-registry";
import { createMockClient, mockSigner } from "../utils/mock-client";

describe("action-registry", () => {
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    client = createMockClient();
  });

  // -----------------------------------------------------------------------
  // getAvailableActions
  // -----------------------------------------------------------------------

  describe("getAvailableActions", () => {
    it("returns all registered action types", () => {
      const actions = getAvailableActions();

      const expected = [
        "send_resources",
        "pickup_resources",
        "claim_arrivals",
        "create_explorer",
        "add_to_explorer",
        "delete_explorer",
        "add_guard",
        "delete_guard",
        "move_explorer",
        "travel_explorer",
        "explore",
        "attack_explorer",
        "attack_guard",
        "guard_attack_explorer",
        "raid",
        "create_trade",
        "accept_trade",
        "cancel_trade",
        "create_building",
        "destroy_building",
        "pause_production",
        "resume_production",
        "buy_resources",
        "sell_resources",
        "add_liquidity",
        "remove_liquidity",
        "create_guild",
        "join_guild",
        "leave_guild",
        "upgrade_realm",
        "contribute_hyperstructure",
      ];

      for (const action of expected) {
        expect(actions).toContain(action);
      }

      expect(actions.length).toBe(expected.length);
    });
  });

  // -----------------------------------------------------------------------
  // getActionHandler
  // -----------------------------------------------------------------------

  describe("getActionHandler", () => {
    it("returns a handler for known action types", () => {
      expect(getActionHandler("send_resources")).toBeTypeOf("function");
      expect(getActionHandler("create_explorer")).toBeTypeOf("function");
      expect(getActionHandler("leave_guild")).toBeTypeOf("function");
    });

    it("returns undefined for unknown action types", () => {
      expect(getActionHandler("nonexistent_action")).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // executeAction – unknown type
  // -----------------------------------------------------------------------

  describe("executeAction", () => {
    it("returns error for unknown action type", async () => {
      const result = await executeAction(client as any, mockSigner, {
        type: "does_not_exist",
        params: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown action type: does_not_exist");
    });

    // ---------------------------------------------------------------------
    // Resources
    // ---------------------------------------------------------------------

    it("send_resources calls client.resources.send with coerced params", async () => {
      const result = await executeAction(client as any, mockSigner, {
        type: "send_resources",
        params: {
          senderEntityId: "10",
          recipientEntityId: "20",
          resources: [{ resourceType: "1", amount: "500" }],
        },
      });

      expect(result.success).toBe(true);
      expect(result.txHash).toBe("0xabc123");
      expect(client.resources.send).toHaveBeenCalledOnce();

      const [signer, props] = client.resources.send.mock.calls[0];
      expect(signer).toBe(mockSigner);
      expect(props.senderEntityId).toBe(10);
      expect(props.recipientEntityId).toBe(20);
      expect(props.resources).toEqual([{ resourceType: 1, amount: 500 }]);
    });

    it("pickup_resources calls client.resources.pickup", async () => {
      const result = await executeAction(client as any, mockSigner, {
        type: "pickup_resources",
        params: {
          recipientEntityId: 5,
          ownerEntityId: 7,
          resources: [{ resourceType: 2, amount: 100 }],
        },
      });

      expect(result.success).toBe(true);
      expect(client.resources.pickup).toHaveBeenCalledOnce();
    });

    it("claim_arrivals calls client.resources.claimArrivals", async () => {
      const result = await executeAction(client as any, mockSigner, {
        type: "claim_arrivals",
        params: { structureId: 1, day: 5, slot: 0, resourceCount: 3 },
      });

      expect(result.success).toBe(true);
      expect(client.resources.claimArrivals).toHaveBeenCalledOnce();
    });

    // ---------------------------------------------------------------------
    // Troops
    // ---------------------------------------------------------------------

    it("create_explorer calls client.troops.createExplorer", async () => {
      const result = await executeAction(client as any, mockSigner, {
        type: "create_explorer",
        params: {
          forStructureId: "1",
          category: "2",
          tier: "1",
          amount: "100",
          spawnDirection: "3",
        },
      });

      expect(result.success).toBe(true);
      const [, props] = client.troops.createExplorer.mock.calls[0];
      expect(props.forStructureId).toBe(1);
      expect(props.category).toBe(2);
      expect(props.tier).toBe(1);
      expect(props.amount).toBe(100);
      expect(props.spawnDirection).toBe(3);
    });

    it("move_explorer coerces directions array and boolean explore", async () => {
      const result = await executeAction(client as any, mockSigner, {
        type: "move_explorer",
        params: {
          explorerId: "42",
          directions: ["1", "2", "3"],
          explore: "true",
        },
      });

      expect(result.success).toBe(true);
      const [, props] = client.troops.move.mock.calls[0];
      expect(props.explorerId).toBe(42);
      expect(props.directions).toEqual([1, 2, 3]);
      expect(props.explore).toBe(true);
    });

    it("leave_guild calls client.guild.leave with just signer", async () => {
      const result = await executeAction(client as any, mockSigner, {
        type: "leave_guild",
        params: {},
      });

      expect(result.success).toBe(true);
      expect(client.guild.leave).toHaveBeenCalledWith(mockSigner);
    });

    // ---------------------------------------------------------------------
    // Error handling
    // ---------------------------------------------------------------------

    it("wraps client errors into ActionResult", async () => {
      client.resources.send.mockRejectedValueOnce(new Error("tx reverted"));

      const result = await executeAction(client as any, mockSigner, {
        type: "send_resources",
        params: {
          senderEntityId: 1,
          recipientEntityId: 2,
          resources: [],
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("tx reverted");
    });

    // ---------------------------------------------------------------------
    // Combat
    // ---------------------------------------------------------------------

    it("attack_explorer coerces stealResources array", async () => {
      const result = await executeAction(client as any, mockSigner, {
        type: "attack_explorer",
        params: {
          aggressorId: "10",
          defenderId: "20",
          defenderDirection: "1",
          stealResources: [{ resourceId: "3", amount: "50" }],
        },
      });

      expect(result.success).toBe(true);
      const [, props] = client.combat.attackExplorer.mock.calls[0];
      expect(props.aggressorId).toBe(10);
      expect(props.stealResources).toEqual([{ resourceId: 3, amount: 50 }]);
    });

    // ---------------------------------------------------------------------
    // Trade
    // ---------------------------------------------------------------------

    it("create_trade calls client.trade.createOrder", async () => {
      const result = await executeAction(client as any, mockSigner, {
        type: "create_trade",
        params: {
          makerId: 1,
          takerId: 0,
          makerGivesResourceType: 1,
          takerPaysResourceType: 2,
          makerGivesMinResourceAmount: 100,
          makerGivesMaxCount: 5,
          takerPaysMinResourceAmount: 200,
          expiresAt: 9999999,
        },
      });

      expect(result.success).toBe(true);
      expect(client.trade.createOrder).toHaveBeenCalledOnce();
    });

    // ---------------------------------------------------------------------
    // Buildings
    // ---------------------------------------------------------------------

    it("create_building coerces directions and boolean useSimple", async () => {
      const result = await executeAction(client as any, mockSigner, {
        type: "create_building",
        params: {
          entityId: "5",
          directions: ["1", "2"],
          buildingCategory: "3",
          useSimple: "false",
        },
      });

      expect(result.success).toBe(true);
      const [, props] = client.buildings.create.mock.calls[0];
      expect(props.entityId).toBe(5);
      expect(props.directions).toEqual([1, 2]);
      expect(props.buildingCategory).toBe(3);
      expect(props.useSimple).toBe(false);
    });

    it("destroy_building coerces buildingCoord object", async () => {
      const result = await executeAction(client as any, mockSigner, {
        type: "destroy_building",
        params: {
          entityId: 5,
          buildingCoord: { x: "10", y: "20" },
        },
      });

      expect(result.success).toBe(true);
      const [, props] = client.buildings.destroy.mock.calls[0];
      expect(props.buildingCoord).toEqual({ alt: undefined, x: 10, y: 20 });
    });

    // ---------------------------------------------------------------------
    // Bank
    // ---------------------------------------------------------------------

    it("buy_resources calls client.bank.buy", async () => {
      const result = await executeAction(client as any, mockSigner, {
        type: "buy_resources",
        params: {
          bankEntityId: 1,
          entityId: 2,
          resourceType: 3,
          amount: 100,
        },
      });

      expect(result.success).toBe(true);
      expect(client.bank.buy).toHaveBeenCalledOnce();
    });

    // ---------------------------------------------------------------------
    // transactionHash alternate key
    // ---------------------------------------------------------------------

    it("extracts transactionHash from alternate key", async () => {
      client.realm.upgrade.mockResolvedValueOnce({ transactionHash: "0xdef456" });

      const result = await executeAction(client as any, mockSigner, {
        type: "upgrade_realm",
        params: { realmEntityId: 1 },
      });

      expect(result.success).toBe(true);
      expect(result.txHash).toBe("0xdef456");
    });
  });
});
