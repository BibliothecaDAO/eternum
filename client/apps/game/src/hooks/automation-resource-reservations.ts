import { ResourcesIds } from "@bibliothecadao/types";
import type { RealmResourceSnapshot } from "@/ui/features/infrastructure/automation/model/automation-processor";

interface AutomationResourceReservationItem {
  resourceId: ResourcesIds;
  humanAmount: number;
}

interface AutomationResourceReservation {
  entityId: number;
  resources: AutomationResourceReservationItem[];
  expiresAtMs: number;
}

const DEFAULT_RESERVATION_TTL_MS = 90_000;

let nextReservationId = 1;
const reservations = new Map<string, AutomationResourceReservation>();

const normalizeEntityId = (entityId: number): number => {
  if (!Number.isFinite(entityId) || entityId <= 0) return 0;
  return Math.floor(entityId);
};

const normalizeReservationResources = (
  resources: AutomationResourceReservationItem[],
): AutomationResourceReservationItem[] => {
  const totals = new Map<ResourcesIds, number>();

  for (const resource of resources) {
    const amount = Math.floor(resource.humanAmount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    totals.set(resource.resourceId, (totals.get(resource.resourceId) ?? 0) + amount);
  }

  return Array.from(totals.entries()).map(([resourceId, humanAmount]) => ({ resourceId, humanAmount }));
};

const pruneExpiredReservations = (nowMs: number) => {
  for (const [token, reservation] of reservations) {
    if (reservation.expiresAtMs <= nowMs) {
      reservations.delete(token);
    }
  }
};

export const reserveAutomationResources = ({
  entityId,
  resources,
  nowMs = Date.now(),
  ttlMs = DEFAULT_RESERVATION_TTL_MS,
}: {
  entityId: number;
  resources: AutomationResourceReservationItem[];
  nowMs?: number;
  ttlMs?: number;
}): string => {
  pruneExpiredReservations(nowMs);

  const normalizedEntityId = normalizeEntityId(entityId);
  const normalizedResources = normalizeReservationResources(resources);
  const token = `automation-resource-reservation-${nextReservationId++}`;

  if (normalizedEntityId === 0 || normalizedResources.length === 0) {
    return token;
  }

  reservations.set(token, {
    entityId: normalizedEntityId,
    resources: normalizedResources,
    expiresAtMs: nowMs + Math.max(0, ttlMs),
  });

  return token;
};

export const releaseAutomationReservation = (token: string | null | undefined) => {
  if (!token) return;
  reservations.delete(token);
};

const getReservedResourceAmount = ({
  entityId,
  resourceId,
  nowMs = Date.now(),
}: {
  entityId: number;
  resourceId: ResourcesIds;
  nowMs?: number;
}): number => {
  pruneExpiredReservations(nowMs);

  const normalizedEntityId = normalizeEntityId(entityId);
  if (normalizedEntityId === 0) return 0;

  let reserved = 0;
  for (const reservation of reservations.values()) {
    if (reservation.entityId !== normalizedEntityId) continue;
    for (const resource of reservation.resources) {
      if (resource.resourceId === resourceId) {
        reserved += resource.humanAmount;
      }
    }
  }
  return reserved;
};

export const getSpendableResourceBalance = ({
  entityId,
  resourceId,
  balanceHuman,
  nowMs = Date.now(),
}: {
  entityId: number;
  resourceId: ResourcesIds;
  balanceHuman: number;
  nowMs?: number;
}): number => {
  if (!Number.isFinite(balanceHuman) || balanceHuman <= 0) return 0;
  const reserved = getReservedResourceAmount({ entityId, resourceId, nowMs });
  return Math.max(0, Math.floor(balanceHuman - reserved));
};

export const applyAutomationReservationsToSnapshot = ({
  entityId,
  snapshot,
  nowMs = Date.now(),
}: {
  entityId: number;
  snapshot: RealmResourceSnapshot;
  nowMs?: number;
}): RealmResourceSnapshot => {
  const adjusted: RealmResourceSnapshot = new Map();

  for (const [resourceId, entry] of snapshot) {
    adjusted.set(resourceId, {
      ...entry,
      balanceHuman: getSpendableResourceBalance({
        entityId,
        resourceId,
        balanceHuman: entry.balanceHuman,
        nowMs,
      }),
    });
  }

  return adjusted;
};

export const clearAutomationResourceReservationsForTests = () => {
  reservations.clear();
  nextReservationId = 1;
};
