import { useAutomationStore, type RealmAutomationExecutionSummary } from "@/hooks/store/use-automation-store";
import { buildAutomationSkipMessage } from "@/ui/features/infrastructure/automation/model/automation-processor";
import { ResourcesIds } from "@bibliothecadao/types";
import { useCallback, useMemo } from "react";

const EMPTY_MAP: Map<ResourcesIds, string> = new Map();

/**
 * Pure helper that turns a last-execution summary into a `resourceId → friendly skip
 * message` map. Exported for unit testing; callers should use `useRealmStarvedResources`.
 */
export const extractStarvedResources = (
  lastExecution: RealmAutomationExecutionSummary | undefined,
): Map<ResourcesIds, string> => {
  if (!lastExecution) return new Map();

  const { skippedByResource, skipped } = lastExecution;
  const entries = new Map<ResourcesIds, string>();

  // Prefer the direct map when it's populated (it will be for fresh executions). Fall
  // back to scanning `skipped` for older persisted summaries that predate the
  // `skippedByResource` field.
  if (skippedByResource && Object.keys(skippedByResource).length > 0) {
    Object.entries(skippedByResource).forEach(([key, reason]) => {
      const resourceId = Number(key);
      if (!Number.isFinite(resourceId) || typeof reason !== "string") return;
      entries.set(
        resourceId as ResourcesIds,
        buildAutomationSkipMessage({ resourceId: resourceId as ResourcesIds, reason }),
      );
    });
  } else if (Array.isArray(skipped)) {
    skipped.forEach((entry) => {
      if (!entry) return;
      if (typeof entry.resourceId !== "number") return;
      if (entries.has(entry.resourceId as ResourcesIds)) return;
      entries.set(entry.resourceId as ResourcesIds, buildAutomationSkipMessage(entry));
    });
  }

  return entries;
};

/**
 * Returns a map keyed by `resourceId` → human-readable skip reason for the last
 * automation cycle on `structureEntityId`. If no last execution is recorded, returns an
 * empty map.
 */
export const useRealmStarvedResources = (
  structureEntityId: number | string | null | undefined,
): Map<ResourcesIds, string> => {
  const realmKey = useMemo(() => {
    if (structureEntityId === null || structureEntityId === undefined) return null;
    return String(structureEntityId);
  }, [structureEntityId]);

  const lastExecution = useAutomationStore(
    useCallback((state) => (realmKey ? state.realms[realmKey]?.lastExecution : undefined), [realmKey]),
  );

  const result = useMemo(() => extractStarvedResources(lastExecution), [lastExecution]);
  return result.size === 0 ? EMPTY_MAP : result;
};
