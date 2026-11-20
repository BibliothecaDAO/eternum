import { type ContractAddress, wholePoints } from "@bibliothecadao/types";
import { type NativeFactStore } from "../client/native-fact-store";
import { configManager } from "./config-manager";

export interface PlayerStanding {
  address: ContractAddress;
  points: number;
}

export class LeaderboardManager {
  private static current: LeaderboardManager | undefined;
  constructor(private readonly store: NativeFactStore) {}

  static instance(store: NativeFactStore) {
    if (this.current?.store !== store) this.current = new LeaderboardManager(store);
    return this.current;
  }

  private readStandings(): PlayerStanding[] {
    const game = configManager.getActiveGameId();
    return [...this.store.inGame("PlayerPoints", game)].map((row) => ({
      address: row.address,
      points: wholePoints(row.points),
    }));
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
    ]);
    return [...actors].every((actor) => this.getPlayerPoints(actor) !== null);
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

  getPlayerPoints(player: ContractAddress): number | null {
    const result = this.store.requireOrAbsent("PlayerPoints", {
      game_id: configManager.getActiveGameId(),
      address: player,
    });
    return result.known ? wholePoints(result.known.points) : null;
  }

  isSeasonOver = () => configManager.isGameOver();
}
