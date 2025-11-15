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

export interface ToriiStreamManagerConfig {
  client: ToriiClient;
  setup: SetupResult;
  logging?: boolean;
  clauseBuilder?: (descriptor: BoundsDescriptor) => Clause | null;
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
  private globalSubscription: { cancel: () => void } | null = null;
  private pendingSwitch: Promise<void> | null = null;
  private clauseBuilder: (descriptor: BoundsDescriptor) => Clause | null;
  private currentSignature: string | null = null;

  constructor({ client, setup, logging = false, clauseBuilder = defaultClauseBuilder }: ToriiStreamManagerConfig) {
    this.client = client;
    this.setup = setup;
    this.logging = logging;
    this.clauseBuilder = clauseBuilder;
  }

  async start(descriptor: BoundsDescriptor): Promise<void> {
    return this.switchBounds(descriptor);
  }

  async switchBounds(descriptor: BoundsDescriptor): Promise<void> {
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
      return;
    }

    const clause = this.clauseBuilder(descriptor);

    this.pendingSwitch = this.createSubscription(clause);

    try {
      await this.pendingSwitch;
      this.currentSignature = signature;
    } finally {
      this.pendingSwitch = null;
    }
  }

  private async createSubscription(clause: Clause | null): Promise<void> {
    this.cancelCurrentSubscription();
    const subscription = await syncEntitiesDebounced(this.client, this.setup, clause, this.logging);
    this.currentSubscription = subscription;
  }

  async setGlobalModels(models: string[]): Promise<void> {
    if (!models.length) {
      this.cancelGlobalSubscription();
      return;
    }

    const clause = buildModelKeysClause(models);
    this.cancelGlobalSubscription();
    this.globalSubscription = await syncEntitiesDebounced(this.client, this.setup, clause, this.logging);
  }

  cancelCurrentSubscription() {
    if (this.currentSubscription) {
      this.currentSubscription.cancel();
      this.currentSubscription = null;
    }
  }

  private cancelGlobalSubscription() {
    if (this.globalSubscription) {
      this.globalSubscription.cancel();
      this.globalSubscription = null;
    }
  }

  async waitForPendingSwitch(): Promise<void> {
    if (this.pendingSwitch) {
      await this.pendingSwitch;
    }
  }

  shutdown() {
    this.cancelCurrentSubscription();
    this.cancelGlobalSubscription();
  }
}

const buildModelKeysClause = (models: string[]): Clause => ({
  Keys: {
    keys: [undefined],
    pattern_matching: "FixedLen" as PatternMatching,
    models,
  },
});
