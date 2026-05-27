import { GuardSlot, StructureType } from "@bibliothecadao/types";
import { getStructureDefenseSlotLimit, getUnlockedGuardSlots } from "../utils/defense-slot-utils";
import { AttackTarget, TargetType } from "./types";

export type AutoGarrisonPlan =
  | { mode: "none" }
  | {
      mode: "atomic";
      toGuardSlot: GuardSlot;
      count: number;
    }
  | {
      mode: "post-confirmation";
      toGuardSlot: GuardSlot;
      count: number;
    };

interface ResolveAutoGarrisonPlanParams {
  attackerType: "army" | "structure";
  target: AttackTarget | null;
  attackerTroopCount: number;
  projectedAttackerTroopCount: number;
}

interface ResolveAutoGarrisonResourcesParams {
  resourceIds: number[];
  readBalance: (resourceId: number) => number;
}

export const resolveAutoGarrisonPlan = ({
  attackerType,
  target,
  attackerTroopCount,
  projectedAttackerTroopCount,
}: ResolveAutoGarrisonPlanParams): AutoGarrisonPlan => {
  if (!shouldAutoGarrisonHyperstructure(attackerType, target)) {
    return { mode: "none" };
  }

  const toGuardSlot = resolveFirstFunctionalGuardSlot(target);
  if (toGuardSlot === null) {
    return { mode: "none" };
  }

  const activeGuardCount = countActiveGuards(target);
  if (activeGuardCount === 0) {
    return {
      mode: "atomic",
      toGuardSlot,
      count: Math.max(0, Math.floor(attackerTroopCount)),
    };
  }

  if (activeGuardCount === 1) {
    return {
      mode: "post-confirmation",
      toGuardSlot,
      count: Math.max(0, Math.floor(projectedAttackerTroopCount)),
    };
  }

  return { mode: "none" };
};

export const resolveLiveAutoGarrisonCount = (
  explorer: { troops?: { count?: bigint | number | string } } | null | undefined,
) => {
  const count = Number(explorer?.troops?.count ?? 0);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
};

export const resolveAutoGarrisonResources = ({
  resourceIds,
  readBalance,
}: ResolveAutoGarrisonResourcesParams): Array<{ resourceId: number; amount: number }> =>
  resourceIds
    .map((resourceId) => ({
      resourceId,
      amount: Number(readBalance(resourceId)),
    }))
    .filter((resource) => Number.isFinite(resource.amount) && resource.amount > 0);

export const addressesMatch = (
  left: bigint | number | string | null | undefined,
  right: bigint | number | string | null | undefined,
): boolean => {
  const normalizedLeft = normalizeAddress(left);
  const normalizedRight = normalizeAddress(right);
  return normalizedLeft !== null && normalizedLeft === normalizedRight;
};

const shouldAutoGarrisonHyperstructure = (
  attackerType: ResolveAutoGarrisonPlanParams["attackerType"],
  target: AttackTarget | null,
): target is AttackTarget => {
  return (
    attackerType === "army" &&
    target?.targetType === TargetType.Structure &&
    target.structureCategory === StructureType.Hyperstructure
  );
};

const resolveFirstFunctionalGuardSlot = (target: AttackTarget): GuardSlot | null => {
  const slotLimit = resolveGuardSlotLimit(target);
  const [firstSlot] = getUnlockedGuardSlots(slotLimit);
  return firstSlot === undefined ? null : (firstSlot as GuardSlot);
};

const resolveGuardSlotLimit = (target: AttackTarget): number | null => {
  if (typeof target.guardSlotLimit === "number" && Number.isFinite(target.guardSlotLimit)) {
    return target.guardSlotLimit;
  }

  return getStructureDefenseSlotLimit(target.structureCategory ?? undefined, target.structureLevel ?? null);
};

const countActiveGuards = (target: AttackTarget): number =>
  target.info.filter((troops) => Number(troops.count ?? 0n) > 0).length;

const normalizeAddress = (value: bigint | number | string | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  try {
    return BigInt(value).toString(16);
  } catch {
    return String(value).trim().toLowerCase();
  }
};
