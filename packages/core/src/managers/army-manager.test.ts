// @vitest-environment node

import {
  type SystemCalls,
  TroopTier,
  TroopType,
  createClientComponents,
  defineContractComponents,
} from "@bibliothecadao/types";
import { createWorld } from "@dojoengine/recs";
import type { AccountInterface } from "starknet";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getTroopResourceId } from "../utils";
import { ArmyManager } from "./army-manager";
import { ResourceManager } from "./resource-manager";

describe("ArmyManager provisional troop spend", () => {
  afterEach(() => vi.restoreAllMocks());

  it("routes army creation through the session resource intent owner", async () => {
    const world = createWorld();
    const components = createClientComponents({ contractComponents: defineContractComponents(world) });
    const structureId = 7;
    const troopResourceId = getTroopResourceId(TroopType.Knight, TroopTier.T1);
    const account = { address: "0x123" } as unknown as AccountInterface;
    const onIntent = vi.fn();
    const submitProvisionalResourceTransaction = vi
      .spyOn(ResourceManager.prototype, "submitProvisionalResourceTransaction")
      .mockImplementation(async (_changes, _waiterSource, submit) => submit());
    const systemCalls = {
      explorer_create: vi.fn(async () => ({ transaction_hash: "0xtroops" })),
    } as unknown as SystemCalls;
    const armyManager = new ArmyManager(systemCalls, structureId, components);

    await armyManager.createExplorerArmy(account, TroopType.Knight, TroopTier.T1, 8, 1, onIntent);

    expect(submitProvisionalResourceTransaction).toHaveBeenCalledWith(
      [{ resourceId: troopResourceId, amount: -8 }],
      account,
      expect.any(Function),
      { onIntent },
    );
    expect(systemCalls.explorer_create).toHaveBeenCalledOnce();
  });

  it("submits directly when the troop count cannot produce a resource intent", async () => {
    const world = createWorld();
    const components = createClientComponents({ contractComponents: defineContractComponents(world) });
    const structureId = 7;
    const account = { address: "0x123" } as unknown as AccountInterface;
    const submitProvisionalResourceTransaction = vi.spyOn(
      ResourceManager.prototype,
      "submitProvisionalResourceTransaction",
    );
    const systemCalls = {
      explorer_create: vi.fn(async () => ({ transaction_hash: "0xtroops" })),
    } as unknown as SystemCalls;
    const armyManager = new ArmyManager(systemCalls, structureId, components);

    await armyManager.createExplorerArmy(account, TroopType.Knight, TroopTier.T1, 0, 1);

    expect(submitProvisionalResourceTransaction).not.toHaveBeenCalled();
    expect(systemCalls.explorer_create).toHaveBeenCalledOnce();
  });
});
