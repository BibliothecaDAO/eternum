import { describe, expect, it, vi } from "vitest";
import { CallData, shortString, type Abi, type AccountInterface, type Call } from "starknet";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import { EternumProvider } from "./index";
import { createSystemCalls } from "@bibliothecadao/types";

function setup() {
  const provider = new EternumProvider(
    {
      native: { version: 1, domains: { bridge: { address: "0xb1" } } },
      world: { address: "0x77" },
      contracts: [],
    } as any,
    "http://127.0.0.1:1",
    undefined,
    { gameId: 7 },
  );
  provider.setNativeSubmission(vi.fn(), bindings.commandAbi as Abi, () => 9);
  const enqueue = vi
    .spyOn(provider.promiseQueue, "enqueue")
    .mockResolvedValue({ transaction_hash: "0x55", batch_remaining: "0" } as any);
  const signer = {
    address: "0x123",
    execute: vi.fn().mockResolvedValue({ transaction_hash: "0x44" }),
  } as unknown as AccountInterface;
  const wait = vi.spyOn(provider.provider, "waitForTransaction").mockResolvedValue({ isReverted: () => false } as any);
  const abi = [
    ...bindings.commandAbi,
    {
      type: "function",
      name: "decode_command",
      inputs: [],
      outputs: [{ name: "command", type: "world_native::commands::Command" }],
      state_mutability: "view",
    },
  ];
  const decoded = () => {
    const call = enqueue.mock.calls.at(-1)![0].calls as Call;
    expect(call.contractAddress).toBe("0x77");
    expect(call.calldata?.[0]).toBe("7");
    const value = new CallData(abi as Abi).parse("decode_command", (call.calldata as string[]).slice(1)) as any;
    expect(value.command.activeVariant()).toBe(call.entrypoint);
    return value.command.unwrap();
  };
  return { provider, calls: createSystemCalls({ provider }), enqueue, signer, wait, decoded };
}
describe("player command callers", () => {
  it("preserves exact contribution units through the compiled command ABI", async () => {
    const { calls, signer, decoded } = setup();
    const amount = 9_007_199_254_740_993n;
    await calls.contribute_to_construction({
      signer,
      hyperstructure_entity_id: 9,
      contributor_entity_id: 4,
      contributions: [{ resource: 1, amount }],
    });
    expect(decoded()).toEqual({
      hyperstructure_id: 9n,
      from_structure_id: 4n,
      resources: [{ resource_type: 1n, amount }],
    });
  });

  const cases = [
    ["claim_wonder_points", { value: 11 }, "ClaimWonderPoints", 11n],
    [
      "claim_player_faith_points",
      { value: { player: "0x123", wonder_id: 11 } },
      "ClaimPlayerFaithPoints",
      { player: 0x123n, wonder_id: 11n },
    ],
    ["receive_army_grant", { village_id: 12 }, "ReceiveVillageArmy", 12n],
    [
      "set_entity_name",
      { entity_id: 12, name: "Scouts" },
      "SetEntityName",
      { entity_id: 12n, name: BigInt(shortString.encodeShortString("Scouts")) },
    ],
    [
      "create_guild",
      { guild_name: "Guild", is_public: true },
      "CreateGuild",
      { owned_structure_id: 9n, public: true, name: BigInt(shortString.encodeShortString("Guild")) },
    ],
  ] as const;
  it.each(cases)("routes %s with named ABI fields", async (method, props, kind, expected) => {
    const { calls, enqueue, signer, decoded } = setup();
    await (calls[method] as Function)({ ...props, signer });
    expect((enqueue.mock.calls[0][0].calls as Call).entrypoint).toBe(kind);
    expect(decoded()).toEqual(expected);
  });
  it("approves the native bridge before submitting a deposit", async () => {
    const { calls, signer, enqueue, wait, decoded } = setup();
    const amount = (1n << 180n) + 3n;
    await calls.bridge_deposit_into_realm({
      signer,
      recipient_structure_id: 9,
      client_fee_recipient: 0,
      resources: [{ resource_type: 2, tokenAddress: "0xaa", amount }],
    });
    expect(signer.execute).toHaveBeenCalledWith({
      contractAddress: "0xaa",
      entrypoint: "approve",
      calldata: CallData.compile({ spender: "0xb1", amount: { low: 3n, high: 1n << 52n } }),
    });
    expect(wait.mock.invocationCallOrder[0]).toBeLessThan(enqueue.mock.invocationCallOrder[0]);
    expect(decoded()).toEqual({ structure_id: 9n, resource_type: 2n, amount, client_fee_recipient: 0n });
  });
  it("submits a withdrawal without a token approval", async () => {
    const { calls, signer, decoded } = setup();
    await calls.bridge_withdraw_from_realm({
      signer,
      from_structure_id: 9,
      recipient_address: "0x456",
      client_fee_recipient: 0,
      resources: [{ resource_type: 2, tokenAddress: "0xaa", amount: 100n }],
    });
    expect(signer.execute).not.toHaveBeenCalled();
    expect(decoded()).toEqual({
      structure_id: 9n,
      resource_type: 2n,
      amount: 100n,
      recipient: 0x456n,
      client_fee_recipient: 0n,
    });
  });
});

const commandCases = [
  [
    "send_resources_multiple",
    { calls: [{ sender_entity_id: 1, recipient_entity_id: 2, resources: [3, 4] }] },
    ["SendResources"],
  ],
  ["arrivals_offload", { structureId: 1, day: 2, slot: 3, resource_count: 1 }, ["OffloadArrival"]],
  ["remove_liquidity", { bank_entity_id: 1, entity_id: 2, resource_type: 3, shares: 4 }, ["RemoveBankLiquidity"]],
  [
    "add_liquidity",
    { bank_entity_id: 1, entity_id: 2, calls: [{ resource_type: 3, resource_amount: 4, lords_amount: 5 }] },
    ["AddBankLiquidity"],
  ],
  ["sell_resources", { bank_entity_id: 1, entity_id: 2, resource_type: 3, amount: 4 }, ["SellToBank"]],
  ["buy_resources", { bank_entity_id: 1, entity_id: 2, resource_type: 3, amount: 4 }, ["BuyFromBank"]],
  ["bitcoin_mine_contribute_labor", { structure_id: 1, labor_amount: 2 }, ["ContributeBitcoinLabor"]],
  ["bitcoin_mine_claim_phase_reward", { phase_id: 1, mine_ids: [2] }, ["ClaimBitcoinPhase"]],
  ["bitcoin_mine_close_phase", { phase_id: 1 }, ["CloseBitcoinPhase"]],
  ["bitcoin_mine_bind_phase", { phase_id: 1 }, ["BindBitcoinPhase"]],
  [
    "create_order",
    {
      maker_id: 1,
      taker_id: 2,
      maker_gives_resource_type: 3,
      taker_pays_resource_type: 4,
      maker_gives_min_resource_amount: 5,
      taker_pays_min_resource_amount: 6,
      maker_gives_max_count: 7,
      expires_at: 8,
    },
    ["CreateTradeOrder"],
  ],
  ["accept_order", { trade_id: 1, taker_id: 2, taker_buys_count: 3 }, ["AcceptTradeOrder"]],
  ["cancel_order", { trade_id: 1 }, ["CancelTradeOrder"]],
  ["upgrade_realm", { realm_entity_id: 1 }, ["LevelUp"]],
  ["provision_realm", { realm_entity_id: 1 }, ["ProvisionRealm"]],
  ["create_hyperstructure", { x: 1, y: 2, alt: false }, ["CreateReservedHyperstructure"]],
  ["destroy_building", { entity_id: 1, building_coord: { x: 2, y: 3, alt: false } }, ["DestroyBuilding"]],
  ["pause_production", { entity_id: 1, building_coord: { x: 2, y: 3, alt: false } }, ["PauseBuildingProduction"]],
  ["resume_production", { entity_id: 1, building_coord: { x: 2, y: 3, alt: false } }, ["ResumeBuildingProduction"]],
  [
    "execute_realm_production_plan",
    { realm_entity_id: 1, resource_to_resource: [{ resource_id: 2, cycles: 3 }] },
    ["BurnResourceForResourceProduction"],
  ],
  ["create_building", { entity_id: 1, directions: [0], building_category: 2, use_simple: false }, ["CreateBuilding"]],
  ["pledge_faith", { structure_id: 1, wonder_id: 2 }, ["PledgeFaith"]],
  ["remove_faith", { structure_id: 1 }, ["RemoveFaith"]],
  ["update_wonder_ownership", { wonder_id: 1 }, ["UpdateWonderOwnership"]],
  ["update_structure_ownership", { structure_id: 1 }, ["UpdateFaithfulOwnership"]],
  ["initialize_hyperstructure", { hyperstructure_id: 1 }, ["InitializeHyperstructure"]],
  ["allocate_shares", { hyperstructure_entity_id: 1, co_owners: [[2, 10000]] }, ["AllocateHyperstructureShares"]],
  [
    "contribute_to_construction",
    { hyperstructure_entity_id: 1, contributor_entity_id: 2, contributions: [{ resource: 3, amount: 4 }] },
    ["ContributeHyperstructure"],
  ],
  ["set_access", { hyperstructure_entity_id: 1, access: 0 }, ["SetConstructionAccess"]],
  ["end_game", {}, ["CloseSeason"]],
  ["join_guild", { guild_entity_id: 1 }, ["JoinGuild"]],
  ["update_whitelist", { address: "0x123", whitelist: true }, ["SetGuildWhitelist"]],
  ["remove_guild_member", { player_address_to_remove: "0x123" }, ["RemoveGuildMember"]],
  ["disband_guild", { calls: [{ address: "0x123" }] }, ["RemoveGuildMember"]],
  ["settle_season", { name: "Realm" }, ["SettleSeason"]],
  ["settle_village", { passId: 1, connectedRealmEntityId: 2 }, ["SettleVillage"]],
  [
    "burn_resource_for_labor_production",
    { entity_id: 1, resource_types: [2], resource_amounts: [3] },
    ["BurnResourceForLaborProduction"],
  ],
  [
    "burn_labor_for_resource_production",
    { from_entity_id: 1, produced_resource_types: [2], production_cycles: [3] },
    ["BurnLaborForResourceProduction"],
  ],
  [
    "burn_resource_for_resource_production",
    { from_entity_id: 1, produced_resource_types: [2], production_cycles: [3] },
    ["BurnResourceForResourceProduction"],
  ],
  ["guard_add", { for_structure_id: 1, slot: 0, category: 0, tier: 0, amount: 10 }, ["ManageTroops"]],
  ["guard_delete", { for_structure_id: 1, slot: 0 }, ["ManageTroops"]],
  [
    "explorer_create",
    { for_structure_id: 1, category: 0, tier: 0, amount: 10, spawn_direction: 0 },
    ["CreateExplorer"],
  ],
  ["explorer_add", { to_explorer_id: 1, amount: 10 }, ["ManageTroops"]],
  ["explorer_delete", { explorer_id: 1 }, ["ManageTroops"]],
  ["explorer_explorer_swap", { from_explorer_id: 1, to_explorer_id: 2, count: 10 }, ["ManageTroops"]],
  ["explorer_guard_swap", { from_explorer_id: 1, to_structure_id: 2, to_guard_slot: 0, count: 10 }, ["ManageTroops"]],
  ["guard_explorer_swap", { from_structure_id: 1, from_guard_slot: 0, to_explorer_id: 2, count: 10 }, ["ManageTroops"]],
  ["toggle_alternate", { explorer_id: 1, spire_direction: 0 }, ["ToggleAlternate"]],
  ["explorer_travel", { explorer_id: 1, directions: [0, 1] }, ["Move"]],
  ["explorer_explore", { explorer_id: 1, directions: [0] }, ["Explore"]],
  ["attack_explorer_vs_explorer", { aggressor_id: 1, defender_id: 2, steal_resources: [] }, ["Battle"]],
  ["attack_explorer_vs_guard", { explorer_id: 1, structure_id: 2 }, ["BattleGuard"]],
  [
    "attack_explorer_vs_guard_and_garrison",
    { explorer_id: 1, structure_id: 2, to_guard_slot: 0, count: 10 },
    ["BattleGuard", "ManageTroops"],
  ],
  ["attack_guard_vs_explorer", { structure_id: 1, structure_guard_slot: 0, explorer_id: 2 }, ["GuardAttack"]],
  ["raid_explorer_vs_guard", { explorer_id: 1, structure_id: 2, steal_resources: [] }, ["Raid"]],
  [
    "troop_troop_adjacent_transfer",
    { from_troop_id: 1, to_troop_id: 2, resources: [{ resourceId: 3, amount: 4 }] },
    ["TransferExplorerResources"],
  ],
  [
    "troop_structure_adjacent_transfer",
    { from_explorer_id: 1, to_structure_id: 2, resources: [{ resourceId: 3, amount: 4 }] },
    ["TransferExplorerResourcesToStructure"],
  ],
  [
    "structure_troop_adjacent_transfer",
    { from_structure_id: 1, to_troop_id: 2, resources: [{ resourceId: 3, amount: 4 }] },
    ["TransferStructureResourcesToExplorer"],
  ],
  ["leave_guild", {}, ["LeaveGuild"]],
  ["transfer_structure_ownership", { structure_id: 1, new_owner: "0x123" }, ["TransferStructureOwnership"]],
  ["structure_burn", { structure_id: 1, resources: [{ resourceId: 2, amount: 3 }] }, ["BurnStructureResources"]],
  ["troop_burn", { explorer_id: 1, resources: [{ resourceId: 2, amount: 3 }] }, ["BurnExplorerResources"]],
  ["open_chest", { explorer_id: 1, chest_coord: { x: 2, y: 3, alt: false } }, ["OpenRelicChest"]],
  ["burn_research_for_relic", { structure_id: 1 }, ["CraftRelic"]],
  ["apply_relic", { entity_id: 1, relic_resource_id: 2, recipient_type: 0 }, ["ApplyRelic"]],
] as const;
it.each(commandCases)("maps %s to compiled command variants", async (method, props, kinds) => {
  const { calls, signer, enqueue, decoded } = setup();
  await (calls[method] as Function)({ ...props, signer });
  expect(enqueue.mock.calls.map(([queued]) => (queued.calls as Call).entrypoint)).toEqual(kinds);
  decoded();
});
it("covers every public player action", () => {
  const covered = [
    ...commandCases.map(([name]) => name),
    "claim_wonder_points",
    "claim_player_faith_points",
    "receive_army_grant",
    "set_entity_name",
    "create_guild",
    "bridge_deposit_into_realm",
    "bridge_withdraw_from_realm",
  ];
  expect(new Set(covered).size).toBe(covered.length);
  expect([...covered].sort()).toEqual(Object.keys(setup().calls).sort());
});
