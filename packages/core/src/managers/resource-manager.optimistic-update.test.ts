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
