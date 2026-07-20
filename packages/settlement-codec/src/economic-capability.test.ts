import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  getEconomicCapabilitiesForCaller,
  getEconomicCapabilityOperation,
  getEconomicCapabilityRegistry,
} from "./economic-capability";

const inventoryUrl = new URL("../schema/economic-write-inventory-v0.json", import.meta.url);
const exactInterfaceSchemaUrl = new URL("../schema/economic-interface-schema-v1.json", import.meta.url);
const frozenInterfaceUrl = new URL(
  "../../../contracts/settlement_protocol/src/economic_interfaces.cairo",
  import.meta.url,
);
const dispatcherConformanceUrl = new URL(
  "../../../contracts/settlement_integration_tests/src/generated_dispatcher_conformance.cairo",
  import.meta.url,
);
const protocolInterfacesUrl = new URL("../../../contracts/settlement_protocol/src/interfaces.cairo", import.meta.url);
const protocolSchemaUrl = new URL("../schema/schema-registry-v1.json", import.meta.url);

describe("A14 frozen economic capability interface", () => {
  test("publishes a complete semantic ABI and capability matrix", () => {
    const registry = getEconomicCapabilityRegistry();
    const requiredFamilies = [
      "resource",
      "structure_ownership",
      "lazy_production",
      "arrival",
      "military_and_cargo",
      "trade_and_donkey",
      "amm_and_lp",
      "reward_state",
      "pending_withdrawal",
      "active_exit_backing",
      "player_economic_lock",
      "exit_position",
    ];

    expect(registry.version).toBe(1);
    expect(registry.status).toBe("a14-frozen");
    expect(registry.families.map((family: Record<string, unknown>) => family.id)).toEqual(requiredFamilies);
    expect(new Set(registry.operations.map((operation: Record<string, unknown>) => operation.operationId)).size).toBe(
      registry.operations.length,
    );
    const familyIds = new Set(requiredFamilies);
    const frozenInterface = readFileSync(frozenInterfaceUrl, "utf8");
    const exactInterfaceSchema = readJson(exactInterfaceSchemaUrl);
    expect(frozenInterface).toContain("#[starknet::interface]");
    expect(frozenInterface).toContain("pub trait IEconomicStateSystem");
    expect(exactInterfaceSchema.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(exactInterfaceSchema.interface.methods.map(({ name }: { name: string }) => name)).toEqual([
      ...registry.families.map(({ method }) => method),
      "get_backing_total",
      "get_position_version",
      "is_player_economically_locked",
    ]);
    for (const family of registry.families) {
      expect(frozenInterface).toContain(`fn ${family.method}`);
      expect(frozenInterface).toMatch(new RegExp(`pub (?:struct|enum) ${family.requestType}\\b`));
    }
    for (const operation of registry.operations) {
      expect(operation.authorizedCallerClasses.length).toBeGreaterThan(0);
      expect(operation.resultType === "felt252" || /Result$/.test(operation.resultType)).toBe(true);
      if (operation.family === "settlement_callback") {
        expect(operation.requestType).toBeNull();
        expect(operation.interfaceTrait).toBe("IGameEconomicSettlementCallbacks");
      } else {
        expect(familyIds.has(operation.family)).toBe(true);
        expect(operation.requestType).toMatch(/Request$/);
        expect(frozenInterface).toMatch(new RegExp(`pub struct ${operation.requestType}\\b`));
      }
      expect(operation.affectedModels.length).toBeGreaterThan(0);
      expect(operation.backingEffect).toBeTruthy();
      expect(operation.indexEffect).toBeTruthy();
    }

    const dispatcherConformance = readFileSync(dispatcherConformanceUrl, "utf8");
    expect(dispatcherConformance).toContain("IEconomicStateSystemDispatcher");
    expect(dispatcherConformance).toContain("IGameEconomicSettlementCallbacksDispatcher");
    const protocolInterfaces = readFileSync(protocolInterfacesUrl, "utf8");
    expect(protocolInterfaces).toContain("#[starknet::interface]\npub trait IGameEconomicSettlementCallbacks");
    expect(frozenInterface).not.toContain("fn assign_open_batch");
    expect(frozenInterface).not.toContain("fn promote_sealed_batch");
  });

  test("resolves operation and caller authority through the public codec API", () => {
    expect(getEconomicCapabilityOperation(4109).name).toBe("assign_open_batch");
    expect(getEconomicCapabilitiesForCaller("SeasonSettlementHub").map((operation) => operation.operationId)).toEqual([
      4105, 4106, 4109,
    ]);
    expect(() => getEconomicCapabilityOperation(0)).toThrow("unregistered economic operation: 0");
  });

  test("freezes the Hub-owned A17 seal topology without a promotion callback", () => {
    const capabilityRegistry = getEconomicCapabilityRegistry();
    const protocolSchema = readJson(protocolSchemaUrl);
    const declarations = new Map(
      protocolSchema.declarations.map((declaration: { name: string }) => [declaration.name, declaration]),
    );
    const callbacks = declarations.get("IGameEconomicSettlementCallbacks");
    const aggregateView = declarations.get("ISeasonSettlementHubAggregateView");

    expect(callbacks.members).toEqual([
      "fn assign_open_batch( ref self: TContractState, liability_id: LiabilityId, batch_id: BatchId, leaf_index: u8, ) -> felt252",
      "fn get_liability_assignment( self: @TContractState, liability_id: LiabilityId, ) -> Option<(BatchId, u8)>",
    ]);
    expect(aggregateView.members).toEqual([
      "fn get_batch_seal_state( self: @TContractState, batch_id: BatchId, ) -> HubBatchSealState",
      "fn get_backing_aggregate( self: @TContractState, game_id: GameId, parent_key_hash: felt252, ) -> HubBackingAggregate",
      "fn get_lot_aggregate( self: @TContractState, game_id: GameId, parent_key_hash: felt252, lot_index: u8, ) -> HubLotAggregate",
      "fn get_game_aggregate_totals( self: @TContractState, game_id: GameId, ) -> (u256, u256)",
      "fn get_global_aggregate_totals( self: @TContractState, ) -> (u256, u256)",
    ]);
    expect(declarations.get("HubBatchSealState").members.map(({ name }: { name: string }) => name)).toEqual([
      "Unknown",
      "Open",
      "Sealed",
    ]);
    expect(declarations.get("HubBackingAggregate").members.map(({ name }: { name: string }) => name)).toEqual([
      "game_id",
      "parent_key_hash",
      "active_committed_total",
      "cumulative_outbox_total",
    ]);
    expect(declarations.get("HubLotAggregate").members.map(({ name }: { name: string }) => name)).toEqual([
      "game_id",
      "parent_key_hash",
      "lot_index",
      "active_committed_total",
      "cumulative_outbox_total",
    ]);
    expect(capabilityRegistry.operations.some(({ operationId }) => operationId === 4110)).toBe(false);
  });

  test("isolates the canonical registry from consumer mutations", () => {
    const registry = getEconomicCapabilityRegistry();
    const operation = getEconomicCapabilityOperation(4109);
    const callerOperations = getEconomicCapabilitiesForCaller("SeasonSettlementHub");

    (registry.families[0].actions as string[])[0] = "consumer-rewrite";
    operation.name = "consumer-rewrite";
    (callerOperations[0].affectedModels as string[])[0] = "consumer-rewrite";

    expect(getEconomicCapabilityRegistry().families[0].actions[0]).toBe("credit");
    expect(getEconomicCapabilityOperation(4109).name).toBe("assign_open_batch");
    expect(getEconomicCapabilitiesForCaller("SeasonSettlementHub")[0].affectedModels[0]).toBe("PendingLiability");
  });

  test("classifies every discovered non-test model/member write", () => {
    const inventory = readJson(inventoryUrl);
    const registry = getEconomicCapabilityRegistry();
    const classifications = new Set([
      ...registry.families.map((family: Record<string, unknown>) => family.id),
      "out_of_scope",
    ]);

    expect(inventory.entries.length).toBeGreaterThan(0);
    expect(inventory.entries.every((entry: Record<string, unknown>) => classifications.has(entry.classification))).toBe(
      true,
    );
    expect(inventory.entries.every((entry: Record<string, unknown>) => entry.reason)).toBe(true);
    expect(new Set(inventory.entries.map((entry: Record<string, unknown>) => entry.id)).size).toBe(
      inventory.entries.length,
    );
    expect(inventory.summary.unclassified).toBe(0);
    expect(inventory.summary.writes).toBe(inventory.entries.length);
    expect(inventory.summary.files).toBeGreaterThan(30);
  });
});

function readJson(url: URL): any {
  return JSON.parse(readFileSync(url, "utf8"));
}
