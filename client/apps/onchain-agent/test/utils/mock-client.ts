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
        tiles: [
          { position: { x: 10, y: 20 }, biome: "grassland", explored: true, occupiedBy: null },
          { position: { x: 11, y: 20 }, biome: "forest", explored: true, occupiedBy: null },
          { position: { x: 12, y: 20 }, biome: "unknown", explored: false, occupiedBy: null },
          { position: { x: 10, y: 21 }, biome: "unknown", explored: false, occupiedBy: null },
          { position: { x: 9, y: 20 }, biome: "ocean", explored: true, occupiedBy: null },
          { position: { x: 11, y: 21 }, biome: "desert", explored: true, occupiedBy: 42 },
        ],
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
      realm: vi.fn().mockResolvedValue({
        entityId: 1,
        name: "Realm #1",
        guard: {
          totalTroops: 30,
          slots: [
            { troopType: "Knight", count: 20, tier: 1, stamina: 50, staminaUpdatedTick: 1000, cooldownEnd: 0 },
            { troopType: "Paladin", count: 10, tier: 2, stamina: 30, staminaUpdatedTick: 1000, cooldownEnd: 9999999999 },
          ],
          strength: 500,
        },
        buildings: [
          { category: "Farm", position: { x: 1, y: 2 } },
          { category: "Barracks", position: { x: 3, y: 4 } },
        ],
        resources: [
          { resourceId: 1, name: "Wood", balance: 250 },
          { resourceId: 2, name: "Stone", balance: 150 },
        ],
      }),
      explorer: vi.fn().mockResolvedValue({
        entityId: 100,
        explorerId: 100,
        troops: {
          totalTroops: 15,
          slots: [{ troopType: "Crossbowman", count: 15, tier: 1 }],
          strength: 200,
        },
        carriedResources: [{ resourceId: 1, name: "Wood", amount: 50 }],
        stamina: 75,
        isInBattle: false,
      }),
      hyperstructure: vi.fn().mockResolvedValue({
        entityId: 200,
        position: { x: 100, y: 200 },
        owner: "0xother",
        progress: 45,
        isComplete: false,
      }),
      bank: vi.fn().mockResolvedValue({ entityId: 300, position: { x: 50, y: 60 } }),
      events: vi.fn().mockResolvedValue({
        events: [
          { eventId: 1, eventType: "battle_start", timestamp: 1700000000, data: { attackerId: 100 } },
        ],
        totalCount: 1,
        hasMore: false,
      }),
    },
    sql: {
      fetchResourceBalances: vi.fn().mockResolvedValue({
        WOOD_BALANCE: "0x00000000000000000000000000000fa0",
        STONE_BALANCE: "0x00000000000000000000000000000960",
        COAL_BALANCE: "0x00000000000000000000000000000000",
        entity_id: 1,
      }),
      fetchBuildingsByStructure: vi.fn().mockResolvedValue([
        { entity_id: 10, category: 37, paused: 0, inner_col: 10, inner_row: 10 },
        { entity_id: 11, category: 5, paused: 0, inner_col: 11, inner_row: 10 },
        { entity_id: 12, category: 28, paused: 1, inner_col: 12, inner_row: 10 },
      ]),
      // Bounded area queries (raw SQL format)
      fetchTilesInArea: vi.fn().mockResolvedValue([
        // col, row, biome (as numbers) — all are explored (TileOpt only stores explored tiles)
        { col: 10, row: 20, biome: 10, occupier_id: 0 },  // grassland
        { col: 11, row: 20, biome: 11, occupier_id: 0 },  // temperate_deciduous_forest
        { col: 9, row: 20, biome: 1, occupier_id: 0 },    // ocean
        { col: 11, row: 21, biome: 13, occupier_id: 42 },  // subtropical_desert
      ]),
      fetchStructuresInArea: vi.fn().mockResolvedValue([
        { entity_id: 1, coord_x: 10, coord_y: 20, structure_type: "realm", level: 2, owner_address: "0xdeadbeef", owner_name: "TestPlayer" },
        { entity_id: 2, coord_x: 50, coord_y: 60, structure_type: "bank", level: 1, owner_address: "0xother", owner_name: "Bank #1" },
      ]),
      fetchArmiesInArea: vi.fn().mockResolvedValue([
        { entity_id: 100, coord_x: 15, coord_y: 25, owner_address: "0xdeadbeef", category: "Knight", tier: 1, count: "0x32", stamina_amount: "0x50", owner_name: "TestPlayer" },
      ]),
      fetchWorldConfig: vi.fn().mockResolvedValue({
        "troop_stamina_config.stamina_explore_stamina_cost": 30,
        "troop_stamina_config.stamina_travel_stamina_cost": 20,
        "troop_stamina_config.stamina_gain_per_tick": 20,
        "troop_stamina_config.stamina_bonus_value": 10,
        "troop_stamina_config.stamina_knight_max": 120,
        "troop_stamina_config.stamina_paladin_max": 120,
        "troop_stamina_config.stamina_crossbowman_max": 120,
        "troop_stamina_config.stamina_attack_req": 50,
        "troop_stamina_config.stamina_defense_req": 40,
        "troop_stamina_config.stamina_explore_wheat_cost": 30000000,
        "troop_stamina_config.stamina_explore_fish_cost": 0,
        "troop_stamina_config.stamina_travel_wheat_cost": 30000000,
        "troop_stamina_config.stamina_travel_fish_cost": 0,
        "troop_damage_config.damage_biome_bonus_num": 3000,
        "structure_max_level_config.realm_max": 3,
        "building_config.base_cost_percent_increase": 1000,
        "building_config.base_population": 6,
        "tick_config.armies_tick_in_seconds": "0x000000000000003c",
      }),
      fetchStructureLevelConfig: vi.fn().mockResolvedValue([
        { level: 1, required_resource_count: 3, required_resources_id: 3 },
        { level: 2, required_resource_count: 4, required_resources_id: 4 },
        { level: 3, required_resource_count: 6, required_resources_id: 5 },
      ]),
      fetchResourceListByIds: vi.fn().mockResolvedValue([
        { entity_id: 3, index: 0, resource_type: 23, amount: "0x000000000000000000000029e8d60800" },
        { entity_id: 3, index: 1, resource_type: 35, amount: "0x0000000000000000000001176592e000" },
        { entity_id: 3, index: 2, resource_type: 38, amount: "0x00000000000000000000002e90edd000" },
      ]),
      fetchBuildingCategoryConfig: vi.fn().mockResolvedValue([
        { category: 1, population_cost: 0, capacity_grant: 6, simple_erection_cost_id: 9, simple_erection_cost_count: 1, complex_erection_cost_id: 8, complex_erection_cost_count: 2 },
        { category: 37, population_cost: 1, capacity_grant: 0, simple_erection_cost_id: 79, simple_erection_cost_count: 1, complex_erection_cost_id: 78, complex_erection_cost_count: 1 },
      ]),
      fetchBattleLogs: vi.fn().mockResolvedValue([
        { attacker_entity_id: 100, defender_entity_id: 200, winner: "attacker", timestamp: 1700000100, attacker_loss: 5, defender_loss: 12 },
      ]),
      fetchSwapEvents: vi.fn().mockResolvedValue([
        { resource_type: 3, resource_name: "Wood", lords_amount: 100, resource_amount: 50, is_buy: true, timestamp: 1700000200 },
      ]),
      fetchAllAmmPools: vi.fn().mockResolvedValue([
        { resource_type: 3, resource_name: "Wood", lords_reserve: 10000, resource_reserve: 5000, price: 2 },
      ]),
      fetchAllPlayerRelics: vi.fn().mockResolvedValue([
        { relic_id: 1, entity_id: 100, bonus_type: "attack_bonus", is_attached: true },
      ]),
      fetchChestsNearPosition: vi.fn().mockResolvedValue([
        { coord_x: 12, coord_y: 22 },
        { coord_x: 14, coord_y: 18 },
      ]),
      fetchResourceFactoryConfig: vi.fn().mockResolvedValue([
        { resource_type: 1, realm_output_per_second: "0x000000003b9aca00", village_output_per_second: "0x000000001dcd6500", simple_input_list_count: 0, complex_input_list_count: 0 },
        { resource_type: 3, realm_output_per_second: "0x000000003b9aca00", village_output_per_second: "0x000000001dcd6500", simple_input_list_count: 2, complex_input_list_count: 3 },
      ]),
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
      swapExplorerToExplorer: vi.fn().mockResolvedValue(fakeTxResult),
      swapExplorerToGuard: vi.fn().mockResolvedValue(fakeTxResult),
      swapGuardToExplorer: vi.fn().mockResolvedValue(fakeTxResult),
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
      updateWhitelist: vi.fn().mockResolvedValue(fakeTxResult),
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
