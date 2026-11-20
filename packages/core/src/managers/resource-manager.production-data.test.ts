import { ResourcesIds } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import preset from "../../../../contracts/l3/world-native/tests/fixtures/current-presets/conformance.json";
import { NativeFactStore } from "../client/native-fact-store";
import { ResourceManager } from "./resource-manager";

const RATE = 1_000_000n; // rate in resource precision per second

function productionManager(resourceId: ResourcesIds, outputAmountLeft: bigint) {
  const store = new NativeFactStore();
  store.setSnapshot({ gameId: 1, complete: true, actor: null, timestamp: 100 });
  store.applyFacts([
    { model: "SliceRules", key: "0xd000", value: { ...preset.rules, game_id: 1, mode_rules: 0 } },
    {
      model: "ResourceWeight",
      key: "0xd001",
      value: { game_id: 1, entity_id: 7, capacity: (1n << 128n) - 1n, weight: 0 },
    },
    {
      model: "ResourceProduction",
      key: "0xd002",
      value: {
        game_id: 1,
        entity_id: 7,
        resource_type: resourceId,
        building_count: 2,
        production_rate: RATE,
        output_amount_left: outputAmountLeft,
        last_settled_at: 100,
        remainder: 0,
      },
    },
  ]);
  return new ResourceManager(store, 7, 1);
}

describe("ResourceManager.productionData", () => {
  it("reports no time remaining for continuous production, however little output is banked", () => {
    const data = productionManager(ResourcesIds.Wheat, RATE).productionData(ResourcesIds.Wheat, 100)!;
    expect(data.isProducing).toBe(true);
    expect(data.timeRemainingSeconds).toBe(Number.POSITIVE_INFINITY);
  });

  it("keeps the banked-output countdown for input-fed production", () => {
    const data = productionManager(ResourcesIds.Wood, RATE * 60n).productionData(ResourcesIds.Wood, 100)!;
    expect(data.isProducing).toBe(true);
    expect(data.timeRemainingSeconds).toBe(60);
  });

  it("reads the u128::MAX output budget as unlimited, never as an amount or a duration", () => {
    const unlimited = (1n << 128n) - 1n;
    // A marker settlements wore down before the contract stopped wearing it reads as unlimited too, as it does there.
    for (const budget of [unlimited, unlimited - 1_000_000n, unlimited - (1n << 64n)]) {
      const data = productionManager(ResourcesIds.Knight, budget).productionData(ResourcesIds.Knight, 5_000)!;
      expect(data.isProducing).toBe(true);
      expect(data.outputRemaining).toBe(Number.POSITIVE_INFINITY);
      expect(data.timeRemainingSeconds).toBe(Number.POSITIVE_INFINITY);
    }
    const limited = productionManager(ResourcesIds.Knight, unlimited - (1n << 64n) - 1n).productionData(
      ResourcesIds.Knight,
      5_000,
    )!;
    expect(limited.outputRemaining).toBeLessThan(Number.POSITIVE_INFINITY);
  });

  it("counts exact seconds to exhaustion and rounds a partial last second up", () => {
    const manager = productionManager(ResourcesIds.Wood, RATE * 360n + 1n);
    const data = manager.productionData(ResourcesIds.Wood, 250)!;
    expect(data.timeRemainingSeconds).toBe(211);
    expect(data.productionPerSecond).toBe(Number(RATE) / 1e9);
    expect(data.outputRemaining).toBe(Number(RATE * 210n + 1n) / 1e9);
    expect(manager.productionData(ResourcesIds.Wood, 461)).toMatchObject({
      isProducing: false,
      outputRemaining: 0,
      timeRemainingSeconds: 0,
    });
  });
});
