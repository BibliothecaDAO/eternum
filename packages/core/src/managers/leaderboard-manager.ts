import { getBlockTimestamp } from "../utils/timestamp";
import { accruedSharePoints } from "../sync/shareholder-points";
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
import { getGuildFromPlayerAddress } from "../utils";
import { decodeHyperstructureShares } from "../utils/hyperstructure-shareholders";
import { belongsToActiveGame, ClientConfigManager, gameEntityKey } from "./config-manager";

/** Derives standings and accrued shares from the current RECS rows and game clock. */
export class LeaderboardManager {
  private static _instance: LeaderboardManager;
  public pointsPerPlayer: Map<ContractAddress, number> = new Map();
  public playersByRank: [ContractAddress, number][] = [];
  public pointsPerGuild: Map<ContractAddress, number> = new Map();
  public guildsByRank: [ContractAddress, number][] = [];

  private unregisteredShareholderPoints: Map<ContractAddress, number> = new Map();

  constructor(private components: ClientComponents) {}

  public static instance(components: ClientComponents) {
    if (!LeaderboardManager._instance) {
      LeaderboardManager._instance = new LeaderboardManager(components);
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
    this.updateUnregisteredShareholderPoints();
    this.pointsPerPlayer = this.getPlayerPoints();
    this.pointsPerGuild = this.getGuildsPoints();
    this.playersByRank = this.getPlayersByRank();
    this.guildsByRank = this.getGuildsByRank();
  }

  public forceRefresh() {
    this.initialize();
  }

  public updatePoints() {
    this.initialize();
  }

  private readAccruedShares() {
    const rows = this.activeGameRows(this.components.HyperstructureShareholders);
    if (rows.length === 0) return [];
    const config = ClientConfigManager.instance();
    const rate = BigInt(Math.round(config.getHyperstructureConfig().pointsPerCycle * 1_000_000));
    const now = getBlockTimestamp().currentBlockTimestamp;
    const endAt = Number(config.getSeasonConfig().endAt);
    const cutoff = !config.getDevModeConfig().dev_mode_on && endAt > 0 ? Math.min(now, endAt) : now;
    return rows.flatMap(({ entity, value }) => {
      const hyperstructure = getComponentValue(this.components.Hyperstructure, entity);
      if (!hyperstructure) {
        console.warn("LeaderboardManager: waiting for hyperstructure row", { entity: String(entity) });
        return [];
      }
      const start = Number(value.start_at);
      if (start === 0 || cutoff <= start) return [];
      const elapsed = BigInt(cutoff - start);
      const multiplier = BigInt(hyperstructure.points_multiplier);
      return decodeHyperstructureShares(value.shareholders).map((share) => ({
        ...share,
        hyperstructureId: value.hyperstructure_id,
        elapsed: Number(elapsed),
        rate: Number(rate * multiplier * share.basisPoints) / 10_000_000_000,
        points: Number(accruedSharePoints(rate, multiplier, share.basisPoints, elapsed)) / 1_000_000,
      }));
    });
  }

  private updateUnregisteredShareholderPoints() {
    this.unregisteredShareholderPoints.clear();
    for (const share of this.readAccruedShares()) {
      const current = this.unregisteredShareholderPoints.get(share.playerAddress) ?? 0;
      this.unregisteredShareholderPoints.set(share.playerAddress, current + share.points);
    }
  }

  /**
   * Get current unregistered shareholder points for a specific player
   */
  public getPlayerHyperstructureUnregisteredShareholderPoints(playerAddress: ContractAddress): number {
    return this.unregisteredShareholderPoints.get(playerAddress) ?? 0;
  }

  /**
   * Get only the registered points for a specific player (without unregistered shareholder points)
   */
  public getPlayerRegisteredPoints(playerAddress: ContractAddress): number {
    for (const { value: playerRegisteredPoints } of this.activeGameRows(this.components.PlayerRegisteredPoints)) {
      if (ContractAddress(playerRegisteredPoints.address) === playerAddress) {
        const pointsPrecision = 1_000_000n;
        return Number(playerRegisteredPoints.registered_points) / Number(pointsPrecision);
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
    const grouped = new Map<
      ID,
      {
        hyperstructureId: ID;
        shareholderPercentage: number;
        pointsPerSecond: number;
        timeElapsed: number;
        totalPoints: number;
      }
    >();
    for (const share of this.readAccruedShares()) {
      if (share.playerAddress !== playerAddress) continue;
      const entry = grouped.get(share.hyperstructureId) ?? {
        hyperstructureId: share.hyperstructureId,
        shareholderPercentage: 0,
        pointsPerSecond: 0,
        timeElapsed: share.elapsed,
        totalPoints: 0,
      };
      entry.shareholderPercentage += Number(share.basisPoints) / 10_000;
      entry.pointsPerSecond += share.rate;
      entry.totalPoints += share.points;
      grouped.set(share.hyperstructureId, entry);
    }
    return [...grouped.values()];
  }

  private getPlayerPoints(): Map<ContractAddress, number> {
    const pointsPerPlayer = new Map<ContractAddress, number>();

    // Get the active game's registered points from on-chain data
    for (const { value: playerRegisteredPoints } of this.activeGameRows(this.components.PlayerRegisteredPoints)) {
      const playerAddress = ContractAddress(playerRegisteredPoints.address);
      const pointsPrecision = 1_000_000n;
      const registeredPoints = Number(playerRegisteredPoints.registered_points) / Number(pointsPrecision);

      // Add cached unregistered shareholder points to registered points
      const rawUnregisteredShareholderPoints = this.unregisteredShareholderPoints.get(playerAddress) || 0;
      const unregisteredShareholderPoints = rawUnregisteredShareholderPoints;
      const totalPoints = registeredPoints + unregisteredShareholderPoints;

      pointsPerPlayer.set(playerAddress, totalPoints);
    }

    // Also add players who only have unregistered shareholder points but no registered points
    for (const [playerAddress, rawUnregisteredShareholderPoints] of this.unregisteredShareholderPoints) {
      const unregisteredShareholderPoints = rawUnregisteredShareholderPoints;
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
