// @vitest-environment node

import {
  type ClientComponents,
  type SystemCalls,
  TroopTier,
  TroopType,
  RESOURCE_PRECISION,
  createClientComponents,
  defineContractComponents,
} from "@bibliothecadao/types";
import { Type as RecsType, createWorld, setComponent, type ComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import type { AccountInterface } from "starknet";
import { describe, expect, it, vi } from "vitest";
import { getTroopResourceId } from "../utils";
import { ArmyManager } from "./army-manager";
import { ResourceManager } from "./resource-manager";

type ResourceValue = ComponentValue<ClientComponents["Resource"]["schema"]>;

describe("ArmyManager optimistic troop spend", () => {
  it("keeps troop resource debits in RECS until transaction confirmation cleanup", async () => {
    const components = createTestComponents();
    const structureId = 7;
    const troopResourceId = getTroopResourceId(TroopType.Knight, TroopTier.T1);
    seedResource(components, structureId, {
      KNIGHT_T1_BALANCE: precise(100),
    });

    let confirmTransaction!: () => void;
    const confirmation = new Promise<void>((resolve) => {
      confirmTransaction = resolve;
    });
    const waitForTransactionWithCheck = vi.fn(() => confirmation);
    const account = {
      provider: {
        waitForTransactionWithCheck,
      },
    } as unknown as AccountInterface;
    const resourceManager = new ResourceManager(components, structureId);
    const systemCalls = {
      explorer_create: vi.fn(async () => {
        expect(resourceManager.balance(troopResourceId)).toBe(precise(92));
        return { transaction_hash: "0xtroops" };
      }),
    } as unknown as SystemCalls;
    const armyManager = new ArmyManager(systemCalls, structureId, components);

    await armyManager.createExplorerArmy(account, TroopType.Knight, TroopTier.T1, 8, 1);

    expect(resourceManager.balance(troopResourceId)).toBe(precise(92));
    expect(waitForTransactionWithCheck).toHaveBeenCalledWith("0xtroops");

    confirmTransaction();
    await confirmation;
    await Promise.resolve();

    expect(resourceManager.balance(troopResourceId)).toBe(precise(100));
  });

  it("cleans up troop resource debits when transaction confirmation rejects", async () => {
    const components = createTestComponents();
    const structureId = 7;
    const troopResourceId = getTroopResourceId(TroopType.Knight, TroopTier.T1);
    seedResource(components, structureId, {
      KNIGHT_T1_BALANCE: precise(100),
    });

    const waitForTransactionWithCheck = vi.fn(() => Promise.reject(new Error("confirmation failed")));
    const account = {
      provider: {
        waitForTransactionWithCheck,
      },
    } as unknown as AccountInterface;
    const resourceManager = new ResourceManager(components, structureId);
    const systemCalls = {
      explorer_create: vi.fn(async () => ({ transaction_hash: "0xtroops" })),
    } as unknown as SystemCalls;
    const armyManager = new ArmyManager(systemCalls, structureId, components);

    await armyManager.createExplorerArmy(account, TroopType.Knight, TroopTier.T1, 8, 1);
    await Promise.resolve();
    await Promise.resolve();

    expect(waitForTransactionWithCheck).toHaveBeenCalledWith("0xtroops");
    expect(resourceManager.balance(troopResourceId)).toBe(precise(100));
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
      return [];
    case RecsType.BigIntArray:
    case RecsType.OptionalBigIntArray:
      return [];
    case RecsType.StringArray:
    case RecsType.OptionalStringArray:
      return [];
    case RecsType.Entity:
    case RecsType.OptionalEntity:
      return getEntityIdFromKeys([0n]);
    case RecsType.EntityArray:
    case RecsType.OptionalEntityArray:
      return [];
    case RecsType.T:
    case RecsType.OptionalT:
      return {};
    default:
      return {};
  }
}

function isNestedSchema(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function precise(amount: number) {
  return BigInt(amount) * BigInt(RESOURCE_PRECISION);
}
