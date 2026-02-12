import { SetupResult } from "@bibliothecadao/dojo";
import { AndComposeClause, MemberClause } from "@dojoengine/sdk";
import { PatternMatching } from "@dojoengine/torii-client";
import type { Clause, ToriiClient } from "@dojoengine/torii-wasm/types";
import { syncEntitiesDebounced } from "./sync";

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

export type BoundsSwitchOutcome = "applied" | "skipped_same_signature" | "stale_dropped";

export interface BoundsSwitchResult {
  outcome: BoundsSwitchOutcome;
}

interface ToriiStreamManagerConfig {
  client: ToriiClient;
  setup: SetupResult;
  logging?: boolean;
  clauseBuilder?: (descriptor: BoundsDescriptor) => Clause | null;
}

export interface GlobalModelStreamConfig {
  model: string;
  keyCount?: number;
  patternMatching?: PatternMatching;
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
  private currentSubscription: { cancel: () => void } | null = null;
  private pendingSwitch: Promise<BoundsSwitchResult> | null = null;
  private switchQueue: Promise<unknown> = Promise.resolve();
  private latestSwitchRequestId = 0;
  private clauseBuilder: (descriptor: BoundsDescriptor) => Clause | null;
  private currentSignature: string | null = null;

  constructor({ client, setup, logging = false, clauseBuilder = defaultClauseBuilder }: ToriiStreamManagerConfig) {
    this.client = client;
    this.setup = setup;
    this.logging = logging;
    this.clauseBuilder = clauseBuilder;
  }

  async start(descriptor: BoundsDescriptor): Promise<BoundsSwitchResult> {
    return this.switchBounds(descriptor);
  }

  async switchBounds(descriptor: BoundsDescriptor): Promise<BoundsSwitchResult> {
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

    const task = this.switchQueue.then(async (): Promise<BoundsSwitchResult> => {
      const subscription = await syncEntitiesDebounced(this.client, this.setup, clause, this.logging);

      // A newer request superseded this one while it was in flight; drop the stale subscription.
      if (requestId !== this.latestSwitchRequestId) {
        subscription.cancel();
        return { outcome: "stale_dropped" };
      }

      // Swap active stream only after the replacement subscription is ready.
      this.cancelCurrentSubscription();
      this.currentSubscription = subscription;
      this.currentSignature = signature;
      return { outcome: "applied" };
    });

    this.switchQueue = task.then(
      () => undefined,
      () => undefined,
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
