import { type ClientComponents, ContractAddress, type ID } from "@bibliothecadao/types";
import { Has, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { getGuildFromPlayerAddress } from "../utils";
import { ClientConfigManager } from "./config-manager";

interface ContractAddressAndAmount {
  key: false;
  type: "tuple";
  type_name: "(ContractAddress, u16)";
  value: [
    {
      key: false;
      type: "primitive";
      type_name: "ContractAddress";
      value: string;
    },
    {
      key: false;
      type: "primitive";
      type_name: "u16";
      value: number;
    },
  ];
}

export class LeaderboardManager {
  private static _instance: LeaderboardManager;
  public pointsPerPlayer: Map<ContractAddress, number> = new Map();
  public playersByRank: [ContractAddress, number][] = [];
  public pointsPerGuild: Map<ContractAddress, number> = new Map();
  public guildsByRank: [ContractAddress, number][] = [];

  // Hyperstructure unregistered shareholder points cache
  private unregisteredShareholderPointsCache: Map<ContractAddress, number> = new Map();
  private lastUnregisteredShareholderPointsUpdate: number = 0;
  private readonly unregisteredShareholderPointsUpdateInterval: number;

  constructor(
    private readonly components: ClientComponents,
    unregisteredShareholderPointsUpdateInterval: number = 60000,
  ) {
    this.unregisteredShareholderPointsUpdateInterval = unregisteredShareholderPointsUpdateInterval;
    // Start the periodic update for unregistered shareholder points
    this.startUnregisteredShareholderPointsUpdater();
  }

  public static instance(components: ClientComponents, unregisteredShareholderPointsUpdateInterval?: number) {
    if (!LeaderboardManager._instance) {
      LeaderboardManager._instance = new LeaderboardManager(components, unregisteredShareholderPointsUpdateInterval);
    }
    return LeaderboardManager._instance;
  }

  public initialize() {
    this.updateUnregisteredShareholderPointsCache();
    this.pointsPerPlayer = this.getPlayerPoints();
    this.pointsPerGuild = this.getGuildsPoints();
    this.playersByRank = this.getPlayersByRank();
    this.guildsByRank = this.getGuildsByRank();
  }

  public updatePoints() {
    // Update unregistered shareholder points cache if needed
    this.updateUnregisteredShareholderPointsCacheIfNeeded();

    // Refresh player points (now includes cached unregistered shareholder points)
    this.pointsPerPlayer = this.getPlayerPoints();

    // Refresh guild points
    this.pointsPerGuild = this.getGuildsPoints();

    // Update guild rankings
    this.guildsByRank = this.getGuildsByRank();

    // Update player rankings
    this.playersByRank = this.getPlayersByRank();
  }

  /**
   * Start periodic updater for unregistered shareholder points
   */
  private startUnregisteredShareholderPointsUpdater() {
    // Don't immediately update in constructor - let initialize() or updatePoints() handle initial population
    // this.updateUnregisteredShareholderPointsCache();
    setInterval(() => {
      this.updateUnregisteredShareholderPointsCache();
    }, this.unregisteredShareholderPointsUpdateInterval);
  }

  /**
   * Update unregistered shareholder points cache if enough time has passed
   */
  private updateUnregisteredShareholderPointsCacheIfNeeded() {
    const now = Date.now();
    // Always update if cache has never been populated (lastUnregisteredShareholderPointsUpdate === 0)
    // or if the cache is empty (indicating it needs initial population)
    // or if enough time has passed since last update
    if (
      this.lastUnregisteredShareholderPointsUpdate === 0 ||
      this.unregisteredShareholderPointsCache.size === 0 ||
      now - this.lastUnregisteredShareholderPointsUpdate >= this.unregisteredShareholderPointsUpdateInterval
    ) {
      this.updateUnregisteredShareholderPointsCache();
    }
  }

  /**
   * Calculate and cache all unregistered shareholder points at once for efficiency
   */
  private updateUnregisteredShareholderPointsCache() {
    const configManager = ClientConfigManager.instance();
    const pointsPerSecond = configManager.getHyperstructureConfig().pointsPerCycle;
    const seasonConfig = configManager.getSeasonConfig();

    // Use season end time if season has ended, otherwise use current time
    const currentTimestamp =
      seasonConfig.endAt && Number(seasonConfig.endAt) > 0 ? Number(seasonConfig.endAt) : Math.floor(Date.now() / 1000);

    // Clear previous cache
    this.unregisteredShareholderPointsCache.clear();

    // Get all hyperstructures
    const allHyperstructuresShareholders = runQuery([Has(this.components.HyperstructureShareholders)]);

    for (const hyperstructureShareholdersEntityId of allHyperstructuresShareholders) {
      const hyperstructureShareholders = getComponentValue(
        this.components.HyperstructureShareholders,
        hyperstructureShareholdersEntityId,
      );
      if (!hyperstructureShareholders) continue;

      const shareholders = hyperstructureShareholders.shareholders as unknown as ContractAddressAndAmount[];
      const startTimestamp = Number(hyperstructureShareholders.start_at);
      if (startTimestamp === 0) continue;
      const timeElapsed = Math.max(0, currentTimestamp - startTimestamp);

      // Aggregate shareholder percentages by player address to handle duplicates
      const playerShareholderMap = new Map<ContractAddress, number>();

      for (const share of shareholders) {
        const playerAddress = ContractAddress(share.value[0].value);
        const shareholderPercentage = Number(share.value[1].value) / 10_000; // Convert from basis points to decimal

        // Add to existing percentage or set new percentage
        const existingPercentage = playerShareholderMap.get(playerAddress) || 0;
        playerShareholderMap.set(playerAddress, existingPercentage + shareholderPercentage);
      }

      // Calculate points for each unique player in this hyperstructure
      for (const [playerAddress, totalShareholderPercentage] of playerShareholderMap) {
        const hyperstructurePoints = Math.floor(pointsPerSecond * totalShareholderPercentage * timeElapsed);

        // Add to player's total unregistered shareholder points
        const currentPoints = this.unregisteredShareholderPointsCache.get(playerAddress) || 0;
        this.unregisteredShareholderPointsCache.set(playerAddress, currentPoints + hyperstructurePoints);
      }
    }

    this.lastUnregisteredShareholderPointsUpdate = Date.now();
  }

  /**
   * Get cached unregistered shareholder points for a specific player
   */
  public getPlayerHyperstructureUnregisteredShareholderPoints(playerAddress: ContractAddress): number {
    this.updateUnregisteredShareholderPointsCacheIfNeeded();
    return this.unregisteredShareholderPointsCache.get(playerAddress) || 0;
  }

  /**
   * Get only the registered points for a specific player (without unregistered shareholder points)
   */
  public getPlayerRegisteredPoints(playerAddress: ContractAddress): number {
    const registeredPoints = runQuery([Has(this.components.PlayerRegisteredPoints)]);

    for (const entityId of registeredPoints) {
      const playerRegisteredPoints = getComponentValue(this.components.PlayerRegisteredPoints, entityId);
      if (!playerRegisteredPoints) continue;

      if (ContractAddress(playerRegisteredPoints.address) === playerAddress) {
        const pointsPrecision = 1_000_000n;
        return Number(playerRegisteredPoints.registered_points / pointsPrecision);
      }
    }

    return 0;
  }

  public getCurrentCoOwners(hyperstructureEntityId: ID):
    | {
        coOwners: { address: ContractAddress; percentage: number }[];
        timestamp: number;
      }
    | undefined {
    const hyperstructureShareholders = getComponentValue(
      this.components.HyperstructureShareholders,
      getEntityIdFromKeys([BigInt(hyperstructureEntityId)]),
    );
    if (!hyperstructureShareholders) return;

    const coOwners = (hyperstructureShareholders.shareholders as any).map((owner: any) => {
      const [owner_address, percentage] = owner.value.map((value: any) => value.value);
      return {
        address: ContractAddress(owner_address),
        percentage: Number(percentage),
      };
    });

    return { coOwners, timestamp: Number(hyperstructureShareholders.start_at) };
  }

  /**
   * Get detailed breakdown of hyperstructure shareholder points by hyperstructure
   */
  public getPlayerHyperstructurePointsBreakdown(playerAddress: ContractAddress): Array<{
    hyperstructureId: ID;
    shareholderPercentage: number;
    pointsPerSecond: number;
    timeElapsed: number;
    totalPoints: number;
  }> {
    const configManager = ClientConfigManager.instance();
    const pointsPerSecond = configManager.getHyperstructureConfig().pointsPerCycle;
    const seasonConfig = configManager.getSeasonConfig();

    // Use season end time if season has ended, otherwise use current time
    const currentTimestamp =
      seasonConfig.endAt && Number(seasonConfig.endAt) > 0 ? Number(seasonConfig.endAt) : Math.floor(Date.now() / 1000);

    const breakdown: Array<{
      hyperstructureId: ID;
      shareholderPercentage: number;
      pointsPerSecond: number;
      timeElapsed: number;
      totalPoints: number;
    }> = [];

    const allHyperstructuresShareholders = runQuery([Has(this.components.HyperstructureShareholders)]);

    for (const hyperstructureShareholdersEntityId of allHyperstructuresShareholders) {
      const hyperstructureShareholders = getComponentValue(
        this.components.HyperstructureShareholders,
        hyperstructureShareholdersEntityId,
      );
      if (!hyperstructureShareholders) continue;

      const shareholders = hyperstructureShareholders.shareholders as unknown as ContractAddressAndAmount[];
      const startTimestamp = Number(hyperstructureShareholders.start_at);

      // Aggregate shareholder percentages for the specific player to handle duplicates
      let totalShareholderPercentage = 0;

      for (const share of shareholders) {
        if (ContractAddress(share.value[0].value) === playerAddress) {
          const shareholderPercentage = Number(share.value[1].value) / 10_000; // Convert from basis points to decimal
          totalShareholderPercentage += shareholderPercentage;
        }
      }

      // Skip if player has no shares in this hyperstructure
      if (totalShareholderPercentage === 0) continue;

      const timeElapsed = Math.max(0, currentTimestamp - startTimestamp);
      const playerPointsPerSecond = pointsPerSecond * totalShareholderPercentage;
      const totalPoints = Math.floor(playerPointsPerSecond * timeElapsed);

      breakdown.push({
        hyperstructureId: hyperstructureShareholders.hyperstructure_id,
        shareholderPercentage: totalShareholderPercentage,
        pointsPerSecond: playerPointsPerSecond,
        timeElapsed,
        totalPoints,
      });
    }

    return breakdown;
  }

  private getPlayerPoints(): Map<ContractAddress, number> {
    const pointsPerPlayer = new Map<ContractAddress, number>();

    // Get registered points from on-chain data
    const registredPoints = runQuery([Has(this.components.PlayerRegisteredPoints)]);

    for (const entityId of registredPoints) {
      const playerRegisteredPoints = getComponentValue(this.components.PlayerRegisteredPoints, entityId);
      if (!playerRegisteredPoints) continue;

      const playerAddress = ContractAddress(playerRegisteredPoints.address);
      const pointsPrecision = 1_000_000n;
      const registeredPoints = Number(playerRegisteredPoints.registered_points / pointsPrecision);

      // Add cached unregistered shareholder points to registered points
      const unregisteredShareholderPoints = this.unregisteredShareholderPointsCache.get(playerAddress) || 0;
      const totalPoints = registeredPoints + unregisteredShareholderPoints;

      pointsPerPlayer.set(playerAddress, totalPoints);
    }

    // Also add players who only have unregistered shareholder points but no registered points
    for (const [playerAddress, unregisteredShareholderPoints] of this.unregisteredShareholderPointsCache) {
      if (!pointsPerPlayer.has(playerAddress) && unregisteredShareholderPoints > 0) {
        pointsPerPlayer.set(playerAddress, unregisteredShareholderPoints);
      }
    }

    return pointsPerPlayer;
  }

  private getGuildsPoints(): Map<ContractAddress, number> {
    const pointsPerGuild = new Map<ContractAddress, number>();

    this.pointsPerPlayer.forEach((points, address) => {
      const guildId = getGuildFromPlayerAddress(address, this.components)?.entityId;
      if (!guildId) return;

      const currentPoints = pointsPerGuild.get(guildId) || 0;
      pointsPerGuild.set(guildId, currentPoints + points);
    });

    return pointsPerGuild;
  }

  private getGuildsByRank(): [ContractAddress, number][] {
    return Array.from(this.pointsPerGuild).sort(([_A, pointsA], [_B, pointsB]) => pointsB - pointsA);
  }

  private getPlayersByRank(): [ContractAddress, number][] {
    return Array.from(this.pointsPerPlayer).sort(([_A, pointsA], [_B, pointsB]) => pointsB - pointsA);
  }

  public getPlayerShares(playerAddress: ContractAddress, hyperstructureEntityId: ID) {
    const hyperstructureShareholders = getComponentValue(
      this.components.HyperstructureShareholders,
      getEntityIdFromKeys([BigInt(hyperstructureEntityId)]),
    );

    if (!hyperstructureShareholders) return 0;

    const shareholders = hyperstructureShareholders.shareholders as unknown as ContractAddressAndAmount[];

    const playerShare = shareholders.find(
      (share: ContractAddressAndAmount) => ContractAddress(share.value[0].value) === playerAddress,
    );

    return playerShare ? Number(playerShare.value[1].value / 10_000) : 0;
  }

  public getHyperstructuresWithSharesFromPlayer = (address: ContractAddress) => {
    const hyperstructures = runQuery([Has(this.components.Hyperstructure)]);
    const hyperstructuresWithShares: ID[] = Array.from(hyperstructures)
      .map((entityId) => {
        const hyperstructure = getComponentValue(this.components.Hyperstructure, entityId);
        if (!hyperstructure || !hyperstructure.initialized) return;
        const playerShares = this.getPlayerShares(address, hyperstructure.hyperstructure_id);
        if (playerShares > 0) return hyperstructure.hyperstructure_id;
      })
      .filter((id) => id !== undefined);
    return new Set(hyperstructuresWithShares);
  };

  public isSeasonOver = () => {
    const seasonEnded = runQuery([Has(this.components.events.SeasonEnded)]);

    if (seasonEnded.size > 0) {
      return true;
    }

    return false;
  };
}
