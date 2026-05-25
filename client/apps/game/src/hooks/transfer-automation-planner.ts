import { calculateDonkeysNeeded, getTotalResourceWeightKg } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import type { TransferAutomationEntry } from "./store/use-transfer-automation-store";

interface PlannedTransfer {
  resourceId: ResourcesIds;
  humanAmount: number;
}

export const planTransferAmounts = (
  entry: Pick<TransferAutomationEntry, "resourceIds" | "resourceConfigs">,
  getBalanceHuman: (resourceId: ResourcesIds) => number,
): PlannedTransfer[] => {
  const configMap = new Map<number, number>();
  if (entry.resourceConfigs && Array.isArray(entry.resourceConfigs)) {
    for (const c of entry.resourceConfigs) {
      configMap.set(c.resourceId, Math.max(0, Math.floor(c.amount ?? 0)));
    }
  }
  const list: PlannedTransfer[] = [];
  for (const rid of entry.resourceIds) {
    const desired = Math.max(0, Math.floor(configMap.get(rid) ?? 0));
    if (desired <= 0) continue;
    const balHuman = getBalanceHuman(rid);
    if (!Number.isFinite(balHuman) || balHuman <= 0) continue;
    const amt = Math.max(0, Math.min(balHuman, desired));
    if (amt > 0) list.push({ resourceId: rid, humanAmount: amt });
  }
  return list;
};

interface DonkeyCapacityResult {
  ok: boolean;
  totalKg: number;
  neededDonkeys: number;
}

export const assessDonkeyCapacity = (
  transferList: PlannedTransfer[],
  donkeyBalanceHuman: number,
): DonkeyCapacityResult => {
  const totalKg = getTotalResourceWeightKg(
    transferList.map((t) => ({ resourceId: t.resourceId, amount: t.humanAmount })),
  );
  const neededDonkeys = calculateDonkeysNeeded(totalKg);
  return { ok: donkeyBalanceHuman >= neededDonkeys, totalKg, neededDonkeys };
};

export const toRawUnits = (amountHuman: number): bigint =>
  BigInt(Math.floor(Math.max(0, amountHuman) * RESOURCE_PRECISION));

export const buildSendResourcesArgs = (transferList: PlannedTransfer[]): (bigint | number)[] => {
  const args: (bigint | number)[] = [];
  for (const t of transferList) {
    args.push(t.resourceId, toRawUnits(t.humanAmount));
  }
  return args;
};
