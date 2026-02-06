import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@bibliothecadao/torii", () => ({
  SqlApi: vi.fn().mockImplementation(() => ({
    fetchPlayerStructures: vi.fn().mockResolvedValue([]),
    fetchGuardsByStructure: vi.fn().mockResolvedValue([]),
    fetchAllArmiesMapData: vi.fn().mockResolvedValue([]),
    fetchAllStructuresMapData: vi.fn().mockResolvedValue([]),
    fetchAllTiles: vi.fn().mockResolvedValue([]),
    fetchBattleLogs: vi.fn().mockResolvedValue([]),
    fetchHyperstructures: vi.fn().mockResolvedValue([]),
    fetchSwapEvents: vi.fn().mockResolvedValue([]),
    fetchPlayerLeaderboard: vi.fn().mockResolvedValue([]),
    fetchStoryEvents: vi.fn().mockResolvedValue([]),
    fetchStoryEventsByEntity: vi.fn().mockResolvedValue([]),
    fetchStoryEventsByOwner: vi.fn().mockResolvedValue([]),
    fetchStoryEventsCount: vi.fn().mockResolvedValue(0),
    fetchStructuresByOwner: vi.fn().mockResolvedValue([]),
    fetchExplorerAddressOwner: vi.fn().mockResolvedValue(null),
  })),
}));

vi.mock("@bibliothecadao/provider", () => ({
  EternumProvider: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    send_resources: vi.fn(),
  })),
}));

import { EternumClient } from "../src/client";
import { ViewClient } from "../src/views";
import { ViewCache } from "../src/cache";
import { ResourceTransactions } from "../src/transactions/resources";
import { TroopTransactions } from "../src/transactions/troops";
import { CombatTransactions } from "../src/transactions/combat";
import { TradeTransactions } from "../src/transactions/trade";
import { BuildingTransactions } from "../src/transactions/buildings";
import { BankTransactions } from "../src/transactions/bank";
import { HyperstructureTransactions } from "../src/transactions/hyperstructure";
import { GuildTransactions } from "../src/transactions/guild";
import { RealmTransactions } from "../src/transactions/realm";

const mockConfig = {
  rpcUrl: "http://localhost:5050",
  toriiUrl: "http://localhost:8080",
  worldAddress: "0x123",
  manifest: { contracts: [], world: { address: "0x123" } },
  cacheUrl: "http://localhost:3000",
  cacheTtlMs: 5000,
  vrfProviderAddress: "0xVRF",
};

describe("EternumClient", () => {
  it("creates a client via static factory method", async () => {
    const client = await EternumClient.create(mockConfig);

    expect(client).toBeInstanceOf(EternumClient);
  });

  it("is not connected initially", async () => {
    const client = await EternumClient.create(mockConfig);

    expect(client.isConnected).toBe(false);
  });

  it("connects an account", async () => {
    const client = await EternumClient.create(mockConfig);
    const mockAccount = { address: "0xAccountAddress" } as any;

    client.connect(mockAccount);

    expect(client.isConnected).toBe(true);
  });

  it("disconnects an account", async () => {
    const client = await EternumClient.create(mockConfig);
    const mockAccount = { address: "0xAccountAddress" } as any;

    client.connect(mockAccount);
    expect(client.isConnected).toBe(true);

    client.disconnect();
    expect(client.isConnected).toBe(false);
  });

  it("exposes view client", async () => {
    const client = await EternumClient.create(mockConfig);

    expect(client.view).toBeInstanceOf(ViewClient);
  });

  it("exposes cache", async () => {
    const client = await EternumClient.create(mockConfig);

    expect(client.cache).toBeInstanceOf(ViewCache);
  });

  it("exposes provider", async () => {
    const client = await EternumClient.create(mockConfig);

    expect(client.provider).toBeDefined();
  });

  it("exposes sql", async () => {
    const client = await EternumClient.create(mockConfig);

    expect(client.sql).toBeDefined();
  });

  describe("transaction groups", () => {
    it("exposes resources transactions", async () => {
      const client = await EternumClient.create(mockConfig);

      expect(client.resources).toBeInstanceOf(ResourceTransactions);
    });

    it("exposes troops transactions", async () => {
      const client = await EternumClient.create(mockConfig);

      expect(client.troops).toBeInstanceOf(TroopTransactions);
    });

    it("exposes combat transactions", async () => {
      const client = await EternumClient.create(mockConfig);

      expect(client.combat).toBeInstanceOf(CombatTransactions);
    });

    it("exposes trade transactions", async () => {
      const client = await EternumClient.create(mockConfig);

      expect(client.trade).toBeInstanceOf(TradeTransactions);
    });

    it("exposes buildings transactions", async () => {
      const client = await EternumClient.create(mockConfig);

      expect(client.buildings).toBeInstanceOf(BuildingTransactions);
    });

    it("exposes bank transactions", async () => {
      const client = await EternumClient.create(mockConfig);

      expect(client.bank).toBeInstanceOf(BankTransactions);
    });

    it("exposes hyperstructure transactions", async () => {
      const client = await EternumClient.create(mockConfig);

      expect(client.hyperstructure).toBeInstanceOf(HyperstructureTransactions);
    });

    it("exposes guild transactions", async () => {
      const client = await EternumClient.create(mockConfig);

      expect(client.guild).toBeInstanceOf(GuildTransactions);
    });

    it("exposes realm transactions", async () => {
      const client = await EternumClient.create(mockConfig);

      expect(client.realm).toBeInstanceOf(RealmTransactions);
    });
  });

  describe("on/off event subscription", () => {
    it("returns an unsubscribe function", async () => {
      const client = await EternumClient.create(mockConfig);
      const callback = vi.fn();

      const unsubscribe = client.on("some-event", callback);

      expect(typeof unsubscribe).toBe("function");
    });

    it("calls provider.on when subscribing", async () => {
      const client = await EternumClient.create(mockConfig);
      const callback = vi.fn();

      client.on("some-event", callback);

      expect(client.provider.on).toHaveBeenCalledWith("some-event", callback);
    });

    it("calls provider.off when unsubscribing", async () => {
      const client = await EternumClient.create(mockConfig);
      const callback = vi.fn();

      const unsubscribe = client.on("some-event", callback);
      unsubscribe();

      expect(client.provider.off).toHaveBeenCalledWith("some-event", callback);
    });
  });

  describe("connect/disconnect lifecycle", () => {
    it("can reconnect after disconnect", async () => {
      const client = await EternumClient.create(mockConfig);
      const account1 = { address: "0xFirst" } as any;
      const account2 = { address: "0xSecond" } as any;

      client.connect(account1);
      expect(client.isConnected).toBe(true);

      client.disconnect();
      expect(client.isConnected).toBe(false);

      client.connect(account2);
      expect(client.isConnected).toBe(true);
    });

    it("handles disconnect when not connected", async () => {
      const client = await EternumClient.create(mockConfig);

      // Should not throw
      client.disconnect();
      expect(client.isConnected).toBe(false);
    });
  });
});
