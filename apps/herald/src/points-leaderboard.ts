import {
  createEmptyActivityBreakdown,
  readPointsRegistration,
  type HeraldLeaderboard,
  type PlayerLeaderboardActivityEntry,
} from "@bibliothecadao/eternum/game-sync";

type Registration = NonNullable<ReturnType<typeof readPointsRegistration>>;

/** A history aggregate restored before serving requests, then updated only by newly committed events. */
export class PointsLeaderboard {
  private readonly games = new Map<string, Map<string, PlayerLeaderboardActivityEntry>>();

  public accept(gameId: string, registration: Registration): void {
    const key = BigInt(gameId).toString();
    let players = this.games.get(key);
    if (!players) {
      players = new Map();
      this.games.set(key, players);
    }
    let entry = players.get(registration.address);
    if (!entry) {
      entry = {
        address: registration.address,
        activityBreakdown: createEmptyActivityBreakdown(),
        totalPoints: 0,
        rank: 0,
      };
      players.set(registration.address, entry);
    }
    entry.activityBreakdown[registration.activity].count += 1;
    entry.activityBreakdown[registration.activity].points += registration.points;
    entry.totalPoints += registration.points;
  }

  public snapshot(gameId: string): HeraldLeaderboard {
    const key = BigInt(gameId).toString();
    const entries = [...(this.games.get(key)?.values() ?? [])]
      .sort((left, right) => right.totalPoints - left.totalPoints || left.address.localeCompare(right.address))
      .map((entry, index) => ({
        ...entry,
        activityBreakdown: structuredClone(entry.activityBreakdown),
        rank: index + 1,
      }));
    return { game_id: key, entries };
  }
}
