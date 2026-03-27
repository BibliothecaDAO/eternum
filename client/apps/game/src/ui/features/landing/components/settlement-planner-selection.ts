import { getRealmNameById, toHexString } from "@bibliothecadao/eternum";

interface PlannerRealmSelectionSource {
  realmId: number | null;
  realmName?: string | null;
  ownerAddress: string;
  ownerName: string | null;
  resourceIds?: number[] | null;
}

interface PlannerRealmLiveInfo {
  realmId?: bigint | number | null;
  owner?: bigint | string | null;
  ownerName?: string | null;
  resources?: number[] | null;
}

export interface PlannerRealmSelectionDetails {
  realmId: number | null;
  realmName: string | null;
  ownerAddress: string;
  ownerName: string | null;
  resourceIds: number[];
}

const normalizeRealmId = (realmId: bigint | number | null | undefined): number | null => {
  if (realmId == null) return null;

  const parsedRealmId = Number(realmId);
  return Number.isFinite(parsedRealmId) ? parsedRealmId : null;
};

const normalizeOwnerAddress = (owner: bigint | string | null | undefined): string | null => {
  if (owner == null) return null;
  if (typeof owner === "string") return owner;

  try {
    return toHexString(owner);
  } catch {
    return null;
  }
};

const resolveRealmName = (realmId: number | null, fallbackRealmName?: string | null): string | null => {
  const trimmedFallback = fallbackRealmName?.trim();
  if (trimmedFallback) {
    return trimmedFallback;
  }

  if (realmId == null) {
    return null;
  }

  return getRealmNameById(realmId) || `Realm #${realmId}`;
};

const resolveResourceIds = (
  sourceResourceIds: number[] | null | undefined,
  liveResourceIds: number[] | null | undefined,
): number[] => {
  const sanitizedLiveResourceIds = (liveResourceIds ?? []).filter((resourceId) => Number.isInteger(resourceId));
  if (sanitizedLiveResourceIds.length > 0) {
    return sanitizedLiveResourceIds;
  }

  return (sourceResourceIds ?? []).filter((resourceId) => Number.isInteger(resourceId));
};

const formatPlannerOwnerAddress = (ownerAddress: string): string =>
  ownerAddress.substring(0, 6) + "..." + ownerAddress.substring(ownerAddress.length - 4);

const isZeroHexAddress = (address: string | null | undefined): boolean => !address || /^0x?0+$/i.test(address.trim());

export const resolvePlannerOwnerLabel = (
  ownerName: string | null | undefined,
  ownerAddress: string | null | undefined,
) => {
  const trimmedOwnerName = ownerName?.trim();
  if (trimmedOwnerName) {
    return trimmedOwnerName;
  }

  if (!ownerAddress || isZeroHexAddress(ownerAddress)) {
    return "Owner unavailable";
  }

  return formatPlannerOwnerAddress(ownerAddress);
};

export const buildPlannerRealmSelectionDetails = ({
  sourceRealm,
  liveRealm,
}: {
  sourceRealm: PlannerRealmSelectionSource | null;
  liveRealm: PlannerRealmLiveInfo | null;
}): PlannerRealmSelectionDetails | null => {
  if (!sourceRealm) {
    return null;
  }

  const liveRealmId = normalizeRealmId(liveRealm?.realmId);
  const resolvedRealmId = liveRealmId ?? sourceRealm.realmId;
  const liveOwnerAddress = normalizeOwnerAddress(liveRealm?.owner);

  return {
    realmId: resolvedRealmId,
    realmName: resolveRealmName(resolvedRealmId, sourceRealm.realmName),
    ownerAddress: liveOwnerAddress && !isZeroHexAddress(liveOwnerAddress) ? liveOwnerAddress : sourceRealm.ownerAddress,
    ownerName: liveRealm?.ownerName?.trim() || sourceRealm.ownerName,
    resourceIds: resolveResourceIds(sourceRealm.resourceIds, liveRealm?.resources),
  };
};
