import { describe, expect, it } from "vitest";
import { TransactionClient } from "../../src/transactions";
import { BankTransactions } from "../../src/transactions/bank";
import { BuildingTransactions } from "../../src/transactions/buildings";
import { CombatTransactions } from "../../src/transactions/combat";
import { GuildTransactions } from "../../src/transactions/guild";
import { HyperstructureTransactions } from "../../src/transactions/hyperstructure";
import { RealmTransactions } from "../../src/transactions/realm";
import { ResourceTransactions } from "../../src/transactions/resources";
import { TradeTransactions } from "../../src/transactions/trade";
import { TroopTransactions } from "../../src/transactions/troops";

// Minimal mock provider -- we only need to verify grouping, not execution
const mockProvider = {} as any;

describe("TransactionClient grouping", () => {
  const client = new TransactionClient(mockProvider);

  it("creates all transaction groups", () => {
    expect(client.resources).toBeInstanceOf(ResourceTransactions);
    expect(client.troops).toBeInstanceOf(TroopTransactions);
    expect(client.combat).toBeInstanceOf(CombatTransactions);
    expect(client.trade).toBeInstanceOf(TradeTransactions);
    expect(client.buildings).toBeInstanceOf(BuildingTransactions);
    expect(client.bank).toBeInstanceOf(BankTransactions);
    expect(client.hyperstructure).toBeInstanceOf(HyperstructureTransactions);
    expect(client.guild).toBeInstanceOf(GuildTransactions);
    expect(client.realm).toBeInstanceOf(RealmTransactions);
  });

  it("resources group has expected methods", () => {
    expect(typeof client.resources.send).toBe("function");
    expect(typeof client.resources.pickup).toBe("function");
    expect(typeof client.resources.claimArrivals).toBe("function");
  });

  it("troops group has expected methods", () => {
    expect(typeof client.troops.createExplorer).toBe("function");
    expect(typeof client.troops.addToExplorer).toBe("function");
    expect(typeof client.troops.deleteExplorer).toBe("function");
    expect(typeof client.troops.addGuard).toBe("function");
    expect(typeof client.troops.deleteGuard).toBe("function");
    expect(typeof client.troops.move).toBe("function");
    expect(typeof client.troops.travel).toBe("function");
    expect(typeof client.troops.explore).toBe("function");
    expect(typeof client.troops.swapExplorerToExplorer).toBe("function");
    expect(typeof client.troops.swapExplorerToGuard).toBe("function");
    expect(typeof client.troops.swapGuardToExplorer).toBe("function");
  });

  it("combat group has expected methods", () => {
    expect(typeof client.combat.attackExplorer).toBe("function");
    expect(typeof client.combat.attackGuard).toBe("function");
    expect(typeof client.combat.guardAttackExplorer).toBe("function");
    expect(typeof client.combat.raid).toBe("function");
  });

  it("trade group has expected methods", () => {
    expect(typeof client.trade.createOrder).toBe("function");
    expect(typeof client.trade.acceptOrder).toBe("function");
    expect(typeof client.trade.cancelOrder).toBe("function");
  });

  it("buildings group has expected methods", () => {
    expect(typeof client.buildings.create).toBe("function");
    expect(typeof client.buildings.destroy).toBe("function");
    expect(typeof client.buildings.pauseProduction).toBe("function");
    expect(typeof client.buildings.resumeProduction).toBe("function");
  });

  it("bank group has expected methods", () => {
    expect(typeof client.bank.buy).toBe("function");
    expect(typeof client.bank.sell).toBe("function");
    expect(typeof client.bank.addLiquidity).toBe("function");
    expect(typeof client.bank.removeLiquidity).toBe("function");
  });

  it("hyperstructure group has expected methods", () => {
    expect(typeof client.hyperstructure.initialize).toBe("function");
    expect(typeof client.hyperstructure.contribute).toBe("function");
    expect(typeof client.hyperstructure.allocateShares).toBe("function");
    expect(typeof client.hyperstructure.setAccess).toBe("function");
  });

  it("guild group has expected methods", () => {
    expect(typeof client.guild.create).toBe("function");
    expect(typeof client.guild.join).toBe("function");
    expect(typeof client.guild.leave).toBe("function");
    expect(typeof client.guild.updateWhitelist).toBe("function");
    expect(typeof client.guild.removeMember).toBe("function");
    expect(typeof client.guild.disband).toBe("function");
  });

  it("realm group has expected methods", () => {
    expect(typeof client.realm.upgrade).toBe("function");
    expect(typeof client.realm.createVillage).toBe("function");
    expect(typeof client.realm.setName).toBe("function");
    expect(typeof client.realm.setPlayerName).toBe("function");
    expect(typeof client.realm.transferOwnership).toBe("function");
  });
});
