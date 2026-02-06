import { beforeEach, describe, expect, it } from "vitest";
import { executeAction } from "../../src/adapter/action-registry";
import { createMockClient, mockSigner } from "../utils/mock-client";

describe("action-registry additional handlers", () => {
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    client = createMockClient();
  });

  it("routes remaining troop handlers", async () => {
    await executeAction(client as any, mockSigner, {
      type: "add_to_explorer",
      params: { toExplorerId: "1", amount: "2", homeDirection: "3" },
    });
    expect(client.troops.addToExplorer).toHaveBeenCalledOnce();

    await executeAction(client as any, mockSigner, {
      type: "delete_explorer",
      params: { explorerId: "5" },
    });
    expect(client.troops.deleteExplorer).toHaveBeenCalledOnce();

    await executeAction(client as any, mockSigner, {
      type: "add_guard",
      params: { forStructureId: "7", slot: "1", category: "2", tier: "3", amount: "9" },
    });
    expect(client.troops.addGuard).toHaveBeenCalledOnce();

    await executeAction(client as any, mockSigner, {
      type: "delete_guard",
      params: { forStructureId: "7", slot: "1" },
    });
    expect(client.troops.deleteGuard).toHaveBeenCalledOnce();

    await executeAction(client as any, mockSigner, {
      type: "travel_explorer",
      params: { explorerId: "11", directions: ["1", "2"] },
    });
    expect(client.troops.travel).toHaveBeenCalledOnce();

    await executeAction(client as any, mockSigner, {
      type: "explore",
      params: { explorerId: "12", directions: ["3"] },
    });
    expect(client.troops.explore).toHaveBeenCalledOnce();

    await executeAction(client as any, mockSigner, {
      type: "swap_explorer_to_explorer",
      params: {
        fromExplorerId: "1",
        toExplorerId: "2",
        toExplorerDirection: "3",
        count: "4",
      },
    });
    expect(client.troops.swapExplorerToExplorer).toHaveBeenCalledOnce();

    await executeAction(client as any, mockSigner, {
      type: "swap_guard_to_explorer",
      params: {
        fromStructureId: "1",
        fromGuardSlot: "2",
        toExplorerId: "3",
        toExplorerDirection: "4",
        count: "5",
      },
    });
    expect(client.troops.swapGuardToExplorer).toHaveBeenCalledOnce();
  });

  it("routes remaining combat handlers", async () => {
    await executeAction(client as any, mockSigner, {
      type: "attack_guard",
      params: { explorerId: "1", structureId: "2", structureDirection: "3" },
    });
    expect(client.combat.attackGuard).toHaveBeenCalledOnce();

    await executeAction(client as any, mockSigner, {
      type: "guard_attack_explorer",
      params: {
        structureId: "1",
        structureGuardSlot: "2",
        explorerId: "3",
        explorerDirection: "4",
      },
    });
    expect(client.combat.guardAttackExplorer).toHaveBeenCalledOnce();

    await executeAction(client as any, mockSigner, {
      type: "raid",
      params: {
        explorerId: "2",
        structureId: "9",
        structureDirection: "1",
        stealResources: [{ resourceType: "8", amount: "9" }],
      },
    });
    expect(client.combat.raid).toHaveBeenCalledOnce();
    const [, raidProps] = client.combat.raid.mock.calls[0];
    expect(raidProps.stealResources).toEqual([{ resourceId: 8, amount: 9 }]);
  });

  it("routes trade aliases and handlers", async () => {
    await executeAction(client as any, mockSigner, {
      type: "accept_order",
      params: { takerId: "1", tradeId: "2", takerBuysCount: "3" },
    });
    expect(client.trade.acceptOrder).toHaveBeenCalledOnce();

    await executeAction(client as any, mockSigner, {
      type: "accept_trade",
      params: { takerId: "5", tradeId: "6", takerBuysCount: "7" },
    });
    expect(client.trade.acceptOrder).toHaveBeenCalledTimes(2);

    await executeAction(client as any, mockSigner, {
      type: "cancel_order",
      params: { tradeId: "10" },
    });
    expect(client.trade.cancelOrder).toHaveBeenCalledOnce();

    await executeAction(client as any, mockSigner, {
      type: "cancel_trade",
      params: { tradeId: "11" },
    });
    expect(client.trade.cancelOrder).toHaveBeenCalledTimes(2);
  });

  it("routes remaining building, bank, guild and hyperstructure handlers", async () => {
    await executeAction(client as any, mockSigner, {
      type: "pause_production",
      params: { entityId: "1", buildingCoord: { alt: "1", x: "2", y: "3" } },
    });
    expect(client.buildings.pauseProduction).toHaveBeenCalledOnce();

    await executeAction(client as any, mockSigner, {
      type: "resume_production",
      params: { entityId: "4", buildingCoord: { x: "5", y: "6" } },
    });
    expect(client.buildings.resumeProduction).toHaveBeenCalledOnce();

    await executeAction(client as any, mockSigner, {
      type: "sell_resources",
      params: { bankEntityId: "1", entityId: "2", resourceType: "3", amount: "4" },
    });
    expect(client.bank.sell).toHaveBeenCalledOnce();

    await executeAction(client as any, mockSigner, {
      type: "add_liquidity",
      params: {
        bankEntityId: "1",
        entityId: "2",
        calls: [{ resourceType: "3", resourceAmount: "4", lordsAmount: "5" }],
      },
    });
    expect(client.bank.addLiquidity).toHaveBeenCalledOnce();

    await executeAction(client as any, mockSigner, {
      type: "remove_liquidity",
      params: { bankEntityId: "1", entityId: "2", resourceType: "3", shares: "4" },
    });
    expect(client.bank.removeLiquidity).toHaveBeenCalledOnce();

    await executeAction(client as any, mockSigner, {
      type: "join_guild",
      params: { guildEntityId: "10" },
    });
    expect(client.guild.join).toHaveBeenCalledOnce();

    await executeAction(client as any, mockSigner, {
      type: "contribute_hyperstructure",
      params: {
        hyperstructureEntityId: "11",
        contributorEntityId: "12",
        contributions: ["1", "2", "3"],
      },
    });
    expect(client.hyperstructure.contribute).toHaveBeenCalledOnce();
  });
});
