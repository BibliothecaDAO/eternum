import { ViewCache } from "./cache";
import type { EternumClientConfig, Signer } from "./config";
import type { ContractAddress } from "./types/common";
import {
  TransactionClient,
  ResourceTransactions,
  TroopTransactions,
  CombatTransactions,
  TradeTransactions,
  BuildingTransactions,
  BankTransactions,
  HyperstructureTransactions,
  GuildTransactions,
  RealmTransactions,
} from "./transactions";
import { ViewClient, type SqlApiLike } from "./views";

/**
 * Main entry point for the headless Eternum client.
 *
 * Wires together the view layer (cached read queries), the transaction layer
 * (grouped write operations), and the underlying provider / SQL API.
 */
export class EternumClient {
  readonly view: ViewClient;
  readonly resources: ResourceTransactions;
  readonly troops: TroopTransactions;
  readonly combat: CombatTransactions;
  readonly trade: TradeTransactions;
  readonly buildings: BuildingTransactions;
  readonly bank: BankTransactions;
  readonly hyperstructure: HyperstructureTransactions;
  readonly guild: GuildTransactions;
  readonly realm: RealmTransactions;
  readonly cache: ViewCache;

  private account: Signer | null = null;
  private accountAddress: ContractAddress | null = null;
  private _provider: MinimalProvider;
  private _sql: SqlApiLike;
  private txClient: TransactionClient;

  private constructor(config: EternumClientConfig, provider: MinimalProvider, sql: SqlApiLike) {
    this._provider = provider;
    this._sql = sql;
    this.cache = new ViewCache(config.cacheTtlMs, config.cacheMaxSize);
    this.txClient = new TransactionClient(this._provider);

    // Wire transaction shortcuts
    this.resources = this.txClient.resources;
    this.troops = this.txClient.troops;
    this.combat = this.txClient.combat;
    this.trade = this.txClient.trade;
    this.buildings = this.txClient.buildings;
    this.bank = this.txClient.bank;
    this.hyperstructure = this.txClient.hyperstructure;
    this.guild = this.txClient.guild;
    this.realm = this.txClient.realm;

    // Wire view client
    this.view = new ViewClient(
      this._sql,
      this.cache,
      () => this.accountAddress,
      () => Math.floor(Date.now() / 1000),
      config.logger,
    );
  }

  /**
   * Create a new EternumClient instance.
   *
   * Dynamically imports @bibliothecadao/provider and @bibliothecadao/torii
   * so the client package has no hard compile-time dependency on their DTS output.
   */
  static async create(config: EternumClientConfig): Promise<EternumClient> {
    // Dynamic imports to avoid compile-time dependency on unbuilt peer packages
    const providerMod = await import("@bibliothecadao/provider" as string);
    const toriiMod = await import("@bibliothecadao/torii" as string);

    const provider = new providerMod.EternumProvider(config.manifest, config.rpcUrl, config.vrfProviderAddress);
    const sql = new toriiMod.SqlApi(config.toriiUrl, config.cacheUrl);

    return new EternumClient(config, provider, sql);
  }

  /**
   * Connect an account (signer) to the client for submitting transactions.
   */
  connect(account: Signer): void {
    this.account = account;
    // starknet Account exposes `.address` as a string
    this.accountAddress = (account as any).address?.toString() ?? null;
  }

  /**
   * Disconnect the current account.
   */
  disconnect(): void {
    this.account = null;
    this.accountAddress = null;
  }

  get isConnected(): boolean {
    return this.account !== null;
  }

  get provider(): MinimalProvider {
    return this._provider;
  }

  get sql(): SqlApiLike {
    return this._sql;
  }

  /**
   * Subscribe to provider events.
   * Returns an unsubscribe function.
   */
  on(event: string, callback: (...args: unknown[]) => void): () => void {
    this._provider.on(event, callback);
    return () => this._provider.off(event, callback);
  }
}

type ProviderEventCallback = (...args: unknown[]) => void;
export interface MinimalProvider {
  on(event: string, callback: ProviderEventCallback): void;
  off(event: string, callback: ProviderEventCallback): void;
  [method: string]: unknown;
}
