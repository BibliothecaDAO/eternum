import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { EternumProvider } from "@bibliothecadao/provider";
import type {
  AcceptOrderProps,
  AttackExplorerVsExplorerProps,
  AttackExplorerVsGuardProps,
  AttackGuardVsExplorerProps,
  CreateOrderProps,
  ExplorerMoveProps,
  UpgradeRealmProps,
} from "@bibliothecadao/types";
import type {
  Account,
  AccountInterface,
  GetTransactionReceiptResponse,
} from "starknet";
import { Account as StarknetAccount } from "starknet";

import type { Config } from "../config.js";
import { logger } from "../utils/logger.js";

export interface ProviderBootstrapConfig {
  manifestPath?: string;
  manifestJson?: string;
  rpcUrl?: string;
  accountAddress?: string;
  accountPrivateKey?: string;
  vrfProviderAddress?: string;
}

export interface CreateTradeOrderArgs {
  makerId: number;
  takerId: number;
  makerResourceId: number;
  makerAmount: number;
  makerMaxCount?: number;
  takerResourceId: number;
  takerAmount: number;
  expiresAt: number;
  signer?: AccountInterface | Account;
}

export interface AcceptTradeOrderArgs {
  tradeId: number;
  takerId: number;
  takerBuysCount: number;
  signer?: AccountInterface | Account;
}

export interface MoveExplorerArgs {
  explorerId: number;
  directions: number[];
  explore?: boolean;
  signer?: AccountInterface | Account;
}

export interface UpgradeRealmArgs {
  realmEntityId: number;
  signer?: AccountInterface | Account;
}

export interface AttackExplorerVsExplorerArgs {
  aggressorId: number;
  defenderId: number;
  defenderDirection: number;
  stealResources: { resourceId: number; amount: number }[];
  signer?: AccountInterface | Account;
}

export interface AttackExplorerVsGuardArgs {
  explorerId: number;
  structureId: number;
  structureDirection: number;
  signer?: AccountInterface | Account;
}

export interface AttackGuardVsExplorerArgs {
  structureId: number;
  guardSlot: number;
  explorerId: number;
  explorerDirection: number;
  signer?: AccountInterface | Account;
}

export class ProviderAdapter {
  private constructor(
    private readonly provider: EternumProvider,
    private readonly defaultSigner: AccountInterface | Account,
  ) {}

  static async createFromConfig(config: Config): Promise<ProviderAdapter | undefined> {
    if (!config.accountAddress || !config.accountPrivateKey) {
      return undefined;
    }

    const bootstrapConfig: ProviderBootstrapConfig = {
      manifestPath: config.dojoManifestPath,
      manifestJson: config.dojoManifestJson,
      rpcUrl: config.starknetRpcUrl,
      accountAddress: config.accountAddress,
      accountPrivateKey: config.accountPrivateKey,
      vrfProviderAddress: config.vrfProviderAddress,
    };

    return ProviderAdapter.create(bootstrapConfig);
  }

  static async create(config: ProviderBootstrapConfig): Promise<ProviderAdapter | undefined> {
    if (!config.accountAddress || !config.accountPrivateKey) {
      return undefined;
    }

    const manifest = await ProviderAdapter.loadManifest(config);
    if (!manifest) {
      logger.warn("Skipping provider adapter bootstrap because manifest could not be loaded");
      return undefined;
    }

    const provider = new EternumProvider(manifest, config.rpcUrl, config.vrfProviderAddress);

    const signer = new StarknetAccount({
      provider: provider.provider,
      address: config.accountAddress,
      signer: config.accountPrivateKey,
    });

    return new ProviderAdapter(provider, signer);
  }

  private static async loadManifest(config: ProviderBootstrapConfig): Promise<any | undefined> {
    if (config.manifestJson) {
      try {
        return JSON.parse(config.manifestJson);
      } catch (error) {
        logger.error({ error }, "Failed to parse MCP_DOJO_MANIFEST_JSON");
        return undefined;
      }
    }

    if (config.manifestPath) {
      try {
        const filePath = resolve(process.cwd(), config.manifestPath);
        const raw = await readFile(filePath, "utf8");
        return JSON.parse(raw);
      } catch (error) {
        logger.error({ error }, "Failed to load Dojo manifest from path");
        return undefined;
      }
    }

    return undefined;
  }

  getSigner(): AccountInterface | Account {
    return this.defaultSigner;
  }

  getProvider(): EternumProvider {
    return this.provider;
  }

  async createTradeOrder(args: CreateTradeOrderArgs): Promise<GetTransactionReceiptResponse> {
    const signer = args.signer ?? this.defaultSigner;

    const payload: CreateOrderProps = {
      maker_id: args.makerId,
      taker_id: args.takerId,
      maker_gives_resource_type: args.makerResourceId,
      maker_gives_min_resource_amount: args.makerAmount,
      maker_gives_max_count: args.makerMaxCount ?? 1,
      taker_pays_resource_type: args.takerResourceId,
      taker_pays_min_resource_amount: args.takerAmount,
      expires_at: args.expiresAt,
      signer,
    };

    return await this.provider.create_order(payload);
  }

  async acceptTradeOrder(args: AcceptTradeOrderArgs): Promise<GetTransactionReceiptResponse> {
    const signer = args.signer ?? this.defaultSigner;

    const payload: AcceptOrderProps = {
      trade_id: args.tradeId,
      taker_id: args.takerId,
      taker_buys_count: args.takerBuysCount,
      signer,
    };

    return await this.provider.accept_order(payload);
  }

  async moveExplorer(args: MoveExplorerArgs): Promise<GetTransactionReceiptResponse> {
    const signer = args.signer ?? this.defaultSigner;

    const payload: ExplorerMoveProps = {
      explorer_id: args.explorerId,
      directions: args.directions,
      explore: args.explore ?? false,
      signer,
    };

    return await this.provider.explorer_move(payload);
  }

  async upgradeRealm(args: UpgradeRealmArgs): Promise<GetTransactionReceiptResponse> {
    const signer = args.signer ?? this.defaultSigner;

    const payload: UpgradeRealmProps = {
      realm_entity_id: args.realmEntityId,
      signer,
    };

    return await this.provider.upgrade_realm(payload);
  }

  async attackExplorerVsExplorer(args: AttackExplorerVsExplorerArgs): Promise<GetTransactionReceiptResponse> {
    const signer = args.signer ?? this.defaultSigner;

    const payload: AttackExplorerVsExplorerProps = {
      aggressor_id: args.aggressorId,
      defender_id: args.defenderId,
      defender_direction: args.defenderDirection,
      steal_resources: args.stealResources.map((resource) => ({
        resourceId: resource.resourceId,
        amount: resource.amount,
      })),
      signer,
    };

    return await this.provider.attack_explorer_vs_explorer(payload);
  }

  async attackExplorerVsGuard(args: AttackExplorerVsGuardArgs): Promise<GetTransactionReceiptResponse> {
    const signer = args.signer ?? this.defaultSigner;

    const payload: AttackExplorerVsGuardProps = {
      explorer_id: args.explorerId,
      structure_id: args.structureId,
      structure_direction: args.structureDirection,
      signer,
    };

    return await this.provider.attack_explorer_vs_guard(payload);
  }

  async attackGuardVsExplorer(args: AttackGuardVsExplorerArgs): Promise<GetTransactionReceiptResponse> {
    const signer = args.signer ?? this.defaultSigner;

    const payload: AttackGuardVsExplorerProps = {
      structure_id: args.structureId,
      structure_guard_slot: args.guardSlot,
      explorer_id: args.explorerId,
      explorer_direction: args.explorerDirection,
      signer,
    };

    return await this.provider.attack_guard_vs_explorer(payload);
  }
}
