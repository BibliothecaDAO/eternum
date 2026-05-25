import type { RealmAutomationConfig } from "@/hooks/store/use-automation-store";
import type { ExecuteRealmProductionPlanProps } from "@bibliothecadao/types";
import type { RealmProductionPlan } from "./automation-processor";

const REALM_EXECUTION_TIMEOUT_MS = 30_000;

export class AutomationTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Realm execution timed out after ${Math.round(timeoutMs / 1000)}s`);
    this.name = "AutomationTimeoutError";
  }
}

export class AutomationCancelledError extends Error {
  readonly scope: "pass" | "realm";
  constructor(reason: string, scope: "pass" | "realm" = "realm") {
    super(reason);
    this.name = "AutomationCancelledError";
    this.scope = scope;
  }
}

export class AutomationSignerSkippedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "AutomationSignerSkipped";
  }
}

const SIGNER_TRANSIENT_PATTERN =
  /nonce|invalid transaction nonce|account validation failed|account balance|duplicate transaction|insufficient (?:max )?fee/i;

export const isSignerTransientError = (error: unknown): boolean => {
  if (!error) return false;
  if (error instanceof AutomationTimeoutError) return false;
  if (error instanceof AutomationCancelledError) return false;
  if (error instanceof AutomationSignerSkippedError) return false;

  const visited = new Set<unknown>();
  const stack: unknown[] = [error];
  while (stack.length) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    if (typeof current === "string") {
      if (SIGNER_TRANSIENT_PATTERN.test(current)) return true;
      continue;
    }
    if (typeof current !== "object") continue;

    const record = current as Record<string, unknown>;
    const candidateFields = ["message", "reason", "data", "revert_error"];
    for (const field of candidateFields) {
      const value = record[field];
      if (typeof value === "string" && SIGNER_TRANSIENT_PATTERN.test(value)) return true;
      if (value && (typeof value === "object" || typeof value === "string")) stack.push(value);
    }
    if (record.cause) stack.push(record.cause);
  }

  return false;
};

type AutomationCancellation = { cancelled: false } | { cancelled: true; reason: string; scope?: "pass" | "realm" };

export interface ExecutableProductionPlan {
  plan: RealmProductionPlan;
  realmConfig: RealmAutomationConfig;
  realmLabel: string;
  planLogPayload: Record<string, unknown>;
}

type ExecuteRealmProductionPlan = (args: ExecuteRealmProductionPlanProps) => Promise<unknown>;

type ProductionPlanExecutionResult =
  | { status: "fulfilled"; value: ExecutableProductionPlan }
  | {
      status: "rejected";
      reason: {
        error: unknown;
        realmConfig: RealmAutomationConfig;
        realmLabel: string;
      };
    };

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new AutomationTimeoutError(timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

export const executeProductionPlansSequentially = async ({
  executablePlans,
  signer,
  executeRealmProductionPlan,
  onBeforeExecute,
  timeoutMs = REALM_EXECUTION_TIMEOUT_MS,
  isCancelled,
}: {
  executablePlans: ExecutableProductionPlan[];
  signer: ExecuteRealmProductionPlanProps["signer"];
  executeRealmProductionPlan: ExecuteRealmProductionPlan;
  onBeforeExecute?: (executablePlan: ExecutableProductionPlan) => void;
  timeoutMs?: number;
  isCancelled?: (executablePlan: ExecutableProductionPlan) => AutomationCancellation;
}): Promise<ProductionPlanExecutionResult[]> => {
  const results: ProductionPlanExecutionResult[] = [];
  let passAborted: { reason: string } | null = null;
  let signerAborted: { reason: string } | null = null;

  for (const executablePlan of executablePlans) {
    const { plan, realmConfig, realmLabel } = executablePlan;

    if (signerAborted) {
      results.push({
        status: "rejected",
        reason: {
          error: new AutomationSignerSkippedError(signerAborted.reason),
          realmConfig,
          realmLabel,
        },
      });
      continue;
    }

    if (passAborted) {
      results.push({
        status: "rejected",
        reason: {
          error: new AutomationCancelledError(passAborted.reason, "pass"),
          realmConfig,
          realmLabel,
        },
      });
      continue;
    }

    const cancellation = isCancelled?.(executablePlan);
    if (cancellation?.cancelled) {
      const scope = cancellation.scope ?? "realm";
      if (scope === "pass") passAborted = { reason: cancellation.reason };
      results.push({
        status: "rejected",
        reason: {
          error: new AutomationCancelledError(cancellation.reason, scope),
          realmConfig,
          realmLabel,
        },
      });
      continue;
    }

    try {
      onBeforeExecute?.(executablePlan);
      const callset = plan.callset;
      await withTimeout(
        executeRealmProductionPlan({
          signer,
          realm_entity_id: plan.realmId,
          skipQueue: true,
          resource_to_resource: callset.resourceToResource.map((item) => ({
            resource_id: item.resourceId,
            cycles: item.cycles,
          })),
          labor_to_resource: callset.laborToResource.map((item) => ({
            resource_id: item.resourceId,
            cycles: item.cycles,
          })),
        }),
        timeoutMs,
      );
      results.push({ status: "fulfilled", value: executablePlan });
    } catch (error) {
      results.push({
        status: "rejected",
        reason: {
          error,
          realmConfig,
          realmLabel,
        },
      });
      if (isSignerTransientError(error)) {
        signerAborted = {
          reason: "Skipped: signer error earlier in pass — next tick will retry",
        };
      }
    }
  }

  return results;
};
