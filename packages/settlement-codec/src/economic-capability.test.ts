import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  getEconomicCapabilitiesForCaller,
  getEconomicCapabilityOperation,
  getEconomicCapabilityRegistry,
} from "./economic-capability";

const inventoryUrl = new URL("../schema/economic-write-inventory-v0.json", import.meta.url);
const candidateInterfaceUrl = new URL(
  "../../../contracts/settlement_protocol/src/economic_candidate.cairo",
  import.meta.url,
);

describe("A9 economic capability candidate", () => {
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
      "settlement_callback",
    ];

    expect(registry.version).toBe(0);
    expect(registry.families.map((family: Record<string, unknown>) => family.id)).toEqual(requiredFamilies);
    expect(new Set(registry.operations.map((operation: Record<string, unknown>) => operation.operationId)).size).toBe(
      registry.operations.length,
    );
    const familyIds = new Set(requiredFamilies);
    const candidateInterface = readFileSync(candidateInterfaceUrl, "utf8");
    for (const family of registry.families) {
      expect(candidateInterface).toContain(`fn ${family.method}`);
      expect(candidateInterface).toMatch(new RegExp(`pub (?:struct|enum) ${family.requestType}\\b`));
    }
    for (const operation of registry.operations) {
      expect(familyIds.has(operation.family)).toBe(true);
      expect(operation.authorizedCallerClasses.length).toBeGreaterThan(0);
      expect(operation.requestType).toMatch(/Request$/);
      expect(operation.resultType === "felt252" || /Result$/.test(operation.resultType)).toBe(true);
      expect(candidateInterface).toMatch(new RegExp(`pub struct ${operation.requestType}\\b`));
      expect(operation.affectedModels.length).toBeGreaterThan(0);
      expect(operation.backingEffect).toBeTruthy();
      expect(operation.indexEffect).toBeTruthy();
    }
  });

  test("resolves operation and caller authority through the public codec API", () => {
    expect(getEconomicCapabilityOperation(4109).name).toBe("assign_open_batch");
    expect(getEconomicCapabilitiesForCaller("SeasonSettlementHub").map((operation) => operation.operationId)).toEqual([
      4105, 4106, 4109, 4110,
    ]);
    expect(() => getEconomicCapabilityOperation(0)).toThrow("unregistered economic operation: 0");
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
