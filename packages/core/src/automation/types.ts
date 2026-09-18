import { ResourcesIds } from "@bibliothecadao/types";
import type { RealmPresetId } from "./presets";

const BLOCKED_OUTPUT_RESOURCE_SET = new Set<ResourcesIds>([ResourcesIds.Wheat, ResourcesIds.Labor]);

export const isAutomationResourceBlocked = (
  resourceId: ResourcesIds,
  entityType: RealmEntityType = "realm",
  role: "output" | "input" = "output",
): boolean => {
  if (role === "input") {
    return false;
  }
  return BLOCKED_OUTPUT_RESOURCE_SET.has(resourceId);
};

export const MAX_RESOURCE_ALLOCATION_PERCENT = 90;
// Execution-time safety ceiling on per-input spend. User-facing percentages remain
// clamped at MAX_RESOURCE_ALLOCATION_PERCENT, but the effective budget applied during
// plan building is bounded here to absorb drift between the client's projected balance
// and the on-chain balance at tx inclusion (stream delivery lag, production projection
// overshoot, un-indexed sibling burns).
export const AUTOMATION_INPUT_BUDGET_PERCENT = 75;
export const DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES: ResourceAutomationPercentages = {
  resourceToResource: 0,
  laborToResource: 5,
};
export const DONKEY_DEFAULT_RESOURCE_PERCENT = 10;

export type RealmEntityType = "realm" | "village";

export interface ResourceAutomationPercentages {
  resourceToResource: number;
  laborToResource: number;
}

interface ResourceConsumptionRecord {
  resourceId: ResourcesIds;
  amount: number;
}

export interface RealmProductionEntry {
  resourceId: ResourcesIds;
  cycles: number;
  produced: number;
  inputs: ResourceConsumptionRecord[];
  method: "resource-to-resource" | "labor-to-resource";
}

export interface RealmAutomationExecutionSummary {
  executedAt: number;
  resourceToResource: RealmProductionEntry[];
  laborToResource: RealmProductionEntry[];
  consumptionByResource: Record<number, number>;
  outputsByResource: Record<number, number>;
  skipped: { resourceId: ResourcesIds; reason: string }[];
  /**
   * Skip reasons keyed by resourceId, derived from `skipped`. Useful for consumers
   * (e.g. the realm sidebar) that want a direct map lookup without scanning the
   * `skipped` array each render.
   */
  skippedByResource: Record<number, string>;
}

export type AutomationExecutionStatus = "success" | "failed" | "skipped";

export interface RealmExecutionStatus {
  status: AutomationExecutionStatus;
  message?: string;
  attemptedAt: number;
  consecutiveFailures: number;
}

export interface RealmAutomationConfig {
  realmId: string;
  realmName?: string;
  entityType: RealmEntityType;
  presetId: RealmPresetId;
  autoBalance: boolean;
  customPercentages: Record<number, ResourceAutomationPercentages>;
  createdAt: number;
  updatedAt: number;
  lastExecution?: RealmAutomationExecutionSummary;
  lastStatus?: RealmExecutionStatus;
}
