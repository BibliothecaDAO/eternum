import { type ContractAddress, type ID } from "@bibliothecadao/types";
import { type NativeFactStore } from "../client/native-fact-store";
import { getBlockTimestamp } from "../utils/timestamp";
import { hyperstructurePointsPerSecond, sharePointCutoff, unclaimedSharePoints } from "../sync/shareholder-points";
import { configManager } from "./config-manager";

/** Standings are derived from current facts and the game clock at each read. */
export class LeaderboardManager {
  private static current: LeaderboardManager | undefined;
  constructor(private readonly store: NativeFactStore) {}

  static instance(store: NativeFactStore) {
    if (this.current?.store !== store) this.current = new LeaderboardManager(store);
    return this.current;
  }

  get pointsPerPlayer(): Map<ContractAddress, number> {
    const game = configManager.getActiveGameId();
    const points = new Map(
      [...this.store.inGame("PlayerPoints", game)].map((row) => [row.address, Number(row.points) / 1_000_000]),
    );
    for (const share of this.readAccruedShares()) {
      const registered = points.get(share.playerAddress) ?? this.getPlayerRegisteredPoints(share.playerAddress);
      if (registered !== null) points.set(share.playerAddress, registered + share.points);
    }
    return points;
  }

  private get scoresKnown(): boolean {
    const game = configManager.getActiveGameId();
    const actors = new Set([
      ...[...this.store.inGame("PlayerEntry", game)].map((row) => row.owner),
      ...[...this.store.inGame("GuildMember", game)].map((row) => row.actor),
      ...[...this.store.inGame("Structure", game)].map((row) => row.owner).filter((owner) => owner !== 0n),
      ...this.readAccruedShares().map((share) => share.playerAddress),
    ]);
    return [...actors].every((actor) => this.getPlayerRegisteredPoints(actor) !== null);
  }

  get pointsPerGuild(): Map<ContractAddress, number> {
    const game = configManager.getActiveGameId();
    const points = new Map<ContractAddress, number>();
    if (!this.scoresKnown) return points;
    for (const [actor, value] of this.pointsPerPlayer) {
      const member = this.store.get("GuildMember", { game_id: game, actor });
      if (member) points.set(member.guild_id, (points.get(member.guild_id) ?? 0) + value);
    }
    return points;
  }

  get playersByRank() {
    if (!this.scoresKnown) return [];
    return [...this.pointsPerPlayer].toSorted((a, b) => b[1] - a[1]);
  }
  get guildsByRank() {
    return [...this.pointsPerGuild].toSorted((a, b) => b[1] - a[1]);
  }

  private readAccruedShares() {
    const game = configManager.getActiveGameId();
    const shares = [...this.store.inGame("HyperstructureShares", game)];
    if (!shares.length) return [];
    const rules = this.store.require("SliceRules", { game_id: game });
    const clock = this.store.require("GameRegistry", { game_id: game });
    const cutoff = sharePointCutoff(clock, BigInt(Math.floor(getBlockTimestamp().currentBlockTimestamp)));
    const rate = BigInt(rules.victory_points_grant_config.hyp_points_per_second);
    return shares.flatMap((row) =>
      unclaimedSharePoints(row, rate, cutoff).map(({ points }, index) => {
        const share = row.shareholders[index];
        return {
          playerAddress: share.player,
          basisPoints: BigInt(share.bps),
          hyperstructureId: row.entity_id,
          elapsed: Number(cutoff - row.start_at),
          rate: Number(hyperstructurePointsPerSecond(rate, row.multiplier) * BigInt(share.bps)) / 10_000 / 1_000_000,
          points: Number(points) / 1_000_000,
        };
      }),
    );
  }

  getPlayerHyperstructureUnregisteredShareholderPoints(player: ContractAddress): number {
    return this.readAccruedShares()
      .filter((row) => row.playerAddress === player)
      .reduce((sum, row) => sum + row.points, 0);
  }

  getPlayerRegisteredPoints(player: ContractAddress): number | null {
    const result = this.store.requireOrAbsent("PlayerPoints", {
      game_id: configManager.getActiveGameId(),
      address: player,
    });
    return result.known ? Number(result.known.points) / 1_000_000 : null;
  }

  getPlayerPoints(player: ContractAddress): number | null {
    const registered = this.getPlayerRegisteredPoints(player);
    return registered === null ? null : registered + this.getPlayerHyperstructureUnregisteredShareholderPoints(player);
  }

  getCurrentCoOwners(entityId: ID) {
    const row = this.store.get("HyperstructureShares", {
      game_id: configManager.getActiveGameId(),
      entity_id: entityId,
    });
    return row
      ? {
          coOwners: row.shareholders.map((share) => ({ address: share.player, percentage: share.bps })),
          timestamp: Number(row.start_at),
        }
      : undefined;
  }

  getPlayerHyperstructurePointsBreakdown(player: ContractAddress) {
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
      if (share.playerAddress !== player) continue;
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

  getPlayerShares(player: ContractAddress, entityId: ID): number {
    const row = this.store.get("HyperstructureShares", {
      game_id: configManager.getActiveGameId(),
      entity_id: entityId,
    });
    return (
      (row?.shareholders.filter((share) => share.player === player).reduce((sum, share) => sum + share.bps, 0) ?? 0) /
      10_000
    );
  }

  getHyperstructuresWithSharesFromPlayer(player: ContractAddress): Set<ID> {
    return new Set(
      [...this.store.inGame("HyperstructureShares", configManager.getActiveGameId())]
        .filter((row) => row.shareholders.some((share) => share.player === player && share.bps > 0))
        .map((row) => row.entity_id),
    );
  }

  isSeasonOver = () => configManager.isGameOver();
}
