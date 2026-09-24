import {
  createEmptyActivityBreakdown,
  readPointsRegistration,
  type PlayerActivityBreakdown,
} from "@bibliothecadao/eternum/game-sync";

type Registration = NonNullable<ReturnType<typeof readPointsRegistration>>;

/**
 * Each player's registered points by activity: restored from history before serving requests, then updated only by
 * newly committed events. Totals and ranks come from current facts in the leaderboard read model, not from here.
 */
export class PointsLeaderboard {
  private readonly games = new Map<string, Map<string, PlayerActivityBreakdown>>();

  public accept(gameId: string, registration: Registration): void {
    const key = BigInt(gameId).toString();
    let players = this.games.get(key);
    if (!players) {
      players = new Map();
      this.games.set(key, players);
    }
    let breakdown = players.get(registration.address);
    if (!breakdown) {
      breakdown = createEmptyActivityBreakdown();
      players.set(registration.address, breakdown);
    }
    breakdown[registration.activity].count += 1;
    breakdown[registration.activity].points += registration.points;
  }

  public activity(gameId: string): ReadonlyMap<string, PlayerActivityBreakdown> {
    const players = this.games.get(BigInt(gameId).toString()) ?? new Map();
    return new Map([...players].map(([address, breakdown]) => [address, structuredClone(breakdown)]));
  }
}
