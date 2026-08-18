// @vitest-environment node

import {
  type ClientComponents,
  RESOURCE_PRECISION,
  ResourcesIds,
  createClientComponents,
  defineContractComponents,
} from "@bibliothecadao/types";
import { Type as RecsType, createWorld, getComponentValue, setComponent, type ComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setBlockTimestampSource, setChainTimestampEvidenceSink } from "../utils/timestamp";
import { ResourceManager } from "./resource-manager";

type ResourceValue = ComponentValue<ClientComponents["Resource"]["schema"]>;

afterEach(() => setBlockTimestampSource(null));

describe("ResourceManager provisional writes", () => {
  it("builds one overlay with baseline-delta evidence for every touched balance", () => {
    const components = createTestComponents();
    seedResource(components, 1, {
      STONE_BALANCE: precise(100),
      WOOD_BALANCE: precise(100),
    });
    const resourceManager = new ResourceManager(components, 1);

    const write = resourceManager.resolveProvisionalResourceWrite([
      { resourceId: ResourcesIds.Wood, amount: -25 },
      { resourceId: ResourcesIds.Stone, amount: -40 },
    ]);

    expect(write).toMatchObject({
      model: "Resource",
      baselineDeltaFields: ["WOOD_BALANCE", "STONE_BALANCE"],
      patch: { WOOD_BALANCE: precise(75), STONE_BALANCE: precise(60) },
    });
  });

  it("includes essence and relic balances in the same evidence path", () => {
    const components = createTestComponents();
    seedResource(components, 1, {
      ESSENCE_BALANCE: precise(100),
      RELIC_E1_BALANCE: precise(1),
    });
    const resourceManager = new ResourceManager(components, 1);

    const write = resourceManager.resolveProvisionalResourceWrite([
      { resourceId: ResourcesIds.Essence, amount: -25 },
      { resourceId: ResourcesIds.StaminaRelic1, amount: -1 },
    ]);

    expect(write).toMatchObject({
      baselineDeltaFields: ["ESSENCE_BALANCE", "RELIC_E1_BALANCE"],
      patch: { ESSENCE_BALANCE: precise(75), RELIC_E1_BALANCE: 0n },
    });
  });

  it("folds pending food accrual into the pin and resets the production clock", () => {
    const components = createTestComponents();
    seedResource(components, 1, {
      WHEAT_BALANCE: precise(5),
      WHEAT_PRODUCTION: production({ production_rate: RESOURCE_PRECISION, last_updated_at: 1000 }),
      weight: { capacity: storeCapacityGrams(1000), weight: 0n },
    });
    setBlockTimestampSource(() => 1100);

    const write = new ResourceManager(components, 1).resolveProvisionalResourceWrite([
      { resourceId: ResourcesIds.Wheat, amount: -60 },
    ]);

    // 100s of accrual at 1/s harvests into the pin; the spend must never sink it below zero.
    expect(write?.patch).toMatchObject({
      WHEAT_BALANCE: precise(5 + 100 - 60),
      WHEAT_PRODUCTION: production({ production_rate: RESOURCE_PRECISION, last_updated_at: 1100 }),
    });

    // The authoritative echo resets the production clock underneath the overlay;
    // the shallow-merged view must display the pinned prediction, never negative.
    const echoedRowUnderOverlay = { ...readResource(components, 1), ...write?.patch } as ResourceValue;
    const displayed = ResourceManager.balanceWithProduction(echoedRowUnderOverlay, 1100, ResourcesIds.Wheat);
    expect(displayed.balance).toBe(Number(precise(45)));
  });

  it("caps a non-continuous harvest at output_amount_left and decrements it in the pin", () => {
    const components = createTestComponents();
    seedResource(components, 1, {
      STONE_BALANCE: precise(10),
      STONE_PRODUCTION: production({
        production_rate: RESOURCE_PRECISION,
        output_amount_left: precise(30),
        last_updated_at: 1000,
      }),
      weight: { capacity: storeCapacityGrams(1000), weight: 0n },
    });
    setBlockTimestampSource(() => 1100);

    const write = new ResourceManager(components, 1).resolveProvisionalResourceWrite([
      { resourceId: ResourcesIds.Stone, amount: -20 },
    ]);

    expect(write?.patch).toMatchObject({
      STONE_BALANCE: precise(10 + 30 - 20),
      STONE_PRODUCTION: production({
        production_rate: RESOURCE_PRECISION,
        output_amount_left: 0n,
        last_updated_at: 1100,
      }),
    });
  });
});

describe("production extrapolation clamps", () => {
  afterEach(() => {
    setChainTimestampEvidenceSink(null);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("contributes zero production when last_updated_at is ahead of the current tick", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const components = createTestComponents();
    seedResource(components, 1, {
      WHEAT_BALANCE: precise(5),
      WHEAT_PRODUCTION: production({ production_rate: RESOURCE_PRECISION, last_updated_at: 2000 }),
      weight: { capacity: storeCapacityGrams(1000), weight: 0n },
    });

    const row = readResource(components, 1);
    expect(ResourceManager.balanceWithProduction(row, 1100, ResourcesIds.Wheat).balance).toBe(Number(precise(5)));
    expect(new ResourceManager(components, 1).balanceWithProduction(1100, ResourcesIds.Wheat).balance).toBe(
      Number(precise(5)),
    );
  });

  it("reports a row ahead of the clock as chain-time evidence so the clock can re-anchor", () => {
    const observed: number[] = [];
    setChainTimestampEvidenceSink((timestampSeconds) => observed.push(timestampSeconds));
    const components = createTestComponents();
    seedResource(components, 1, {
      WHEAT_BALANCE: precise(5),
      WHEAT_PRODUCTION: production({ production_rate: RESOURCE_PRECISION, last_updated_at: 1110 }),
      weight: { capacity: storeCapacityGrams(1000), weight: 0n },
    });

    ResourceManager.balanceWithProduction(readResource(components, 1), 1100, ResourcesIds.Wheat);

    expect(observed).toContain(1110);
  });

  it("warns loudly, with throttling, when the floor discards accrual beyond clock jitter", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const components = createTestComponents();
    seedResource(components, 1, {
      WHEAT_BALANCE: precise(5),
      WHEAT_PRODUCTION: production({ production_rate: RESOURCE_PRECISION, last_updated_at: 2000 }),
      weight: { capacity: storeCapacityGrams(1000), weight: 0n },
    });
    const row = readResource(components, 1);

    ResourceManager.balanceWithProduction(row, 1100, ResourcesIds.Wheat);
    ResourceManager.balanceWithProduction(row, 1100, ResourcesIds.Wheat);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("900s ahead of the client clock");
  });

  it("contributes zero production when the store is over capacity", () => {
    const components = createTestComponents();
    seedResource(components, 1, {
      STONE_BALANCE: precise(10),
      STONE_PRODUCTION: production({
        production_rate: RESOURCE_PRECISION,
        output_amount_left: precise(1000),
        last_updated_at: 1000,
      }),
      weight: { capacity: storeCapacityGrams(10), weight: storeCapacityGrams(20) },
    });

    const displayed = ResourceManager.balanceWithProduction(readResource(components, 1), 1100, ResourcesIds.Stone);
    expect(displayed.balance).toBe(Number(precise(10)));
    expect(displayed.hasReachedMaxCapacity).toBe(true);
  });
});

function createTestComponents() {
  const world = createWorld();
  return createClientComponents({ contractComponents: defineContractComponents(world) });
}

function seedResource(components: ClientComponents, entityId: number, overrides: Partial<ResourceValue>) {
  const entity = getEntityIdFromKeys([BigInt(entityId)]);
  const value = {
    ...createDefaultResourceValue(components),
    entity_id: entityId,
    weight: { capacity: 0n, weight: 0n },
    ...overrides,
  };

  setComponent(components.Resource, entity, value);
}

function createDefaultResourceValue(components: ClientComponents): ResourceValue {
  return createDefaultValue(components.Resource.schema) as ResourceValue;
}

function createDefaultValue(schema: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(schema).map(([key, value]) => [key, createDefaultSchemaValue(value)]));
}

function createDefaultSchemaValue(value: unknown): unknown {
  if (isNestedSchema(value)) return createDefaultValue(value);

  switch (value) {
    case RecsType.Boolean:
      return false;
    case RecsType.Number:
    case RecsType.OptionalNumber:
      return 0;
    case RecsType.BigInt:
    case RecsType.OptionalBigInt:
      return 0n;
    case RecsType.String:
    case RecsType.OptionalString:
      return "";
    case RecsType.NumberArray:
    case RecsType.OptionalNumberArray:
    case RecsType.BigIntArray:
    case RecsType.OptionalBigIntArray:
    case RecsType.StringArray:
    case RecsType.OptionalStringArray:
    case RecsType.EntityArray:
    case RecsType.OptionalEntityArray:
      return [];
    case RecsType.T:
    case RecsType.OptionalT:
      return null;
    default:
      return undefined;
  }
}

function isNestedSchema(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function precise(amount: number) {
  return BigInt(amount) * BigInt(RESOURCE_PRECISION);
}

function production(overrides: Record<string, unknown>) {
  return { building_count: 1, production_rate: 0, output_amount_left: 0n, last_updated_at: 0, ...overrides };
}

function storeCapacityGrams(kg: number) {
  return BigInt(kg) * 1000n * BigInt(RESOURCE_PRECISION);
}

function readResource(components: ClientComponents, entityId: number): ResourceValue {
  return getComponentValue(components.Resource, getEntityIdFromKeys([BigInt(entityId)]))!;
}
