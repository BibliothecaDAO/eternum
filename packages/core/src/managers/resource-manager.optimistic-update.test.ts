// @vitest-environment node

import {
  type ClientComponents,
  RESOURCE_PRECISION,
  ResourcesIds,
  createClientComponents,
  defineContractComponents,
} from "@bibliothecadao/types";
import { Type as RecsType, createWorld, setComponent, type ComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { describe, expect, it } from "vitest";
import { ResourceManager } from "./resource-manager";

type ResourceValue = ComponentValue<ClientComponents["Resource"]["schema"]>;

describe("ResourceManager.optimisticResourceUpdate", () => {
  it("composes optimistic debits across separate resource balance fields", () => {
    const components = createTestComponents();
    seedResource(components, 1, {
      STONE_BALANCE: precise(100),
      WOOD_BALANCE: precise(100),
    });
    const resourceManager = new ResourceManager(components, 1);

    const removeWoodDebit = resourceManager.optimisticResourceUpdate(ResourcesIds.Wood, -25);
    const removeStoneDebit = resourceManager.optimisticResourceUpdate(ResourcesIds.Stone, -40);

    expect(resourceManager.balance(ResourcesIds.Wood)).toBe(precise(75));
    expect(resourceManager.balance(ResourcesIds.Stone)).toBe(precise(60));

    removeStoneDebit();
    expect(resourceManager.balance(ResourcesIds.Wood)).toBe(precise(75));
    expect(resourceManager.balance(ResourcesIds.Stone)).toBe(precise(100));

    removeWoodDebit();
    expect(resourceManager.balance(ResourcesIds.Wood)).toBe(precise(100));
    expect(resourceManager.balance(ResourcesIds.Stone)).toBe(precise(100));
  });

  it("keeps the latest same-resource optimistic debit visible when an older debit is cleaned up first", () => {
    const components = createTestComponents();
    seedResource(components, 1, {
      WHEAT_BALANCE: precise(100),
    });
    const resourceManager = new ResourceManager(components, 1);

    const removeFirstDebit = resourceManager.optimisticResourceUpdate(ResourcesIds.Wheat, -20);
    const removeSecondDebit = resourceManager.optimisticResourceUpdate(ResourcesIds.Wheat, -30);

    expect(resourceManager.balance(ResourcesIds.Wheat)).toBe(precise(50));

    removeFirstDebit();
    expect(resourceManager.balance(ResourcesIds.Wheat)).toBe(precise(50));

    removeSecondDebit();
    expect(resourceManager.balance(ResourcesIds.Wheat)).toBe(precise(100));
  });

  it("cleans up grouped optimistic resource changes without persistent state", () => {
    const components = createTestComponents();
    seedResource(components, 1, {
      WHEAT_BALANCE: precise(100),
      FISH_BALANCE: precise(80),
    });
    const resourceManager = new ResourceManager(components, 1);

    const cleanup = resourceManager.optimisticResourceUpdates([
      { resourceId: ResourcesIds.Wheat, amount: -15 },
      { resourceId: ResourcesIds.Fish, amount: -10 },
    ]);

    expect(resourceManager.balance(ResourcesIds.Wheat)).toBe(precise(85));
    expect(resourceManager.balance(ResourcesIds.Fish)).toBe(precise(70));

    cleanup();

    expect(resourceManager.balance(ResourcesIds.Wheat)).toBe(precise(100));
    expect(resourceManager.balance(ResourcesIds.Fish)).toBe(precise(80));
  });

  it("applies optimistic research debits", () => {
    const components = createTestComponents();
    seedResource(components, 1, {
      RESEARCH_BALANCE: precise(100),
    });
    const resourceManager = new ResourceManager(components, 1);

    const cleanup = resourceManager.optimisticResourceUpdate(ResourcesIds.Research, -25);

    expect(resourceManager.balance(ResourcesIds.Research)).toBe(precise(75));

    cleanup();

    expect(resourceManager.balance(ResourcesIds.Research)).toBe(precise(100));
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
