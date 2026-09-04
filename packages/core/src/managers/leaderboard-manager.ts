import { type ClientComponents, ContractAddress, type ID } from "@bibliothecadao/types";
import {
  type Component,
  type ComponentValue,
  type Entity,
  Has,
  type Schema,
  getComponentValue,
  runQuery,
} from "@dojoengine/recs";
import { getGuildFromPlayerAddress, getRealmCountPerHyperstructure } from "../utils";
import { decodeHyperstructureShares } from "../utils/hyperstructure-shareholders";
import { belongsToActiveGame, ClientConfigManager, gameEntityKey } from "./config-manager";

interface PendingSharePointsClaim {
  claimedPoints: number;
  txHash?: string;
  submittedAtMs: number;
  confirmedAtMs?: number;
  status: "submitted" | "confirmed";
}

/**
 * Legacy leaderboard read-model boundary.
 *
 * Registered points remain authoritative in RECS, but this singleton also
 * materializes rank maps, time-derived shareholder points, and a TTL claim
 * overlay with several imperative writers. Keep new live facts out of these
 * maps. Consolidating its ownership and lifecycle is deferred until the
 * leaderboard itself is changed as a dedicated slice.
 */
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
  private pendingSharePointsClaims: Map<ContractAddress, PendingSharePointsClaim> = new Map();
  private readonly pendingSharePointsClaimTtlMs: number = 2 * 60 * 1000;
  private readonly warnedMissingHyperstructureEntities: Set<Entity> = new Set();

  constructor(
    private components: ClientComponents,
    unregisteredShareholderPointsUpdateInterval: number = 10000,
  ) {
    this.unregisteredShareholderPointsUpdateInterval = unregisteredShareholderPointsUpdateInterval;
  }

  public static instance(components: ClientComponents, unregisteredShareholderPointsUpdateInterval?: number) {
    if (!LeaderboardManager._instance) {
      LeaderboardManager._instance = new LeaderboardManager(components, unregisteredShareholderPointsUpdateInterval);
    } else if (LeaderboardManager._instance.components !== components) {
      // The game route rebuilds its RECS world (and components) on every boot
      // (retry, reconnect, re-entry). A singleton pinned to the first boot's
      // components reads a dead world forever — every points read returns
      // empty. Re-bind to the live components and drop caches built on the
      // old world.
      LeaderboardManager._instance.rebindComponents(components);
    }
    return LeaderboardManager._instance;
  }

  private rebindComponents(components: ClientComponents) {
    this.components = components;
    this.pendingSharePointsClaims.clear();
    this.forceRefresh();
  }

  // Multi-game worlds stream every game's rows into RECS (finished games
  // included), and every leaderboard fact is per-game: an address-keyed map fed
  // from unscoped rows lets another game's row win arbitrarily. All reads go
  // through this chokepoint. Legacy worlds have no active game id and keep
  // their single-game rows unfiltered.
  private activeGameRows<S extends Schema>(
    component: Component<S>,
  ): Array<{ entity: Entity; value: ComponentValue<S> }> {
    const rows: Array<{ entity: Entity; value: ComponentValue<S> }> = [];
    for (const entity of runQuery([Has(component)])) {
      const value = getComponentValue(component, entity);
      if (!value || !belongsToActiveGame(value)) continue;
      rows.push({ entity, value });
    }
    return rows;
  }

  public initialize() {
    this.updateUnregisteredShareholderPointsCache();
    this.pointsPerPlayer = this.getPlayerPoints();
    this.pointsPerGuild = this.getGuildsPoints();
    this.playersByRank = this.getPlayersByRank();
    this.guildsByRank = this.getGuildsByRank();
  }

  public forceRefresh() {
    // Reset the last update timestamp to force cache update
    this.lastUnregisteredShareholderPointsUpdate = 0;
    this.initialize();
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

  public setPendingSharePointsClaim(playerAddress: ContractAddress, claimedPoints: number, txHash?: string) {
    if (claimedPoints <= 0) return;

    this.pendingSharePointsClaims.set(playerAddress, {
      claimedPoints,
      txHash,
      submittedAtMs: Date.now(),
      status: "submitted",
    });
  }

  public confirmPendingSharePointsClaim(playerAddress: ContractAddress, txHash?: string) {
    const pendingClaim = this.pendingSharePointsClaims.get(playerAddress);
    if (!pendingClaim) return;
    if (txHash && pendingClaim.txHash && pendingClaim.txHash !== txHash) return;

    pendingClaim.status = "confirmed";
    pendingClaim.confirmedAtMs = Date.now();
    if (txHash && !pendingClaim.txHash) {
      pendingClaim.txHash = txHash;
    }
    this.pendingSharePointsClaims.set(playerAddress, pendingClaim);
  }

  public clearPendingSharePointsClaim(playerAddress: ContractAddress, txHash?: string) {
    const pendingClaim = this.pendingSharePointsClaims.get(playerAddress);
    if (!pendingClaim) return;
    if (txHash && pendingClaim.txHash && pendingClaim.txHash !== txHash) return;
    this.pendingSharePointsClaims.delete(playerAddress);
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
    this.pruneExpiredPendingSharePointsClaims();

    const configManager = ClientConfigManager.instance();
    const pointsPerSecondWithoutMultiplier = configManager.getHyperstructureConfig().pointsPerCycle;
    const seasonConfig = configManager.getSeasonConfig();

    // Use season end time if season has ended, otherwise use current time
    let now = Math.floor(Date.now() / 1000);
    const currentTimestamp =
      seasonConfig.endAt && Number(seasonConfig.endAt) > 0 && now >= Number(seasonConfig.endAt)
        ? Number(seasonConfig.endAt)
        : now;

    // Clear previous cache
    this.unregisteredShareholderPointsCache.clear();

    // Get the active game's hyperstructures
    for (const { entity: hyperstructureShareholdersEntityId, value: hyperstructureShareholders } of this.activeGameRows(
      this.components.HyperstructureShareholders,
    )) {
      const hyperstructure = getComponentValue(this.components.Hyperstructure, hyperstructureShareholdersEntityId);
      if (!hyperstructure && !this.warnedMissingHyperstructureEntities.has(hyperstructureShareholdersEntityId)) {
        // A shareholders row without its Hyperstructure row zeroes every
        // shareholder's live points via the fallback below — that must be a
        // loud sync gap, never a silent zero.
        this.warnedMissingHyperstructureEntities.add(hyperstructureShareholdersEntityId);
        console.warn(
          `[LeaderboardManager] Hyperstructure row missing for shareholders entity ${String(hyperstructureShareholdersEntityId)}; shareholder points read as 0`,
        );
      }

      const pointsPerSecond = hyperstructure ? pointsPerSecondWithoutMultiplier * hyperstructure.points_multiplier : 0;
      const shareholders = decodeHyperstructureShares(hyperstructureShareholders.shareholders);
      const startTimestamp = Number(hyperstructureShareholders.start_at);
      if (startTimestamp === 0) continue;
      const timeElapsed = Math.max(0, currentTimestamp - startTimestamp);

      // Aggregate shareholder percentages by player address to handle duplicates
      const playerShareholderMap = new Map<ContractAddress, number>();

      for (const { playerAddress, basisPoints } of shareholders) {
        const shareholderPercentage = Number(basisPoints) / 10_000;

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

  private pruneExpiredPendingSharePointsClaims() {
    const now = Date.now();
    for (const [playerAddress, pendingClaim] of this.pendingSharePointsClaims) {
      if (now - pendingClaim.submittedAtMs > this.pendingSharePointsClaimTtlMs) {
        this.pendingSharePointsClaims.delete(playerAddress);
      }
    }
  }

  private applyPendingSharePointsClaimOverride(playerAddress: ContractAddress, rawUnregisteredPoints: number): number {
    this.pruneExpiredPendingSharePointsClaims();

    const pendingClaim = this.pendingSharePointsClaims.get(playerAddress);
    if (!pendingClaim) return rawUnregisteredPoints;

    // Apply a pending claim offset to avoid double-counting immediately after submission,
    // then clear the override once post-claim data has been observed.
    if (pendingClaim.status === "confirmed" && rawUnregisteredPoints <= pendingClaim.claimedPoints) {
      this.pendingSharePointsClaims.delete(playerAddress);
      return rawUnregisteredPoints;
    }

    return Math.max(0, rawUnregisteredPoints - pendingClaim.claimedPoints);
  }

  /**
   * Get cached unregistered shareholder points for a specific player
   */
  public getPlayerHyperstructureUnregisteredShareholderPoints(
    playerAddress: ContractAddress,
    options?: { ignorePendingClaimOverride?: boolean },
  ): number {
    this.updateUnregisteredShareholderPointsCacheIfNeeded();
    const rawUnregisteredPoints = this.unregisteredShareholderPointsCache.get(playerAddress) || 0;
    if (options?.ignorePendingClaimOverride) {
      return rawUnregisteredPoints;
    }
    return this.applyPendingSharePointsClaimOverride(playerAddress, rawUnregisteredPoints);
  }

  /**
   * Get only the registered points for a specific player (without unregistered shareholder points)
   */
  public getPlayerRegisteredPoints(playerAddress: ContractAddress): number {
    for (const { value: playerRegisteredPoints } of this.activeGameRows(this.components.PlayerRegisteredPoints)) {
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
      gameEntityKey([BigInt(hyperstructureEntityId)]),
    );
    if (!hyperstructureShareholders) return;

    const coOwners = decodeHyperstructureShares(hyperstructureShareholders.shareholders).map(
      ({ playerAddress, basisPoints }) => ({
        address: playerAddress,
        percentage: Number(basisPoints),
      }),
    );

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
    const pointsPerSecondPerRealmCount = configManager.getHyperstructureConfig().pointsPerCycle;
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

    const realmCountPerHyperstructure = getRealmCountPerHyperstructure(this.components);

    for (const { value: hyperstructureShareholders } of this.activeGameRows(
      this.components.HyperstructureShareholders,
    )) {
      const shareholders = decodeHyperstructureShares(hyperstructureShareholders.shareholders);
      const startTimestamp = Number(hyperstructureShareholders.start_at);

      // Aggregate shareholder percentages for the specific player to handle duplicates
      let totalShareholderPercentage = 0;

      for (const share of shareholders) {
        if (share.playerAddress === playerAddress) {
          const shareholderPercentage = Number(share.basisPoints) / 10_000;
          totalShareholderPercentage += shareholderPercentage;
        }
      }

      // Skip if player has no shares in this hyperstructure
      if (totalShareholderPercentage === 0) continue;

      const timeElapsed = Math.max(0, currentTimestamp - startTimestamp);
      const playerPointsPerSecond =
        pointsPerSecondPerRealmCount *
        (realmCountPerHyperstructure.get(hyperstructureShareholders.hyperstructure_id) || 0) *
        totalShareholderPercentage;
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

    // Get the active game's registered points from on-chain data
    for (const { value: playerRegisteredPoints } of this.activeGameRows(this.components.PlayerRegisteredPoints)) {
      const playerAddress = ContractAddress(playerRegisteredPoints.address);
      const pointsPrecision = 1_000_000n;
      const registeredPoints = Number(playerRegisteredPoints.registered_points / pointsPrecision);

      // Add cached unregistered shareholder points to registered points
      const rawUnregisteredShareholderPoints = this.unregisteredShareholderPointsCache.get(playerAddress) || 0;
      const unregisteredShareholderPoints = this.applyPendingSharePointsClaimOverride(
        playerAddress,
        rawUnregisteredShareholderPoints,
      );
      const totalPoints = registeredPoints + unregisteredShareholderPoints;

      pointsPerPlayer.set(playerAddress, totalPoints);
    }

    // Also add players who only have unregistered shareholder points but no registered points
    for (const [playerAddress, rawUnregisteredShareholderPoints] of this.unregisteredShareholderPointsCache) {
      const unregisteredShareholderPoints = this.applyPendingSharePointsClaimOverride(
        playerAddress,
        rawUnregisteredShareholderPoints,
      );
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
    return Array.from(this.pointsPerGuild).toSorted(([_A, pointsA], [_B, pointsB]) => pointsB - pointsA);
  }

  private getPlayersByRank(): [ContractAddress, number][] {
    return Array.from(this.pointsPerPlayer).toSorted(([_A, pointsA], [_B, pointsB]) => pointsB - pointsA);
  }

  public getPlayerShares(playerAddress: ContractAddress, hyperstructureEntityId: ID) {
    const hyperstructureShareholders = getComponentValue(
      this.components.HyperstructureShareholders,
      gameEntityKey([BigInt(hyperstructureEntityId)]),
    );

    if (!hyperstructureShareholders) return 0;

    const playerShare = decodeHyperstructureShares(hyperstructureShareholders.shareholders).find(
      (share) => share.playerAddress === playerAddress,
    );

    return playerShare ? Number(playerShare.basisPoints) / 10_000 : 0;
  }

  public getHyperstructuresWithSharesFromPlayer = (address: ContractAddress) => {
    const hyperstructuresWithShares: ID[] = this.activeGameRows(this.components.Hyperstructure)
      .map(({ value: hyperstructure }) => {
        if (!hyperstructure.initialized) return;
        const playerShares = this.getPlayerShares(address, hyperstructure.hyperstructure_id);
        if (playerShares > 0) return hyperstructure.hyperstructure_id;
      })
      .filter((id) => id !== undefined);
    return new Set(hyperstructuresWithShares);
  };

  public isSeasonOver = () => {
    // s2 single world: game end state lives on the registry row; the
    // SeasonEnded event only exists on legacy worlds.
    const config = ClientConfigManager.instance();
    if (config.getActiveGameId() > 0) {
      return config.isGameOver();
    }

    const seasonEnded = runQuery([Has(this.components.events.SeasonEnded)]);

    if (seasonEnded.size > 0) {
      return true;
    }

    return false;
  };
}
