import { SetupResult } from "@bibliothecadao/dojo";
import { AndComposeClause, MemberClause } from "@dojoengine/sdk";
import { PatternMatching } from "@dojoengine/torii-client";
import type { Clause, ToriiClient } from "@dojoengine/torii-wasm/types";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import {
  addToriiStreamBreadcrumb,
  reportToriiReadinessTimeout,
  reportToriiSubscriptionLifecycle,
} from "@/observability/network-health-reporting";
import { env } from "../../env";
import { syncEntitiesDebounced } from "./sync";
import type { ToriiSubscriptionSetupTimeoutInfo } from "./torii-subscription-setup";

export interface BoundsModelConfig {
  model: string;
  colField: string;
  rowField: string;
}

export interface BoundsDescriptor {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
  padding?: number;
  models: BoundsModelConfig[];
  additionalClauses?: Clause[];
}

type BoundsSwitchOutcome = "applied" | "skipped_same_signature" | "stale_dropped";

interface BoundsSwitchResult {
  outcome: BoundsSwitchOutcome;
}

type ToriiEntitySubscription = Awaited<ReturnType<typeof syncEntitiesDebounced>>;
type SpatialSyncEntityReadinessInfo = {
  entityId: string;
  models: string[];
};
type ToriiSpatialReadinessEntityInfo = {
  elapsedMs: number;
  entityId: string;
  models: string[];
  requestId: number;
};

type ToriiSpatialReadinessTimeoutInfo = {
  elapsedMs: number;
  requestId: number;
  timeoutMs: number;
};

export interface BoundsSubscriptionSetupTimeoutInfo extends ToriiSubscriptionSetupTimeoutInfo {
  requestId: number;
}

interface ToriiStreamManagerConfig {
  client: ToriiClient;
  setup: SetupResult;
  logging?: boolean;
  clauseBuilder?: (descriptor: BoundsDescriptor) => Clause | null;
  onUpdate?: () => void;
  subscriptionSetupTimeoutMs?: number;
  onSpatialReadyEntityApplied?: (info: ToriiSpatialReadinessEntityInfo) => void;
  onSpatialReadyEntityReceived?: (info: ToriiSpatialReadinessEntityInfo) => void;
  onSpatialReadyTimeout?: (info: ToriiSpatialReadinessTimeoutInfo) => void;
  onSubscriptionSetupTimeout?: (info: BoundsSubscriptionSetupTimeoutInfo) => void;
}

export interface GlobalModelStreamConfig {
  model: string;
  keyCount?: number;
  patternMatching?: PatternMatching;
}

const DEFAULT_SUBSCRIPTION_SETUP_TIMEOUT_MS = 8_000;
const TILE_OPT_MODEL = "s1_eternum-TileOpt";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapToriiValue(value: unknown): unknown {
  let current = value;

  while (isRecord(current) && "value" in current && ("type" in current || "type_name" in current || "key" in current)) {
    current = current.value;
  }

  return current;
}

function readNumericField(record: Record<string, unknown>, field: string): number | null {
  const value = unwrapToriiValue(record[field]);
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function hashSignature(signature: string): string {
  let hash = 0;
  for (let index = 0; index < signature.length; index += 1) {
    hash = (hash * 31 + signature.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getPaddedBounds(descriptor: BoundsDescriptor): {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
} {
  const padding = descriptor.padding ?? 0;
  return {
    minCol: Math.floor(descriptor.minCol - padding),
    maxCol: Math.ceil(descriptor.maxCol + padding),
    minRow: Math.floor(descriptor.minRow - padding),
    maxRow: Math.ceil(descriptor.maxRow + padding),
  };
}

function isTileOptEntityInsideBounds(
  data: { models?: Record<string, unknown> },
  descriptor: BoundsDescriptor,
): boolean {
  const tileOptModel = data.models?.[TILE_OPT_MODEL];
  if (!isRecord(tileOptModel)) {
    return false;
  }

  const col = readNumericField(tileOptModel, "col");
  const row = readNumericField(tileOptModel, "row");
  if (col === null || row === null) {
    return false;
  }

  const bounds = getPaddedBounds(descriptor);
  return col >= bounds.minCol && col <= bounds.maxCol && row >= bounds.minRow && row <= bounds.maxRow;
}

async function waitForSpatialStreamReady(
  subscription: ToriiEntitySubscription,
  timeoutMs: number,
): Promise<{ durationMs: number; status: "ready" | "timeout" }> {
  const startedAt = performance.now();
  if (timeoutMs <= 0) {
    await subscription.ready;
    return { durationMs: performance.now() - startedAt, status: "ready" };
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timeoutHandle = setTimeout(() => resolve("timeout"), timeoutMs);
  });

  try {
    const status = await Promise.race([
      subscription.ready.then(
        () => "ready" as const,
        (error) => {
          console.warn("[ToriiStreamManager] Spatial stream readiness failed", error);
          return "ready" as const;
        },
      ),
      timeout,
    ]);

    return { durationMs: performance.now() - startedAt, status };
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

function buildSpatialReadinessEntityInfo({
  elapsedMs,
  entityId,
  models,
  requestId,
}: ToriiSpatialReadinessEntityInfo): ToriiSpatialReadinessEntityInfo {
  return {
    elapsedMs: Math.round(elapsedMs),
    entityId,
    models,
    requestId,
  };
}

function buildSpatialReadinessTimeoutInfo({
  elapsedMs,
  requestId,
  timeoutMs,
}: ToriiSpatialReadinessTimeoutInfo): ToriiSpatialReadinessTimeoutInfo {
  return {
    elapsedMs: Math.round(elapsedMs),
    requestId,
    timeoutMs,
  };
}

const defaultClauseBuilder = (descriptor: BoundsDescriptor): Clause | null => {
  const { models, additionalClauses } = descriptor;

  if (models.length === 0) {
    return additionalClauses?.length ? buildCompositeClause(additionalClauses) : null;
  }

  const padding = descriptor.padding ?? 0;

  const paddedMinCol = Math.floor(descriptor.minCol - padding);
  const paddedMaxCol = Math.ceil(descriptor.maxCol + padding);
  const paddedMinRow = Math.floor(descriptor.minRow - padding);
  const paddedMaxRow = Math.ceil(descriptor.maxRow + padding);

  const clauses: Clause[] = models.map(({ model, colField, rowField }) =>
    AndComposeClause([
      MemberClause(model as `${string}-${string}`, colField, "Gte", paddedMinCol),
      MemberClause(model as `${string}-${string}`, colField, "Lte", paddedMaxCol),
      MemberClause(model as `${string}-${string}`, rowField, "Gte", paddedMinRow),
      MemberClause(model as `${string}-${string}`, rowField, "Lte", paddedMaxRow),
    ]).build(),
  );

  if (additionalClauses?.length) {
    clauses.push(...additionalClauses);
  }

  return buildCompositeClause(clauses);
};

const buildCompositeClause = (clauses: Clause[]): Clause => {
  if (clauses.length === 1) {
    return clauses[0];
  }

  return {
    Composite: {
      operator: "Or",
      clauses,
    },
  };
};

export class ToriiStreamManager {
  private readonly client: ToriiClient;
  private readonly setup: SetupResult;
  private readonly logging: boolean;
  private readonly onUpdate?: () => void;
  private currentSubscription: ToriiEntitySubscription | null = null;
  private pendingSwitch: Promise<BoundsSwitchResult> | null = null;
  private switchQueue: Promise<unknown> = Promise.resolve();
  private latestSwitchRequestId = 0;
  private clauseBuilder: (descriptor: BoundsDescriptor) => Clause | null;
  private currentSignature: string | null = null;
  private lastDescriptor: BoundsDescriptor | null = null;
  private readonly subscriptionSetupTimeoutMs: number;
  private readonly onSpatialReadyEntityApplied?: (info: ToriiSpatialReadinessEntityInfo) => void;
  private readonly onSpatialReadyEntityReceived?: (info: ToriiSpatialReadinessEntityInfo) => void;
  private readonly onSpatialReadyTimeout?: (info: ToriiSpatialReadinessTimeoutInfo) => void;
  private readonly onSubscriptionSetupTimeout?: (info: BoundsSubscriptionSetupTimeoutInfo) => void;
  private activeReadinessDescriptor: BoundsDescriptor | null = null;
  private activeReadinessContext: { requestId: number; startedAt: number } | null = null;

  constructor({
    client,
    setup,
    logging = false,
    clauseBuilder = defaultClauseBuilder,
    onUpdate,
    subscriptionSetupTimeoutMs = DEFAULT_SUBSCRIPTION_SETUP_TIMEOUT_MS,
    onSpatialReadyEntityApplied,
    onSpatialReadyEntityReceived,
    onSpatialReadyTimeout,
    onSubscriptionSetupTimeout,
  }: ToriiStreamManagerConfig) {
    this.client = client;
    this.setup = setup;
    this.logging = logging;
    this.clauseBuilder = clauseBuilder;
    this.onUpdate = onUpdate;
    this.subscriptionSetupTimeoutMs = subscriptionSetupTimeoutMs;
    this.onSpatialReadyEntityApplied = onSpatialReadyEntityApplied;
    this.onSpatialReadyEntityReceived = onSpatialReadyEntityReceived;
    this.onSpatialReadyTimeout = onSpatialReadyTimeout;
    this.onSubscriptionSetupTimeout = onSubscriptionSetupTimeout;
  }

  async start(descriptor: BoundsDescriptor): Promise<BoundsSwitchResult> {
    return this.switchBounds(descriptor);
  }

  async switchBounds(descriptor: BoundsDescriptor): Promise<BoundsSwitchResult> {
    this.lastDescriptor = descriptor;

    const signature = JSON.stringify({
      minCol: descriptor.minCol,
      maxCol: descriptor.maxCol,
      minRow: descriptor.minRow,
      maxRow: descriptor.maxRow,
      padding: descriptor.padding ?? 0,
      models: descriptor.models,
      additionalClauses: descriptor.additionalClauses?.length ?? 0,
    });

    if (signature === this.currentSignature) {
      return { outcome: "skipped_same_signature" };
    }

    const clause = this.clauseBuilder(descriptor);
    const requestId = ++this.latestSwitchRequestId;
    const signatureHash = hashSignature(signature);
    addToriiStreamBreadcrumb({
      event: "bounds_switch_requested",
      streamType: "spatial",
      requestId,
      modelCount: descriptor.models.length,
      signatureHash,
    });

    const task = this.switchQueue.then(async (): Promise<BoundsSwitchResult> => {
      this.markReadinessContext(descriptor, requestId);

      let attemptedUpdate = false;
      const updateCurrentSubscription = this.resolveCurrentSubscriptionUpdater();
      if (updateCurrentSubscription) {
        attemptedUpdate = true;
        const updateStartedAt = performance.now();
        addToriiStreamBreadcrumb({
          event: "subscription_update_attempted",
          streamType: "spatial",
          requestId,
          signatureHash,
        });
        try {
          await updateCurrentSubscription.updateClause(clause);

          if (requestId !== this.latestSwitchRequestId) {
            return { outcome: "stale_dropped" };
          }

          this.monitorSpatialStreamReadiness(updateCurrentSubscription.subscription, requestId);
          this.currentSignature = signature;
          useConnectionStore.getState().recordSpatialHandshake();
          addToriiStreamBreadcrumb({
            event: "subscription_update_succeeded",
            streamType: "spatial",
            requestId,
            durationMs: performance.now() - updateStartedAt,
            signatureHash,
          });
          return { outcome: "applied" };
        } catch (error) {
          console.warn("[ToriiStreamManager] Bounds subscription update failed; recreating subscription", error);
          reportToriiSubscriptionLifecycle({
            streamType: "spatial",
            kind: "subscription_update",
            outcome: "fallback",
            requestId,
            durationMs: performance.now() - updateStartedAt,
            reason: getErrorMessage(error),
            signatureHash,
          });
          addToriiStreamBreadcrumb({
            event: "subscription_update_failed",
            streamType: "spatial",
            requestId,
            durationMs: performance.now() - updateStartedAt,
            signatureHash,
          });
        }
      }

      if (attemptedUpdate) {
        addToriiStreamBreadcrumb({
          event: "fallback_recreate_attempted",
          streamType: "spatial",
          requestId,
          signatureHash,
        });
      }
      const recreateStartedAt = performance.now();
      let subscription: ToriiEntitySubscription;
      try {
        subscription = await this.createSpatialSubscription(clause, requestId);
      } catch (error) {
        if (attemptedUpdate) {
          reportToriiSubscriptionLifecycle({
            streamType: "spatial",
            kind: "fallback_recreate",
            outcome: "failed",
            requestId,
            durationMs: performance.now() - recreateStartedAt,
            reason: getErrorMessage(error),
            signatureHash,
          });
        }
        throw error;
      }

      // A newer request superseded this one while it was in flight; drop the stale subscription.
      if (requestId !== this.latestSwitchRequestId) {
        subscription.cancel();
        return { outcome: "stale_dropped" };
      }

      this.monitorSpatialStreamReadiness(subscription, requestId);

      // The exact SQL fetch + hydration gate owns first terrain presentation.
      // The stream readiness monitor is a live-update health signal only.
      this.cancelCurrentSubscription();
      this.currentSubscription = subscription;
      this.currentSignature = signature;
      // Handshake succeeded — restart the staleness clock so the monitor
      // tracks subscription transport separately from quiet data updates.
      useConnectionStore.getState().recordSpatialHandshake();
      if (attemptedUpdate) {
        addToriiStreamBreadcrumb({
          event: "fallback_recreate_succeeded",
          streamType: "spatial",
          requestId,
          durationMs: performance.now() - recreateStartedAt,
          signatureHash,
        });
      }
      return { outcome: "applied" };
    });

    this.switchQueue = task.then(
      () => undefined,
      (error) => {
        console.warn("[ToriiStreamManager] Bounds switch failed in queue", error);
      },
    );
    this.pendingSwitch = task;

    try {
      return await task;
    } finally {
      if (this.pendingSwitch === task) {
        this.pendingSwitch = null;
      }
    }
  }

  private markReadinessContext(descriptor: BoundsDescriptor, requestId: number): void {
    this.activeReadinessDescriptor = descriptor;
    this.activeReadinessContext = {
      requestId,
      startedAt: performance.now(),
    };
  }

  private resolveCurrentSubscriptionUpdater(): {
    subscription: ToriiEntitySubscription;
    updateClause: (clause: Clause | undefined | null) => Promise<void>;
  } | null {
    if (
      env.VITE_PUBLIC_TORII_SPATIAL_SUBSCRIPTION_UPDATE_ENABLED === false ||
      typeof this.currentSubscription?.updateClause !== "function"
    ) {
      return null;
    }

    return {
      subscription: this.currentSubscription,
      updateClause: this.currentSubscription.updateClause,
    };
  }

  private isSpatialReadyEntity = (data: { models?: Record<string, unknown> }): boolean => {
    if (!this.activeReadinessDescriptor) {
      return false;
    }
    return isTileOptEntityInsideBounds(data, this.activeReadinessDescriptor);
  };

  private buildSpatialReadyEntityInfo(info: SpatialSyncEntityReadinessInfo): ToriiSpatialReadinessEntityInfo {
    const context = this.activeReadinessContext;
    return buildSpatialReadinessEntityInfo({
      ...info,
      elapsedMs: context ? performance.now() - context.startedAt : 0,
      requestId: context?.requestId ?? this.latestSwitchRequestId,
    });
  }

  private async createSpatialSubscription(clause: Clause | null, requestId: number): Promise<ToriiEntitySubscription> {
    return syncEntitiesDebounced(this.client, this.setup, clause, this.logging, this.onUpdate, {
      isReadyEntity: this.isSpatialReadyEntity,
      onReadyEntityApplied: (info) => {
        this.onSpatialReadyEntityApplied?.(this.buildSpatialReadyEntityInfo(info));
      },
      onReadyEntityReceived: (info) => {
        this.onSpatialReadyEntityReceived?.(this.buildSpatialReadyEntityInfo(info));
      },
      subscriptionSetupTimeoutMs: this.subscriptionSetupTimeoutMs,
      onSubscriptionSetupTimeout: (info) => {
        this.onSubscriptionSetupTimeout?.({ ...info, requestId });
      },
      streamType: "spatial",
    });
  }

  private monitorSpatialStreamReadiness(subscription: ToriiEntitySubscription, requestId: number): void {
    void waitForSpatialStreamReady(subscription, this.subscriptionSetupTimeoutMs).then((readinessResult) => {
      if (readinessResult.status !== "timeout") {
        return;
      }

      this.onSpatialReadyTimeout?.(
        buildSpatialReadinessTimeoutInfo({
          elapsedMs: readinessResult.durationMs,
          requestId,
          timeoutMs: this.subscriptionSetupTimeoutMs,
        }),
      );
      reportToriiReadinessTimeout({
        streamType: "spatial",
        elapsedMs: readinessResult.durationMs,
        requestId,
        timeoutMs: this.subscriptionSetupTimeoutMs,
      });
    });
  }

  cancelCurrentSubscription() {
    if (this.currentSubscription) {
      this.currentSubscription.cancel();
      this.currentSubscription = null;
    }
  }

  async waitForPendingSwitch(): Promise<void> {
    if (this.pendingSwitch) {
      await this.pendingSwitch;
    }
  }

  shutdown() {
    this.cancelCurrentSubscription();
  }

  async resubscribe(): Promise<BoundsSwitchResult | null> {
    this.currentSignature = null;
    if (this.lastDescriptor) {
      return this.switchBounds(this.lastDescriptor);
    }
    return null;
  }
}

export const buildModelKeysClause = (models: GlobalModelStreamConfig[]): Clause => {
  const grouped = models.reduce<
    Map<
      string,
      {
        keys: Array<string | undefined>;
        pattern_matching: PatternMatching;
        models: string[];
      }
    >
  >((acc, { model, keyCount, patternMatching }) => {
    const normalizedKeyCount = typeof keyCount === "number" ? Math.max(0, keyCount) : 0;
    const normalizedPattern = patternMatching ?? ("VariableLen" as PatternMatching);
    const signature = `${normalizedPattern}:${normalizedKeyCount}`;
    let entry = acc.get(signature);

    if (!entry) {
      entry = {
        keys: normalizedKeyCount > 0 ? new Array(normalizedKeyCount).fill(undefined) : [undefined],
        pattern_matching: normalizedPattern,
        models: [],
      };
      acc.set(signature, entry);
    }

    entry.models.push(model);
    return acc;
  }, new Map());

  const clauses: Clause[] = Array.from(grouped.values()).map(({ keys, pattern_matching, models }) => ({
    Keys: {
      keys,
      pattern_matching,
      models,
    },
  }));

  return buildCompositeClause(clauses);
};
