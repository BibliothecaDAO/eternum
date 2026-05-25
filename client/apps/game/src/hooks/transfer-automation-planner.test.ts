// @vitest-environment node
import { ResourcesIds, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@bibliothecadao/eternum", () => {
  return {
    calculateDonkeysNeeded: vi.fn((weightKg: number) => Math.ceil(weightKg / 100)),
    getTotalResourceWeightKg: vi.fn((rs: Array<{ resourceId: number; amount: number } | undefined>) =>
      rs.reduce((acc, r) => acc + (r ? r.amount * 10 : 0), 0),
    ),
  };
});

import {
  assessDonkeyCapacity,
  buildSendResourcesArgs,
  planTransferAmounts,
  toRawUnits,
} from "./transfer-automation-planner";
import type { TransferAutomationEntry } from "./store/use-transfer-automation-store";

const makeEntry = (
  resourceIds: ResourcesIds[],
  resourceConfigs?: TransferAutomationEntry["resourceConfigs"],
): Pick<TransferAutomationEntry, "resourceIds" | "resourceConfigs"> => ({
  resourceIds,
  resourceConfigs,
});

describe("planTransferAmounts", () => {
  it("returns items clamped to the current balance", () => {
    const entry = makeEntry(
      [ResourcesIds.Wood, ResourcesIds.Coal],
      [
        { resourceId: ResourcesIds.Wood, amount: 100 },
        { resourceId: ResourcesIds.Coal, amount: 100 },
      ],
    );
    const balances = new Map<ResourcesIds, number>([
      [ResourcesIds.Wood, 40], // balance < desired -> transfer 40
      [ResourcesIds.Coal, 200], // balance > desired -> transfer 100
    ]);
    const result = planTransferAmounts(entry, (rid) => balances.get(rid) ?? 0);
    expect(result).toEqual([
      { resourceId: ResourcesIds.Wood, humanAmount: 40 },
      { resourceId: ResourcesIds.Coal, humanAmount: 100 },
    ]);
  });

  it("skips resources with desired<=0 or zero balance", () => {
    const entry = makeEntry(
      [ResourcesIds.Wood, ResourcesIds.Coal, ResourcesIds.Stone],
      [
        { resourceId: ResourcesIds.Wood, amount: 0 },
        { resourceId: ResourcesIds.Coal, amount: 10 },
        { resourceId: ResourcesIds.Stone, amount: 10 },
      ],
    );
    const balances = new Map<ResourcesIds, number>([
      [ResourcesIds.Wood, 50],
      [ResourcesIds.Coal, 0],
      [ResourcesIds.Stone, 5],
    ]);
    const result = planTransferAmounts(entry, (rid) => balances.get(rid) ?? 0);
    expect(result).toEqual([{ resourceId: ResourcesIds.Stone, humanAmount: 5 }]);
  });

  it("floors fractional desired amounts", () => {
    const entry = makeEntry([ResourcesIds.Wood], [{ resourceId: ResourcesIds.Wood, amount: 7.9 }]);
    const result = planTransferAmounts(entry, () => 100);
    expect(result).toEqual([{ resourceId: ResourcesIds.Wood, humanAmount: 7 }]);
  });

  it("skips resources not present in resourceConfigs", () => {
    const entry = makeEntry([ResourcesIds.Wood, ResourcesIds.Coal], [{ resourceId: ResourcesIds.Wood, amount: 10 }]);
    const result = planTransferAmounts(entry, () => 100);
    expect(result).toEqual([{ resourceId: ResourcesIds.Wood, humanAmount: 10 }]);
  });

  it("treats a non-finite balance as zero", () => {
    const entry = makeEntry([ResourcesIds.Wood], [{ resourceId: ResourcesIds.Wood, amount: 10 }]);
    const result = planTransferAmounts(entry, () => Number.NaN);
    expect(result).toEqual([]);
  });

  it("returns an empty list when no configs are supplied", () => {
    const entry = makeEntry([ResourcesIds.Wood, ResourcesIds.Coal]);
    const result = planTransferAmounts(entry, () => 100);
    expect(result).toEqual([]);
  });
});

describe("assessDonkeyCapacity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes when donkey balance meets the need", () => {
    const list = [{ resourceId: ResourcesIds.Wood, humanAmount: 10 }];
    // 10 * 10 = 100kg; calculateDonkeysNeeded mock -> ceil(100/100) = 1 donkey
    const result = assessDonkeyCapacity(list, 1);
    expect(result.ok).toBe(true);
    expect(result.totalKg).toBe(100);
    expect(result.neededDonkeys).toBe(1);
  });

  it("fails when donkey balance falls short", () => {
    const list = [{ resourceId: ResourcesIds.Wood, humanAmount: 25 }];
    // 25 * 10 = 250kg → 3 donkeys
    const result = assessDonkeyCapacity(list, 2);
    expect(result.ok).toBe(false);
    expect(result.neededDonkeys).toBe(3);
  });

  it("returns 0 kg / 0 donkeys for an empty list", () => {
    const result = assessDonkeyCapacity([], 0);
    expect(result).toEqual({ ok: true, totalKg: 0, neededDonkeys: 0 });
  });
});

describe("toRawUnits", () => {
  it("scales by RESOURCE_PRECISION and floors", () => {
    expect(toRawUnits(1)).toBe(BigInt(RESOURCE_PRECISION));
    expect(toRawUnits(2.5)).toBe(BigInt(Math.floor(2.5 * RESOURCE_PRECISION)));
  });

  it("clamps negative amounts to 0n", () => {
    expect(toRawUnits(-5)).toBe(0n);
  });
});

describe("buildSendResourcesArgs", () => {
  it("emits [resourceId, rawAmount] pairs in order", () => {
    const args = buildSendResourcesArgs([
      { resourceId: ResourcesIds.Wood, humanAmount: 1 },
      { resourceId: ResourcesIds.Coal, humanAmount: 2 },
    ]);
    expect(args).toEqual([
      ResourcesIds.Wood,
      BigInt(RESOURCE_PRECISION),
      ResourcesIds.Coal,
      BigInt(2 * RESOURCE_PRECISION),
    ]);
  });

  it("returns an empty array for an empty plan", () => {
    expect(buildSendResourcesArgs([])).toEqual([]);
  });
});
