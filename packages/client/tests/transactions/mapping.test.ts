import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResourceTransactions } from "../../src/transactions/resources";
import { TroopTransactions } from "../../src/transactions/troops";
import { CombatTransactions } from "../../src/transactions/combat";
import { TradeTransactions } from "../../src/transactions/trade";
import { BuildingTransactions } from "../../src/transactions/buildings";
import { BankTransactions } from "../../src/transactions/bank";
import { HyperstructureTransactions } from "../../src/transactions/hyperstructure";
import { GuildTransactions } from "../../src/transactions/guild";
import { RealmTransactions } from "../../src/transactions/realm";

const signer = { address: "0xabc" } as any;

function createProvider() {
  return {
    send_resources: vi.fn().mockResolvedValue({}),
    pickup_resources: vi.fn().mockResolvedValue({}),
    arrivals_offload: vi.fn().mockResolvedValue({}),

    explorer_create: vi.fn().mockResolvedValue({}),
    explorer_add: vi.fn().mockResolvedValue({}),
    explorer_delete: vi.fn().mockResolvedValue({}),
    guard_add: vi.fn().mockResolvedValue({}),
    guard_delete: vi.fn().mockResolvedValue({}),
    explorer_move: vi.fn().mockResolvedValue({}),
    explorer_travel: vi.fn().mockResolvedValue({}),
    explorer_explore: vi.fn().mockResolvedValue({}),
    explorer_explorer_swap: vi.fn().mockResolvedValue({}),
    explorer_guard_swap: vi.fn().mockResolvedValue({}),
    guard_explorer_swap: vi.fn().mockResolvedValue({}),

    attack_explorer_vs_explorer: vi.fn().mockResolvedValue({}),
    attack_explorer_vs_guard: vi.fn().mockResolvedValue({}),
    attack_guard_vs_explorer: vi.fn().mockResolvedValue({}),
    raid_explorer_vs_guard: vi.fn().mockResolvedValue({}),

    create_order: vi.fn().mockResolvedValue({}),
    accept_order: vi.fn().mockResolvedValue({}),
    cancel_order: vi.fn().mockResolvedValue({}),

    create_building: vi.fn().mockResolvedValue({}),
    destroy_building: vi.fn().mockResolvedValue({}),
    pause_production: vi.fn().mockResolvedValue({}),
    resume_production: vi.fn().mockResolvedValue({}),

    buy_resources: vi.fn().mockResolvedValue({}),
    sell_resources: vi.fn().mockResolvedValue({}),
    add_liquidity: vi.fn().mockResolvedValue({}),
    remove_liquidity: vi.fn().mockResolvedValue({}),

    initialize: vi.fn().mockResolvedValue({}),
    contribute_to_construction: vi.fn().mockResolvedValue({}),
    allocate_shares: vi.fn().mockResolvedValue({}),
    set_access: vi.fn().mockResolvedValue({}),

    create_guild: vi.fn().mockResolvedValue({}),
    join_guild: vi.fn().mockResolvedValue({}),
    leave_guild: vi.fn().mockResolvedValue({}),
    update_whitelist: vi.fn().mockResolvedValue({}),
    remove_guild_member: vi.fn().mockResolvedValue({}),
    disband_guild: vi.fn().mockResolvedValue({}),

    upgrade_realm: vi.fn().mockResolvedValue({}),
    create_village: vi.fn().mockResolvedValue({}),
    set_entity_name: vi.fn().mockResolvedValue({}),
    set_address_name: vi.fn().mockResolvedValue({}),
    transfer_structure_ownership: vi.fn().mockResolvedValue({}),
  };
}

describe("transaction payload mapping", () => {
  let provider: ReturnType<typeof createProvider>;

  beforeEach(() => {
    provider = createProvider();
  });

  it("maps resource transaction payloads", async () => {
    const tx = new ResourceTransactions(provider);

    await tx.send(signer, {
      senderEntityId: 1,
      recipientEntityId: 2,
      resources: [{ resourceType: 3, amount: 4 }],
    });

    expect(provider.send_resources).toHaveBeenCalledWith({
      signer,
      sender_entity_id: 1,
      recipient_entity_id: 2,
      resources: [{ resource: 3, amount: 4 }],
    });

    await tx.pickup(signer, {
      recipientEntityId: 5,
      ownerEntityId: 6,
      resources: [{ resourceType: 7, amount: 8 }],
    });

    expect(provider.pickup_resources).toHaveBeenCalledWith({
      signer,
      recipient_entity_id: 5,
      owner_entity_id: 6,
      resources: [{ resource: 7, amount: 8 }],
    });

    await tx.claimArrivals(signer, {
      structureId: 9,
      day: 10,
      slot: 11,
      resourceCount: 12,
    });

    expect(provider.arrivals_offload).toHaveBeenCalledWith({
      signer,
      structureId: 9,
      day: 10,
      slot: 11,
      resource_count: 12,
    });
  });

  it("maps troop transaction payloads", async () => {
    const tx = new TroopTransactions(provider);

    await tx.createExplorer(signer, {
      forStructureId: 1,
      category: 2,
      tier: 3,
      amount: 4,
      spawnDirection: 5,
    });
    expect(provider.explorer_create).toHaveBeenCalledWith({
      signer,
      for_structure_id: 1,
      category: 2,
      tier: 3,
      amount: 4,
      spawn_direction: 5,
    });

    await tx.addToExplorer(signer, { toExplorerId: 11, amount: 12, homeDirection: 13 });
    expect(provider.explorer_add).toHaveBeenCalledWith({
      signer,
      to_explorer_id: 11,
      amount: 12,
      home_direction: 13,
    });

    await tx.deleteExplorer(signer, { explorerId: 20 });
    expect(provider.explorer_delete).toHaveBeenCalledWith({ signer, explorer_id: 20 });

    await tx.addGuard(signer, { forStructureId: 21, slot: 0, category: 2, tier: 1, amount: 30 });
    expect(provider.guard_add).toHaveBeenCalledWith({
      signer,
      for_structure_id: 21,
      slot: 0,
      category: 2,
      tier: 1,
      amount: 30,
    });

    await tx.deleteGuard(signer, { forStructureId: 21, slot: 1 });
    expect(provider.guard_delete).toHaveBeenCalledWith({ signer, for_structure_id: 21, slot: 1 });

    await tx.move(signer, { explorerId: 31, directions: [1, 2], explore: true });
    expect(provider.explorer_move).toHaveBeenCalledWith({
      signer,
      explorer_id: 31,
      directions: [1, 2],
      explore: true,
    });

    await tx.travel(signer, { explorerId: 32, directions: [3, 4] });
    expect(provider.explorer_travel).toHaveBeenCalledWith({ signer, explorer_id: 32, directions: [3, 4] });

    await tx.explore(signer, { explorerId: 33, directions: [5] });
    expect(provider.explorer_explore).toHaveBeenCalledWith({ signer, explorer_id: 33, directions: [5] });

    await tx.swapExplorerToExplorer(signer, {
      fromExplorerId: 40,
      toExplorerId: 41,
      toExplorerDirection: 2,
      count: 50,
    });
    expect(provider.explorer_explorer_swap).toHaveBeenCalledWith({
      signer,
      from_explorer_id: 40,
      to_explorer_id: 41,
      to_explorer_direction: 2,
      count: 50,
    });

    await tx.swapExplorerToGuard(signer, {
      fromExplorerId: 42,
      toStructureId: 43,
      toStructureDirection: 4,
      toGuardSlot: 1,
      count: 60,
    });
    expect(provider.explorer_guard_swap).toHaveBeenCalledWith({
      signer,
      from_explorer_id: 42,
      to_structure_id: 43,
      to_structure_direction: 4,
      to_guard_slot: 1,
      count: 60,
    });

    await tx.swapGuardToExplorer(signer, {
      fromStructureId: 44,
      fromGuardSlot: 2,
      toExplorerId: 45,
      toExplorerDirection: 3,
      count: 70,
    });
    expect(provider.guard_explorer_swap).toHaveBeenCalledWith({
      signer,
      from_structure_id: 44,
      from_guard_slot: 2,
      to_explorer_id: 45,
      to_explorer_direction: 3,
      count: 70,
    });
  });

  it("maps combat transaction payloads", async () => {
    const tx = new CombatTransactions(provider);

    await tx.attackExplorer(signer, {
      aggressorId: 1,
      defenderId: 2,
      defenderDirection: 3,
      stealResources: [{ resourceId: 4, amount: 5 }],
    });
    expect(provider.attack_explorer_vs_explorer).toHaveBeenCalledWith({
      signer,
      aggressor_id: 1,
      defender_id: 2,
      defender_direction: 3,
      steal_resources: [{ resourceId: 4, amount: 5 }],
    });

    await tx.attackGuard(signer, { explorerId: 6, structureId: 7, structureDirection: 8 });
    expect(provider.attack_explorer_vs_guard).toHaveBeenCalledWith({
      signer,
      explorer_id: 6,
      structure_id: 7,
      structure_direction: 8,
    });

    await tx.guardAttackExplorer(signer, {
      structureId: 9,
      structureGuardSlot: 1,
      explorerId: 10,
      explorerDirection: 2,
    });
    expect(provider.attack_guard_vs_explorer).toHaveBeenCalledWith({
      signer,
      structure_id: 9,
      structure_guard_slot: 1,
      explorer_id: 10,
      explorer_direction: 2,
    });

    await tx.raid(signer, {
      explorerId: 11,
      structureId: 12,
      structureDirection: 5,
      stealResources: [{ resourceId: 13, amount: 14 }],
    });
    expect(provider.raid_explorer_vs_guard).toHaveBeenCalledWith({
      signer,
      explorer_id: 11,
      structure_id: 12,
      structure_direction: 5,
      steal_resources: [{ resourceId: 13, amount: 14 }],
    });
  });

  it("maps trade transaction payloads", async () => {
    const tx = new TradeTransactions(provider);

    await tx.createOrder(signer, {
      makerId: 1,
      takerId: 2,
      makerGivesResourceType: 3,
      takerPaysResourceType: 4,
      makerGivesMinResourceAmount: 5,
      makerGivesMaxCount: 6,
      takerPaysMinResourceAmount: 7,
      expiresAt: 8,
    });
    expect(provider.create_order).toHaveBeenCalledWith({
      signer,
      maker_id: 1,
      taker_id: 2,
      maker_gives_resource_type: 3,
      taker_pays_resource_type: 4,
      maker_gives_min_resource_amount: 5,
      maker_gives_max_count: 6,
      taker_pays_min_resource_amount: 7,
      expires_at: 8,
    });

    await tx.acceptOrder(signer, { takerId: 10, tradeId: 11, takerBuysCount: 12 });
    expect(provider.accept_order).toHaveBeenCalledWith({
      signer,
      taker_id: 10,
      trade_id: 11,
      taker_buys_count: 12,
    });

    await tx.cancelOrder(signer, { tradeId: 13 });
    expect(provider.cancel_order).toHaveBeenCalledWith({ signer, trade_id: 13 });
  });

  it("maps building transaction payloads", async () => {
    const tx = new BuildingTransactions(provider);

    await tx.create(signer, {
      entityId: 1,
      directions: [1, 2],
      buildingCategory: 3,
      useSimple: true,
    });
    expect(provider.create_building).toHaveBeenCalledWith({
      signer,
      entity_id: 1,
      directions: [1, 2],
      building_category: 3,
      use_simple: true,
    });

    const coord = { alt: true, x: 8, y: 9 };
    await tx.destroy(signer, { entityId: 4, buildingCoord: coord });
    expect(provider.destroy_building).toHaveBeenCalledWith({
      signer,
      entity_id: 4,
      building_coord: coord,
    });

    await tx.pauseProduction(signer, { entityId: 5, buildingCoord: coord });
    expect(provider.pause_production).toHaveBeenCalledWith({
      signer,
      entity_id: 5,
      building_coord: coord,
    });

    await tx.resumeProduction(signer, { entityId: 6, buildingCoord: coord });
    expect(provider.resume_production).toHaveBeenCalledWith({
      signer,
      entity_id: 6,
      building_coord: coord,
    });
  });

  it("maps bank transaction payloads", async () => {
    const tx = new BankTransactions(provider);

    await tx.buy(signer, { bankEntityId: 1, entityId: 2, resourceType: 3, amount: 4 });
    expect(provider.buy_resources).toHaveBeenCalledWith({
      signer,
      bank_entity_id: 1,
      entity_id: 2,
      resource_type: 3,
      amount: 4,
    });

    await tx.sell(signer, { bankEntityId: 5, entityId: 6, resourceType: 7, amount: 8 });
    expect(provider.sell_resources).toHaveBeenCalledWith({
      signer,
      bank_entity_id: 5,
      entity_id: 6,
      resource_type: 7,
      amount: 8,
    });

    await tx.addLiquidity(signer, {
      bankEntityId: 9,
      entityId: 10,
      calls: [{ resourceType: 1, resourceAmount: 2, lordsAmount: 3 }],
    });
    expect(provider.add_liquidity).toHaveBeenCalledWith({
      signer,
      bank_entity_id: 9,
      entity_id: 10,
      calls: [{ resource_type: 1, resource_amount: 2, lords_amount: 3 }],
    });

    await tx.removeLiquidity(signer, {
      bankEntityId: 11,
      entityId: 12,
      resourceType: 13,
      shares: 14,
    });
    expect(provider.remove_liquidity).toHaveBeenCalledWith({
      signer,
      bank_entity_id: 11,
      entity_id: 12,
      resource_type: 13,
      shares: 14,
    });
  });

  it("maps hyperstructure transaction payloads", async () => {
    const tx = new HyperstructureTransactions(provider);

    await tx.initialize(signer, { hyperstructureId: 1 });
    expect(provider.initialize).toHaveBeenCalledWith({ signer, hyperstructure_id: 1 });

    await tx.contribute(signer, {
      hyperstructureEntityId: 2,
      contributorEntityId: 3,
      contributions: [4, 5],
    });
    expect(provider.contribute_to_construction).toHaveBeenCalledWith({
      signer,
      hyperstructure_entity_id: 2,
      contributor_entity_id: 3,
      contributions: [4, 5],
    });

    await tx.allocateShares(signer, {
      hyperstructureEntityId: 6,
      coOwners: [
        [1, 50],
        [2, 50],
      ],
    });
    expect(provider.allocate_shares).toHaveBeenCalledWith({
      signer,
      hyperstructure_entity_id: 6,
      co_owners: [
        [1, 50],
        [2, 50],
      ],
    });

    await tx.setAccess(signer, { hyperstructureEntityId: 7, access: 2 });
    expect(provider.set_access).toHaveBeenCalledWith({
      signer,
      hyperstructure_entity_id: 7,
      access: 2,
    });
  });

  it("maps guild transaction payloads", async () => {
    const tx = new GuildTransactions(provider);

    await tx.create(signer, { isPublic: true, guildName: "Guild" });
    expect(provider.create_guild).toHaveBeenCalledWith({
      signer,
      is_public: true,
      guild_name: "Guild",
    });

    await tx.join(signer, { guildEntityId: 2 });
    expect(provider.join_guild).toHaveBeenCalledWith({ signer, guild_entity_id: 2 });

    await tx.leave(signer);
    expect(provider.leave_guild).toHaveBeenCalledWith({ signer });

    await tx.updateWhitelist(signer, { address: 3, whitelist: false });
    expect(provider.update_whitelist).toHaveBeenCalledWith({
      signer,
      address: 3,
      whitelist: false,
    });

    await tx.removeMember(signer, { playerAddressToRemove: 4 });
    expect(provider.remove_guild_member).toHaveBeenCalledWith({
      signer,
      player_address_to_remove: 4,
    });

    await tx.disband(signer, { calls: [{ address: 5 }] });
    expect(provider.disband_guild).toHaveBeenCalledWith({
      signer,
      calls: [{ address: 5 }],
    });
  });

  it("maps realm transaction payloads", async () => {
    const tx = new RealmTransactions(provider);

    await tx.upgrade(signer, { realmEntityId: 1 });
    expect(provider.upgrade_realm).toHaveBeenCalledWith({ signer, realm_entity_id: 1 });

    await tx.createVillage(signer, {
      villagePassTokenId: 2,
      connectedRealm: 3,
      direction: 4,
      villagePassAddress: "0xVillage",
    });
    expect(provider.create_village).toHaveBeenCalledWith({
      signer,
      village_pass_token_id: 2,
      connected_realm: 3,
      direction: 4,
      village_pass_address: "0xVillage",
    });

    await tx.setName(signer, { entityId: 5, name: 6 });
    expect(provider.set_entity_name).toHaveBeenCalledWith({
      signer,
      entity_id: 5,
      name: 6,
    });

    await tx.setPlayerName(signer, { name: 7 });
    expect(provider.set_address_name).toHaveBeenCalledWith({ signer, name: 7 });

    await tx.transferOwnership(signer, { structureId: 8, newOwner: "0xNew" });
    expect(provider.transfer_structure_ownership).toHaveBeenCalledWith({
      signer,
      structure_id: 8,
      new_owner: "0xNew",
    });
  });
});
