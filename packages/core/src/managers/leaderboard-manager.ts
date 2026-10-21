import { safeInteger } from "../utils/safe-integer";
import { type ContractAddress, type ID, wholePoints } from "@bibliothecadao/types";
import { type NativeFactStore } from "../client/native-fact-store";
import { getBlockTimestamp } from "../utils/timestamp";
import { hyperstructurePointsPerSecond, sharePointCutoff, unclaimedSharePoints } from "../sync/shareholder-points";
import { configManager } from "./config-manager";

/** A player's standing at one reading of the game clock. */
export interface PlayerStanding {
  address: ContractAddress;
  /** The points registered on chain (PlayerPoints). */
  registeredPoints: number;
  /** Hold points earned since each held hyperstructure's last checkpoint, registered at its next one. */
  accruingHoldPoints: number;
  /** The standing's total: its registered points plus its accruing hold points. */
  points: number;
}

/** Standings are derived from current facts and the game clock at each read. */
export class LeaderboardManager {
  private static current: LeaderboardManager | undefined;
  constructor(private readonly store: NativeFactStore) {}

  static instance(store: NativeFactStore) {
    if (this.current?.store !== store) this.current = new LeaderboardManager(store);
    return this.current;
  }

  /** Every standing from one reading of the clock, so a total and the hold points in it are the same calculation. */
  private readStandings(): PlayerStanding[] {
    const game = configManager.getActiveGameId();
    const registered = new Map(
      [...this.store.inGame("PlayerPoints", game)].map((row) => [row.address, wholePoints(row.points)]),
    );
    const accruing = new Map<ContractAddress, number>();
    for (const share of this.readAccruedShares()) {
      if (!registered.has(share.playerAddress)) {
        const known = this.getPlayerRegisteredPoints(share.playerAddress);
        if (known === null) continue;
        registered.set(share.playerAddress, known);
      }
      accruing.set(share.playerAddress, (accruing.get(share.playerAddress) ?? 0) + share.points);
    }
    return [...registered].map(([address, registeredPoints]) => {
      const accruingHoldPoints = accruing.get(address) ?? 0;
      return { address, registeredPoints, accruingHoldPoints, points: registeredPoints + accruingHoldPoints };
    });
  }

  get pointsPerPlayer(): Map<ContractAddress, number> {
    return new Map(this.readStandings().map((standing) => [standing.address, standing.points]));
  }

  private get scoresKnown(): boolean {
    const game = configManager.getActiveGameId();
    const actors = new Set([
      ...[...this.store.inGame("PlayerEntry", game)].map((row) => row.owner),
      ...[...this.store.inGame("GuildMember", game)].map((row) => row.actor),
      ...[...this.store.inGame("Structure", game)].map((row) => row.owner).filter((owner) => owner !== 0n),
      ...[...this.store.inGame("HyperstructureShares", game)].flatMap((row) =>
        row.shareholders.map((share) => share.player),
      ),
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

  /** The standings, highest total first; none while any player's score is still unknown. */
  get playersByRank(): PlayerStanding[] {
    if (!this.scoresKnown) return [];
    return this.readStandings().toSorted((a, b) => b.points - a.points);
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
        return { playerAddress: share.player, points: wholePoints(points) };
      }),
    );
  }

  getPlayerRegisteredPoints(player: ContractAddress): number | null {
    const result = this.store.requireOrAbsent("PlayerPoints", {
      game_id: configManager.getActiveGameId(),
      address: player,
    });
    return result.known ? wholePoints(result.known.points) : null;
  }

  getPlayerPoints(player: ContractAddress): number | null {
    const registered = this.getPlayerRegisteredPoints(player);
    if (registered === null) return null;
    return this.readAccruedShares()
      .filter((share) => share.playerAddress === player)
      .reduce((sum, share) => sum + share.points, registered);
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

  /**
   * The hyperstructures paying a player now, from the current allocations alone: each one the player holds a share of,
   * at its rate (the grant times the allocation's multiplier, times the player's share), whatever has accrued since
   * its last checkpoint. Outside development mode nothing pays once the game has ended.
   */
  getPlayerHyperstructuresPaying(player: ContractAddress) {
    const game = configManager.getActiveGameId();
    const clock = this.store.require("GameRegistry", { game_id: game });
    const now = BigInt(Math.floor(getBlockTimestamp().currentBlockTimestamp));
    if (sharePointCutoff(clock, now) < now) return [];
    const grant = this.store.require("SliceRules", { game_id: game }).victory_points_grant_config.hyp_points_per_second;
    const paying = new Map<ID, { hyperstructureId: ID; shareholderPercentage: number; pointsPerSecond: number }>();
    for (const row of this.store.inGame("HyperstructureShares", game)) {
      const rate = hyperstructurePointsPerSecond(grant, row.multiplier);
      for (const share of row.shareholders) {
        if (BigInt(share.player) !== BigInt(player)) continue;
        const pointsPerSecond = wholePoints(rate * BigInt(share.bps)) / 10_000;
        if (pointsPerSecond <= 0) continue;
        const hyperstructureId = safeInteger(row.entity_id);
        const entry = paying.get(hyperstructureId) ?? {
          hyperstructureId,
          shareholderPercentage: 0,
          pointsPerSecond: 0,
        };
        entry.shareholderPercentage += Number(share.bps) / 10_000;
        entry.pointsPerSecond += pointsPerSecond;
        paying.set(hyperstructureId, entry);
      }
    }
    return [...paying.values()];
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
        .map((row) => safeInteger(row.entity_id)),
    );
  }

  isSeasonOver = () => configManager.isGameOver();
}
