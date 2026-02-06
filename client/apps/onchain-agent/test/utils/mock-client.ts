import { vi } from "vitest";

/**
 * Creates a mock EternumClient with all view and transaction groups stubbed.
 * Every method is a vitest mock that resolves with realistic fake data by default.
 */
export function createMockClient() {
  const fakeTxResult = { transaction_hash: "0xabc123" };

  return {
    view: {
      player: vi.fn().mockResolvedValue({
        address: "0xdeadbeef",
        name: "TestPlayer",
        structures: [
          { entityId: 1, structureType: "realm", name: "Realm #1", position: { x: 10, y: 20 }, level: 2, resourceCount: 5, guardStrength: 100 },
        ],
        armies: [
          { entityId: 100, explorerId: 100, position: { x: 15, y: 25 }, strength: 50, stamina: 80, isInBattle: false, carriedResourceCount: 2 },
        ],
        totalResources: [
          { resourceId: 1, name: "Wood", totalBalance: 500 },
          { resourceId: 2, name: "Stone", totalBalance: 300 },
        ],
        points: 1200,
        rank: 5,
      }),
      mapArea: vi.fn().mockResolvedValue({
        center: { x: 0, y: 0 },
        radius: 100,
        tiles: [],
        structures: [
          { entityId: 1, structureType: "realm", position: { x: 10, y: 20 }, owner: "0xdeadbeef", name: "Realm #1", level: 2 },
          { entityId: 2, structureType: "bank", position: { x: 50, y: 60 }, owner: "0xother", name: "Bank #1", level: 1 },
        ],
        armies: [
          { entityId: 100, owner: "0xdeadbeef", position: { x: 15, y: 25 }, troops: [], strength: 50, stamina: 80, isInBattle: false },
        ],
        battles: [],
      }),
      market: vi.fn().mockResolvedValue({
        pools: [],
        recentSwaps: [{ eventId: 1 }, { eventId: 2 }],
        openOrders: [{ orderId: 1 }],
        playerLpPositions: [],
      }),
      leaderboard: vi.fn().mockResolvedValue({
        entries: [
          { address: "0xdeadbeef", name: "TestPlayer", points: 1200, rank: 1, realmCount: 3 },
          { address: "0xother", name: "Rival", points: 900, rank: 2, realmCount: 2 },
        ],
        totalPlayers: 50,
        lastUpdatedAt: 1700000000,
      }),
      realm: vi.fn().mockResolvedValue({ entityId: 1, name: "Realm #1" }),
      explorer: vi.fn().mockResolvedValue({ entityId: 100 }),
      hyperstructure: vi.fn().mockResolvedValue({ entityId: 200 }),
      bank: vi.fn().mockResolvedValue({ entityId: 300 }),
      events: vi.fn().mockResolvedValue({ events: [], totalCount: 0, hasMore: false }),
    },
    cache: {
      invalidateByPrefix: vi.fn(),
      clear: vi.fn(),
    },
    resources: {
      send: vi.fn().mockResolvedValue(fakeTxResult),
      pickup: vi.fn().mockResolvedValue(fakeTxResult),
      claimArrivals: vi.fn().mockResolvedValue(fakeTxResult),
    },
    troops: {
      createExplorer: vi.fn().mockResolvedValue(fakeTxResult),
      addToExplorer: vi.fn().mockResolvedValue(fakeTxResult),
      deleteExplorer: vi.fn().mockResolvedValue(fakeTxResult),
      addGuard: vi.fn().mockResolvedValue(fakeTxResult),
      deleteGuard: vi.fn().mockResolvedValue(fakeTxResult),
      move: vi.fn().mockResolvedValue(fakeTxResult),
      travel: vi.fn().mockResolvedValue(fakeTxResult),
      explore: vi.fn().mockResolvedValue(fakeTxResult),
    },
    combat: {
      attackExplorer: vi.fn().mockResolvedValue(fakeTxResult),
      attackGuard: vi.fn().mockResolvedValue(fakeTxResult),
      guardAttackExplorer: vi.fn().mockResolvedValue(fakeTxResult),
      raid: vi.fn().mockResolvedValue(fakeTxResult),
    },
    trade: {
      createOrder: vi.fn().mockResolvedValue(fakeTxResult),
      acceptOrder: vi.fn().mockResolvedValue(fakeTxResult),
      cancelOrder: vi.fn().mockResolvedValue(fakeTxResult),
    },
    buildings: {
      create: vi.fn().mockResolvedValue(fakeTxResult),
      destroy: vi.fn().mockResolvedValue(fakeTxResult),
      pauseProduction: vi.fn().mockResolvedValue(fakeTxResult),
      resumeProduction: vi.fn().mockResolvedValue(fakeTxResult),
    },
    bank: {
      buy: vi.fn().mockResolvedValue(fakeTxResult),
      sell: vi.fn().mockResolvedValue(fakeTxResult),
      addLiquidity: vi.fn().mockResolvedValue(fakeTxResult),
      removeLiquidity: vi.fn().mockResolvedValue(fakeTxResult),
    },
    guild: {
      create: vi.fn().mockResolvedValue(fakeTxResult),
      join: vi.fn().mockResolvedValue(fakeTxResult),
      leave: vi.fn().mockResolvedValue(fakeTxResult),
    },
    realm: {
      upgrade: vi.fn().mockResolvedValue(fakeTxResult),
      setName: vi.fn().mockResolvedValue(fakeTxResult),
    },
    hyperstructure: {
      contribute: vi.fn().mockResolvedValue(fakeTxResult),
      allocateShares: vi.fn().mockResolvedValue(fakeTxResult),
    },
  };
}

/**
 * A fake signer (Account) for testing purposes.
 */
export const mockSigner = { address: "0xdeadbeef" } as any;
